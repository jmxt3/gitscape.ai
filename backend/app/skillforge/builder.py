"""
Build orchestrator: ContentUnits + RepoMeta -> SkillPackage.

Runs the deterministic pipeline end to end (extract → assemble → scan → manifest)
with **zero LLM calls**. The scan report travels with the package; it never raises
on FAIL here — the export/zip step (package.py) enforces the gate so the UI can
still render the report and block the download.

Author: GitScape.ai
"""
from __future__ import annotations

from datetime import datetime, timezone
from app.config import settings

from .assemble import FRAMEWORK_TOKEN_BUDGET, TOKEN_BUDGET, assemble
from .exporters import render_exporters
from .extract import build_extract
from .ingest import BUILDER_VERSION
from .models import FrameworkProseFields, Manifest, ProseFields, RepoMeta, ScanReport, SkillPackage
from .scan import scan_skill

_FRAMEWORKS = ["claude-skills", "google-adk", "agno", "openai-agents", "langchain", "langgraph"]


def build_skill(
    units,
    meta: RepoMeta,
    *,
    digest_hash: str = "",
    token_budget: int = TOKEN_BUDGET,
    enable_semgrep: bool = False,
    prose: ProseFields | None = None,
    framework_prose: FrameworkProseFields | None = None,
    hd: bool = False,
    skill_type: str = "framework",
    prebuilt_references: dict | None = None,
    digest_content: str | None = None,
    prefer_authored: bool = True,
) -> SkillPackage:
    """Build a SkillPackage from content units and repo metadata.

    **Search-or-Compile:** if the repo already ships a maintainer-authored skill
    (a committed `SKILL.md`), scan *that* as-is rather than regenerate a worse
    one (unless prefer_authored=False). Otherwise compile:

    skill_type="framework" (default) triggers the Engineering Skill path:
      - Calls generate_framework_prose() to get all 6 canonical sections from Gemini.
      - Uses FRAMEWORK_TOKEN_BUDGET (10 000 tokens) with no section trimming.
      - Falls back to the Code Skill path if Gemini is unavailable.

    skill_type="code" is the deterministic fallback path with optional LLM
    prose glue when hd=True. Not exposed to users.
    """
    if prefer_authored:
        from .authored import detect_authored_skills
        authored = detect_authored_skills(units)
        if authored:
            return _build_from_authored(
                authored[0], units, meta,
                digest_hash=digest_hash, digest_content=digest_content,
            )

    digest_filename = f"references/{meta.owner}_{meta.repo}_digest.txt".lower().replace("-", "_") if digest_content else None
    extract = build_extract(units, readme=meta.readme)

    if skill_type == "framework":
        # Engineering Skill path — HD only; Gemini generates all 6 sections.
        if framework_prose is None:
            from .hd import generate_framework_prose  # lazy: keeps deterministic path network-free
            framework_prose = generate_framework_prose(meta, extract)
        assembled = assemble(
            meta, extract, units,
            token_budget=FRAMEWORK_TOKEN_BUDGET,
            framework_prose=framework_prose,
            prebuilt_references=prebuilt_references,
            digest_filename=digest_filename,
        )
    else:
        # Code Skill path — deterministic + optional prose glue.
        if prose is None and hd:
            from .hd import generate_prose  # lazy
            prose = generate_prose(meta, extract)
        assembled = assemble(meta, extract, units, token_budget=token_budget, prose=prose, digest_filename=digest_filename)
    scan_report: ScanReport = scan_skill(
        assembled.skill_md, assembled.references, units=units,
        extract=extract, repo_url=meta.repo_url,
        enable_semgrep=enable_semgrep,
        is_framework_skill=(skill_type == "framework"),
    )

    # Optional, env-gated LLM adjudication (advisory only; never changes the
    # deterministic gate). Lazy import keeps the default path network-free.
    from .scan.judge import judge_enabled
    if judge_enabled():
        from .scan.judge import maybe_adjudicate
        scan_report = maybe_adjudicate(scan_report, skill_md=assembled.skill_md)

    generated_at = meta.generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    exporters = render_exporters(meta.owner, meta.repo)

    manifest_files = ["SKILL.md", *assembled.references.keys(), "manifest.json", "scan-report.json", "scan-report.sarif", *exporters.keys()]
    if digest_filename:
        manifest_files.append(digest_filename)

    manifest = Manifest(
        name=assembled.name,
        display_name=f"{meta.owner}/{meta.repo}",
        description=assembled.description,
        builder_version=BUILDER_VERSION,
        digest_hash=digest_hash,
        files=manifest_files,
        provenance=assembled.provenance,
        scan_status=scan_report.status,
        scan_grade=scan_report.grade,
        source="compiled",
        framework_compatibility=_FRAMEWORKS,
        source_git_head=meta.git_sha,
        built_at=generated_at,
        model=settings.HD_MODEL if (hd or skill_type == "framework") else None,
        metadata={
            "source_repo": meta.repo_url,
            "generated_by": "GitScape.ai",
            "generated_by_url": "https://gitscape.ai",
            "generated_at": generated_at,
            "files_analyzed": meta.files_analyzed,
            "primary_languages": meta.primary_languages,
            "symbols_indexed": extract.api_index.total,
            "modules_indexed": len(extract.api_index.modules),
            "scan_engine": scan_report.engine,
            "scan_engine_version": scan_report.engine_version,
            "skill_hash": scan_report.skill_hash,
            "license": scan_report.license.model_dump(mode="json"),
            "summary_title": (
                framework_prose.summary_title
                if (framework_prose and getattr(framework_prose, "summary_title", None))
                else assembled.description
            ),
            "summary_bullets": (
                framework_prose.summary_bullets
                if (framework_prose and getattr(framework_prose, "summary_bullets", []))
                else [
                    f"Specialist guidelines for working with the {meta.repo} codebase.",
                    f"Understanding modules and symbols across {meta.files_analyzed} source files.",
                    f"Adherence to repository setup, structure, and architecture patterns.",
                    "Executing automated tests and verifying codebase changes."
                ]
            ),
        },
    )

    # Manifest signing step
    import json
    from .signing import sign_manifest
    manifest_json_str = json.dumps(manifest.model_dump(mode="json"), indent=2)
    sig_result = sign_manifest(manifest_json_str)
    if sig_result:
        sig_content, bundle_content = sig_result
        assembled.references["manifest.json.sig"] = sig_content
        assembled.references["manifest.json.bundle"] = bundle_content
        manifest.files.append("manifest.json.sig")
        manifest.files.append("manifest.json.bundle")

    return SkillPackage(
        name=assembled.name,
        skill_md=assembled.skill_md,
        references=assembled.references,
        manifest=manifest,
        scan_report=scan_report,
        source="compiled",
        exporters=exporters,
        digest_filename=digest_filename,
        digest_content=digest_content,
    )


