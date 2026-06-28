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

from .assemble import TOKEN_BUDGET, assemble
from .exporters import render_exporters
from .extract import build_extract
from .ingest import BUILDER_VERSION
from .models import Manifest, ProseFields, RepoMeta, ScanReport, SkillPackage
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
    hd: bool = False,
) -> SkillPackage:
    extract = build_extract(units, readme=meta.readme)
    if prose is None and hd:
        from .hd import generate_prose  # lazy: keeps the deterministic path network-free

        prose = generate_prose(meta, extract)
    assembled = assemble(meta, extract, units, token_budget=token_budget, prose=prose)
    scan_report: ScanReport = scan_skill(
        assembled.skill_md, assembled.references, units=units, enable_semgrep=enable_semgrep
    )

    generated_at = meta.generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    exporters = render_exporters(meta.owner, meta.repo)

    manifest = Manifest(
        name=assembled.name,
        display_name=f"{meta.owner}/{meta.repo}",
        description=assembled.description,
        builder_version=BUILDER_VERSION,
        digest_hash=digest_hash,
        files=["SKILL.md", *assembled.references.keys(), "manifest.json", *exporters.keys()],
        provenance=assembled.provenance,
        scan_status=scan_report.status,
        framework_compatibility=_FRAMEWORKS,
        metadata={
            "source_repo": meta.repo_url,
            "generated_by": "GitScape.ai",
            "generated_by_url": "https://gitscape.ai",
            "generated_at": generated_at,
            "files_analyzed": meta.files_analyzed,
            "primary_languages": meta.primary_languages,
            "symbols_indexed": extract.api_index.total,
            "modules_indexed": len(extract.api_index.modules),
        },
    )

    return SkillPackage(
        name=assembled.name,
        skill_md=assembled.skill_md,
        references=assembled.references,
        manifest=manifest,
        scan_report=scan_report,
        exporters=exporters,
    )
