#!/usr/bin/env python3
"""
nvidia_batch_scan.py
====================

CLI runner that batch-scans all 229 NVIDIA skills through the GitScape
ScapeGuard API and persists results to the GCS registry.

Features
--------
- Reads ``scripts/nvidia_skills.json`` (harvested by nvidia_skills_harvester.py)
- Calls  ``POST /api/admin/scan-batch`` in configurable chunk sizes (SSE stream)
- Displays a live ASCII progress bar in the terminal (stdlib only, no dependencies)
- Resume-from-checkpoint: already-scanned skills are marked ``skip=true`` and
  skipped automatically on restart (state tracked in ``nvidia_scan_checkpoint.json``)
- Writes a ``scripts/nvidia_scan_results.md`` Markdown report after each run

Usage
-----
    # Dry-run — show what would be scanned, no API calls
    python scripts/nvidia_batch_scan.py --dry-run

    # Full scan against local dev server
    python scripts/nvidia_batch_scan.py \\
        --api-url http://localhost:8080 \\
        --admin-key YOUR_KEY

    # Full scan against production
    python scripts/nvidia_batch_scan.py \\
        --api-url https://gitscape-api-xxxxxxxxxx-uw.a.run.app \\
        --admin-key $(gcloud secrets versions access latest --secret=GITSCAPE_ADMIN_KEY) \\
        --concurrency 3 \\
        --chunk-size 20

    # Resume after interruption (checkpoint already saved)
    python scripts/nvidia_batch_scan.py --resume [same flags]

Environment variables
---------------------
    GITSCAPE_API_URL      Base API URL (overridden by --api-url)
    GITSCAPE_ADMIN_KEY    Admin key    (overridden by --admin-key)
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

# Force UTF-8 stdout on Windows (avoids cp1252 encode errors for box-drawing chars)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)

# ── paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
SKILLS_FILE = SCRIPT_DIR / "nvidia_skills.json"
CHECKPOINT_FILE = SCRIPT_DIR / "nvidia_scan_checkpoint.json"
RESULTS_FILE = SCRIPT_DIR / "nvidia_scan_results.md"

# ── progress bar ──────────────────────────────────────────────────────────────

BAR_WIDTH = 40


def _bar(done: int, total: int, failed: int) -> str:
    pct = done / max(total, 1)
    filled = int(pct * BAR_WIDTH)
    bar = "#" * filled + "." * (BAR_WIDTH - filled)
    pct_str = f"{pct * 100:5.1f}%"
    fail_str = f"  FAIL:{failed}" if failed else ""
    return f"[{bar}] {pct_str}  {done}/{total}{fail_str}"


def _print_progress(line: str) -> None:
    sys.stdout.write(f"\r{line:<80}")
    sys.stdout.flush()


def _println(line: str) -> None:
    sys.stdout.write(f"\r{line:<80}\n")
    sys.stdout.flush()


# ── checkpoint helpers ────────────────────────────────────────────────────────

def load_checkpoint() -> set[str]:
    """Returns the set of skill_name values that have already been scanned."""
    if not CHECKPOINT_FILE.exists():
        return set()
    try:
        data = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
        return set(data.get("completed", []))
    except Exception:
        return set()


def save_checkpoint(completed: set[str], failed: set[str]) -> None:
    data = {
        "completed": sorted(completed),
        "failed": sorted(failed),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    CHECKPOINT_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ── SSE reader ────────────────────────────────────────────────────────────────

def _iter_sse(response) -> Iterator[dict]:
    """
    Iterates over Server-Sent Events from an open urllib response.
    Yields parsed JSON payloads from ``data: {...}`` lines.
    """
    for raw_line in response:
        if isinstance(raw_line, bytes):
            line = raw_line.decode("utf-8", errors="replace").rstrip("\n")
        else:
            line = str(raw_line).rstrip("\n")
        if line.startswith("data: "):
            payload = line[6:].strip()
            if payload:
                try:
                    yield json.loads(payload)
                except json.JSONDecodeError:
                    pass


# ── API call ──────────────────────────────────────────────────────────────────

def _post_batch_sse(
    api_url: str,
    admin_key: str,
    skills_payload: list[dict],
    concurrency: int,
) -> Iterator[dict]:
    """
    POSTs to /api/admin/scan-batch and yields SSE events as dicts.
    Uses only stdlib (urllib) so the script has zero extra dependencies.
    """
    import urllib.request

    url = f"{api_url.rstrip('/')}/api/admin/scan-batch"
    body = json.dumps({"skills": skills_payload, "concurrency": concurrency}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Admin-Key": admin_key,
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        },
    )

    # Long timeout — each skill can take 30–90 s
    ctx = None
    try:
        import ssl
        ctx = ssl.create_default_context()
    except Exception:
        pass

    try:
        response = urllib.request.urlopen(req, timeout=3600, context=ctx) if ctx else urllib.request.urlopen(req, timeout=3600)
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        raise RuntimeError(
            f"HTTP {e.code} from {url}: {body_bytes.decode('utf-8', errors='replace')[:400]}"
        ) from e

    try:
        yield from _iter_sse(response)
    finally:
        response.close()


# ── report writer ─────────────────────────────────────────────────────────────

def _write_report(
    results: list[dict],
    completed: set[str],
    failed_map: dict[str, str],
    skipped_count: int,
    started_at: str,
    finished_at: str,
    dry_run: bool,
) -> None:
    total = len(results) + skipped_count
    ok_count = len(completed)
    fail_count = len(failed_map)

    lines = [
        "# NVIDIA Skills Batch Scan — Results",
        "",
        f"> **Generated:** {finished_at}",
        f"> **Mode:** {'Dry run (no API calls)' if dry_run else 'Live scan'}",
        "",
        "## Summary",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total skills | {total} |",
        f"| Scanned successfully | {ok_count} |",
        f"| Failed | {fail_count} |",
        f"| Skipped (checkpoint) | {skipped_count} |",
        f"| Started | {started_at} |",
        f"| Finished | {finished_at} |",
        "",
    ]

    if fail_count:
        lines += [
            "## Failed Skills",
            "",
            "| Skill | Error |",
            "|-------|-------|",
        ]
        for skill_name, err in sorted(failed_map.items()):
            safe_err = err.replace("|", "\\|")[:120]
            lines.append(f"| `{skill_name}` | {safe_err} |")
        lines.append("")

    lines += [
        "## Completed Skills",
        "",
        "| # | Skill Name | Status |",
        "|---|------------|--------|",
    ]
    for i, r in enumerate(sorted(results, key=lambda x: x.get("skill_name", "")), 1):
        status = "[OK] OK" if r.get("ok") else "[FAIL] FAIL"
        lines.append(f"| {i} | `{r.get('skill_name', '')}` | {status} |")

    RESULTS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    _println(f"[>]  Report written → {RESULTS_FILE}")


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch-scan all NVIDIA skills through GitScape ScapeGuard.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("GITSCAPE_API_URL", "http://localhost:8080"),
        help="Base URL of the GitScape API (default: http://localhost:8080)",
    )
    parser.add_argument(
        "--admin-key",
        default=os.environ.get("GITSCAPE_ADMIN_KEY", ""),
        help="Value for the X-Admin-Key header (env: GITSCAPE_ADMIN_KEY)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=2,
        choices=range(1, 6),
        metavar="1-5",
        help="Number of parallel scans within each chunk (default: 2)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=25,
        help=(
            "Number of skills per POST to /admin/scan-batch. "
            "Smaller chunks = more resilient to network drops (default: 25)."
        ),
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Skip skills already in the checkpoint file (default: True).",
    )
    parser.add_argument(
        "--no-resume",
        dest="resume",
        action="store_false",
        help="Ignore the checkpoint — re-scan all skills.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be scanned without calling the API.",
    )
    parser.add_argument(
        "--skills-file",
        default=str(SKILLS_FILE),
        help=f"Path to nvidia_skills.json (default: {SKILLS_FILE})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only scan the first N skills (0 = all). Useful for testing.",
    )

    args = parser.parse_args()

    # ── load skills ────────────────────────────────────────────────────────────
    skills_path = Path(args.skills_file)
    if not skills_path.exists():
        sys.exit(f"ERROR: Skills file not found: {skills_path}\nRun nvidia_skills_harvester.py first.")

    skills: list[dict] = json.loads(skills_path.read_text(encoding="utf-8"))
    if args.limit > 0:
        skills = skills[: args.limit]

    total = len(skills)
    print(f"\n[>]  GitScape NVIDIA Batch Scanner")
    print(f"    Skills file   : {skills_path}")
    print(f"    Total skills  : {total}")
    print(f"    API URL       : {args.api_url}")
    print(f"    Concurrency   : {args.concurrency}")
    print(f"    Chunk size    : {args.chunk_size}")
    print(f"    Resume mode   : {args.resume}")
    print(f"    Dry run       : {args.dry_run}\n")

    # ── checkpoint ─────────────────────────────────────────────────────────────
    already_done: set[str] = set()
    if args.resume:
        already_done = load_checkpoint()
        if already_done:
            print(f"    Checkpoint    : {len(already_done)} skills already scanned — skipping.\n")

    if not args.dry_run and not args.admin_key:
        sys.exit(
            "ERROR: --admin-key is required (or set GITSCAPE_ADMIN_KEY env var). "
            "Use --dry-run to preview without an API key."
        )

    # ── build payload, marking resumed skills as skip ─────────────────────────
    payload_skills: list[dict] = []
    for s in skills:
        skill_name = s.get("skill_name", "")
        payload_skills.append({
            "github_url": s.get("github_url", "https://github.com/NVIDIA/skills"),
            "skill_name": skill_name,
            "display_name": s.get("display_name", ""),
            "description": s.get("description", ""),
            "product": s.get("product", ""),
            "nvidia_domain": s.get("nvidia_domain", []),
            "nvidia_audience": s.get("nvidia_audience", []),
            "nvidia_skill_url": s.get("nvidia_skill_url", ""),
            "nvidia_subdomain": s.get("nvidia_subdomain", ""),
            "nvidia_activity_tags": s.get("nvidia_activity_tags", []),
            "source": "nvidia",
            "skip": skill_name in already_done,
        })

    skills_to_scan = [s for s in payload_skills if not s["skip"]]
    skipped_count = len(already_done)

    print(f"    To scan       : {len(skills_to_scan)} skills")
    if skipped_count:
        print(f"    Skipped       : {skipped_count} skills (checkpoint)\n")

    if args.dry_run:
        print("\n--- DRY RUN --- (no API calls)\n")
        for i, s in enumerate(skills_to_scan, 1):
            print(f"  [{i:3d}/{len(skills_to_scan):3d}] {s['skill_name']:40s}  {s.get('nvidia_subdomain','')}")
        # Write a dry-run report
        _write_report(
            results=[{"skill_name": s["skill_name"], "ok": True} for s in skills_to_scan],
            completed={s["skill_name"] for s in skills_to_scan},
            failed_map={},
            skipped_count=skipped_count,
            started_at=datetime.now(timezone.utc).isoformat(),
            finished_at=datetime.now(timezone.utc).isoformat(),
            dry_run=True,
        )
        print(f"\nDry run complete. {len(skills_to_scan)} skills would be scanned.\n")
        return

    if not skills_to_scan:
        print("[OK]  All skills already scanned. Nothing to do.\n")
        return

    # ── chunk and scan ─────────────────────────────────────────────────────────
    started_at = datetime.now(timezone.utc).isoformat()
    completed_this_run: set[str] = set()
    failed_this_run: dict[str, str] = {}
    all_results: list[dict] = []

    chunks = [
        payload_skills[i : i + args.chunk_size]
        for i in range(0, len(payload_skills), args.chunk_size)
    ]

    global_done = skipped_count
    global_failed = 0
    global_total = total

    print(f"\n{'─' * 60}")

    for chunk_idx, chunk in enumerate(chunks):
        chunk_label = f"Chunk {chunk_idx + 1}/{len(chunks)}"
        active = [s for s in chunk if not s["skip"]]
        if not active:
            continue  # entire chunk already done

        _println(f"\n  {chunk_label}  ({len(active)} skills)")

        try:
            for event in _post_batch_sse(args.api_url, args.admin_key, chunk, args.concurrency):
                event_type = event.get("event")

                if event_type == "start":
                    pass  # chunk started, server acknowledged

                elif event_type == "skill_done":
                    skill_name = event.get("skill_name", "")
                    ok = event.get("ok", False)
                    err = event.get("error") or ""
                    all_results.append({"skill_name": skill_name, "ok": ok, "error": err})

                    if ok:
                        completed_this_run.add(skill_name)
                        already_done.add(skill_name)
                    else:
                        failed_this_run[skill_name] = err
                        global_failed += 1

                    global_done += 1
                    status_icon = "[OK]" if ok else "[FAIL]"
                    _println(f"  {status_icon} {skill_name}")
                    _print_progress(
                        f"  {_bar(global_done, global_total, global_failed)}"
                    )

                    # Save checkpoint after every skill so restart resumes cleanly
                    save_checkpoint(already_done, set(failed_this_run.keys()))

                elif event_type == "done":
                    pass  # end-of-chunk summary — we track globally

        except KeyboardInterrupt:
            print("\n\n[WARN]  Interrupted by user. Checkpoint saved — re-run with --resume to continue.\n")
            save_checkpoint(already_done, set(failed_this_run.keys()))
            sys.exit(130)

        except RuntimeError as exc:
            print(f"\n\n[FAIL]  Chunk {chunk_idx + 1} failed: {exc}")
            print("    Checkpoint saved. Re-run with --resume to continue.\n")
            save_checkpoint(already_done, set(failed_this_run.keys()))
            # Continue to next chunk rather than aborting entirely
            continue

        except Exception as exc:
            print(f"\n\n[FAIL]  Unexpected error in chunk {chunk_idx + 1}: {exc}")
            save_checkpoint(already_done, set(failed_this_run.keys()))
            continue

        # Small pause between chunks to avoid overwhelming the server
        if chunk_idx < len(chunks) - 1:
            time.sleep(2)

    # ── final summary ─────────────────────────────────────────────────────────
    finished_at = datetime.now(timezone.utc).isoformat()
    print(f"\n\n{'─' * 60}")
    print(f"[OK]  Batch scan complete!\n")
    print(f"    Total         : {global_total}")
    print(f"    Succeeded     : {len(completed_this_run)}")
    print(f"    Failed        : {len(failed_this_run)}")
    print(f"    Skipped       : {skipped_count} (already indexed)")

    if failed_this_run:
        print(f"\n[FAIL]  Failed skills:")
        for name, err in sorted(failed_this_run.items()):
            print(f"    - {name}: {err[:120]}")

    # Write final checkpoint and report
    save_checkpoint(already_done, set(failed_this_run.keys()))
    _write_report(
        results=all_results,
        completed=completed_this_run,
        failed_map=failed_this_run,
        skipped_count=skipped_count,
        started_at=started_at,
        finished_at=finished_at,
        dry_run=False,
    )

    print(f"\n    Checkpoint    : {CHECKPOINT_FILE}")
    print(f"    Report        : {RESULTS_FILE}\n")


if __name__ == "__main__":
    main()