def _build_from_authored(authored, units, meta: RepoMeta, *, digest_hash="", digest_content=None) -> SkillPackage:
    """Package a maintainer-authored skill: scan it as-is, no regeneration.

    Script files (`scripts/**`) are scanned on the stricter SCRIPTS surface;
    other files scan as references. The package keeps every authored file so an
    install writes the skill exactly as the maintainer shipped it.
    """
    from .assemble import generate_skill_name

    refs = {k: v for k, v in authored.references.items() if not k.startswith("scripts/")}
    scripts = {k: v for k, v in authored.references.items() if k.startswith("scripts/")}
    scan_report = scan_skill(
        authored.skill_md, refs, units=units, scripts=scripts,
        repo_url=meta.repo_url, is_framework_skill=False,
    )
    from .scan.judge import judge_enabled
    if judge_enabled():
        from .scan.judge import maybe_adjudicate
        scan_report = maybe_adjudicate(scan_report, skill_md=authored.skill_md)

    generated_at = meta.generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    name = authored.name or generate_skill_name(meta.owner, meta.repo)
    description = authored.description or f"{meta.owner}/{meta.repo} — maintainer-authored agent skill."
    files = ["SKILL.md", *authored.references.keys(), "manifest.json", "scan-report.json", "scan-report.sarif"]

    manifest = Manifest(
        name=name,
        display_name=f"{meta.owner}/{meta.repo}",
        description=description,
        builder_version=BUILDER_VERSION,
        digest_hash=digest_hash,
        files=files,
        scan_status=scan_report.status,
        scan_grade=scan_report.grade,
        source="authored",
        framework_compatibility=_FRAMEWORKS,
        source_git_head=meta.git_sha,
        built_at=generated_at,
        metadata={
            "source_repo": meta.repo_url,
            "generated_by": "GitScape.ai",
            "generated_by_url": "https://gitscape.ai",
            "generated_at": generated_at,
            "authored_skill_dir": authored.dir or ".",
            "scan_engine": scan_report.engine,
            "scan_engine_version": scan_report.engine_version,
            "skill_hash": scan_report.skill_hash,
            "license": scan_report.license.model_dump(mode="json"),
        },
    )

    # Manifest signing step
    import json
    from .signing import sign_manifest
    manifest_json_str = json.dumps(manifest.model_dump(mode="json"), indent=2)
    sig_result = sign_manifest(manifest_json_str)
    if sig_result:
        sig_content, bundle_content = sig_result
        authored.references["manifest.json.sig"] = sig_content
        authored.references["manifest.json.bundle"] = bundle_content
        manifest.files.append("manifest.json.sig")
        manifest.files.append("manifest.json.bundle")

    return SkillPackage(
        name=name,
        skill_md=authored.skill_md,
        references=authored.references,
        manifest=manifest,
        scan_report=scan_report,
        source="authored",
        digest_content=digest_content,
    )
