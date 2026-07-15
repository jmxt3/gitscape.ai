#!/usr/bin/env python3
"""
nvidia_skills_harvester.py
==========================

Reads the NVIDIA/skills repository's pre-built metadata.json via the GitHub
Raw API and produces two output files:

  scripts/nvidia_skills.json        — validated skills ready for batch scan
  scripts/nvidia_skills_validation.md — skills that need a manual review
                                        (missing fields, unexpected structure, etc.)

The "scan target" for every skill is the NVIDIA/skills repo itself
(https://github.com/NVIDIA/skills), because all 229 skill SKILL.md files live
at plugins/nvidia-skills/skills/<name>/SKILL.md within that single monorepo.
The per-skill canonical URL on build.nvidia.com is derived from the skill name.

Usage:
    python scripts/nvidia_skills_harvester.py [--token GITHUB_TOKEN]

Environment:
    GITHUB_TOKEN — optional, raises rate-limit from 60 to 5,000 req/hr
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

# ─── constants ────────────────────────────────────────────────────────────────

METADATA_URL = (
    "https://raw.githubusercontent.com/NVIDIA/skills/main"
    "/.github/scripts/marketplace/metadata.json"
)
NVIDIA_SKILLS_GITHUB_URL = "https://github.com/NVIDIA/skills"
NVIDIA_BUILD_SKILL_BASE = "https://build.nvidia.com/skills"

# Canonical display names for category keys used by NVIDIA
CATEGORY_DISPLAY: dict[str, str] = {
    "ai_and_machine_learning": "AI And Machine Learning",
    "accelerated_computing": "Accelerated Computing",
    "developer_tools": "Developer Tools",
    "physical_ai": "Physical AI",
    "infrastructure": "Infrastructure",
}

# Canonical display names for audience keys
AUDIENCE_DISPLAY: dict[str, str] = {
    "developer": "Developer",
    "ai_engineer": "AI Engineer",
    "ml_engineer": "ML Engineer",
    "data_scientist": "Data Scientist",
    "data_engineer": "Data Engineer",
    "application_developer": "Application Developer",
    "devops_engineer": "DevOps Engineer",
    "platform_engineer": "Platform Engineer",
    "hpc_developer": "HPC Developer",
    "solutions_architect": "Solutions Architect",
    "quantum_researcher": "Quantum Researcher",
    "simulation_engineer": "Simulation Engineer",
    "research_academic": "Research Academic",
    "robotics_developer": "Robotics Developer",
    "security_engineer": "Security Engineer",
    "it_professional": "IT Professional",
    "network_engineer": "Network Engineer",
}

OUTPUT_DIR = Path(__file__).parent
SKILLS_JSON = OUTPUT_DIR / "nvidia_skills.json"
VALIDATION_MD = OUTPUT_DIR / "nvidia_skills_validation.md"


# ─── helpers ──────────────────────────────────────────────────────────────────


def _http_get(url: str, token: str | None) -> dict[str, Any] | None:
    headers: dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code == 200:
        return resp.json()
    print(f"  ⚠  HTTP {resp.status_code} for {url}", file=sys.stderr)
    return None


def _normalise_audience(raw: str) -> list[str]:
    """Convert comma-separated audience string to display-name list."""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return [AUDIENCE_DISPLAY.get(p, p.replace("_", " ").title()) for p in parts]


def _normalise_category(raw: str) -> str:
    return CATEGORY_DISPLAY.get(raw.strip(), raw.replace("_", " ").title())


def _skill_url(name: str) -> str:
    return f"{NVIDIA_BUILD_SKILL_BASE}/{name}"


# ─── main ─────────────────────────────────────────────────────────────────────


def harvest(token: str | None) -> None:
    print("⬇  Fetching NVIDIA/skills metadata.json …")
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.get(METADATA_URL, headers=headers, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    raw_skills: list[dict] = data.get("skills", [])
    print(f"   Found {len(raw_skills)} skill entries in metadata.json")

    validated: list[dict] = []
    needs_review: list[dict] = []

    for entry in raw_skills:
        name: str = entry.get("name", "").strip()
        path: str = entry.get("path", "").strip()
        description: str = entry.get("description", "").strip()
        meta: dict = entry.get("metadata", {})

        issues: list[str] = []

        if not name:
            issues.append("Missing `name` field")
        if not description:
            issues.append("Missing `description` field")
        if not meta.get("classification.category.primary"):
            issues.append("Missing `classification.category.primary`")
        if not meta.get("audience"):
            issues.append("Missing `audience`")

        category_raw = meta.get("classification.category.primary", "")
        category_display = _normalise_category(category_raw) if category_raw else ""

        audience_raw = meta.get("audience", "")
        audience_display = _normalise_audience(audience_raw) if audience_raw else []

        subdomain = meta.get("catalog.subdomain", "")
        product = meta.get("product.primary", "")
        activity_tags_raw = meta.get("discovery.activity_tags", "")
        activity_tags = [t.strip() for t in activity_tags_raw.split(",") if t.strip()]

        record = {
            "skill_name": name,
            "display_name": name.replace("-", " ").title(),
            "description": description,
            "product": product,
            "nvidia_domain": [category_display] if category_display else [],
            "nvidia_audience": audience_display,
            "nvidia_subdomain": subdomain,
            "nvidia_activity_tags": activity_tags,
            # All skills live in the NVIDIA/skills monorepo
            "github_url": NVIDIA_SKILLS_GITHUB_URL,
            "skill_path": path,  # e.g. "skills/aiq-deploy"
            "nvidia_skill_url": _skill_url(name),
            "source": "nvidia",
        }

        if issues:
            needs_review.append({"record": record, "issues": issues})
        else:
            validated.append(record)

    # ── write nvidia_skills.json ──────────────────────────────────────────────
    SKILLS_JSON.write_text(
        json.dumps(validated, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\n✅ {len(validated)} skills written to {SKILLS_JSON}")

    # ── write nvidia_skills_validation.md ─────────────────────────────────────
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# NVIDIA Skills — Validation Report",
        "",
        f"> Generated: {now}  ",
        f"> Total in metadata.json: **{len(raw_skills)}**  ",
        f"> Ready for batch scan: **{len(validated)}**  ",
        f"> Needs manual review: **{len(needs_review)}**",
        "",
    ]

    if needs_review:
        lines += [
            "## Skills Requiring Manual Review",
            "",
            "These entries were found in `metadata.json` but are missing required fields.",
            "Fix the issues below and re-run the harvester, or manually add them to",
            "`nvidia_skills.json`.",
            "",
            "| Skill Name | Issues | Skill Path |",
            "|------------|--------|------------|",
        ]
        for item in needs_review:
            r = item["record"]
            iss = "; ".join(item["issues"])
            lines.append(f"| `{r['skill_name']}` | {iss} | `{r['skill_path']}` |")
        lines.append("")
    else:
        lines += [
            "## No Skills Require Review 🎉",
            "",
            "All entries passed validation.",
            "",
        ]

    # ── summary by domain ─────────────────────────────────────────────────────
    from collections import Counter

    domain_counts = Counter(
        d for s in validated for d in s["nvidia_domain"]
    )
    audience_counts = Counter(
        a for s in validated for a in s["nvidia_audience"]
    )

    lines += [
        "## Domain Distribution",
        "",
        "| Domain | Count |",
        "|--------|-------|",
    ]
    for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {domain} | {count} |")

    lines += [
        "",
        "## Audience Distribution",
        "",
        "| Audience | Count |",
        "|----------|-------|",
    ]
    for audience, count in sorted(audience_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {audience} | {count} |")

    lines += [
        "",
        "## Full Validated Skill List",
        "",
        "| # | Skill Name | Domain | Product | Audience |",
        "|---|-----------|--------|---------|----------|",
    ]
    for i, s in enumerate(validated, 1):
        domain_str = ", ".join(s["nvidia_domain"])
        audience_str = ", ".join(s["nvidia_audience"])
        lines.append(
            f"| {i} | [{s['skill_name']}]({s['nvidia_skill_url']}) "
            f"| {domain_str} | {s['product']} | {audience_str} |"
        )

    VALIDATION_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"📋 Validation report written to {VALIDATION_MD}")

    if needs_review:
        print(
            f"\n⚠  {len(needs_review)} skills need review — see {VALIDATION_MD}",
            file=sys.stderr,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Harvest NVIDIA/skills metadata")
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub PAT (or set GITHUB_TOKEN env var)",
    )
    args = parser.parse_args()
    harvest(args.token)


if __name__ == "__main__":
    main()
