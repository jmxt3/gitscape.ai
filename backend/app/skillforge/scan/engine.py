"""
ScapeGuard engine — the trust layer.

Pure-Python, deterministic, zero-LLM static analysis over the *generated* skill
(SKILL.md + references/*.md + any shipped script). The digest is repo-derived
and untrusted, so an injection planted in a README/docstring can flow into
SKILL.md and then into a user's agent context. This gate stops that.

Severity → status:  CRITICAL/HIGH → FAIL, MEDIUM/LOW → WARN, INFO → PASS.
FAIL blocks export (package.build_zip); WARN requires explicit user acceptance.
A CRITICAL finding that is not low-confidence is *never* bypassable.

`semgrep` remains an optional, lazy hook over runnable scripts (off by default).

Author: GitScape.ai
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Iterable, Optional

from ..models import (
    CategoryResult,
    ContentUnit,
    Extract,
    ScanFinding,
    ScanReport,
    ScanStatus,
    Severity,
)
from .context import ScanContext, line_of
from .license_detect import detect_license
from .rules import CHECK_RULES, PATTERN_RULES
from .registry import DROP, REFERENCES, SCRIPTS, SKILL_MD
from .taxonomy import CATEGORIES, Category, info

ENGINE_NAME = "scapeguard"
ENGINE_VERSION = "2.0.0"


# ─── status math ─────────────────────────────────────────────────────────────


def _status_for(findings: Iterable[ScanFinding]) -> ScanStatus:
    sevs = {f.severity for f in findings}
    if sevs & {Severity.CRITICAL, Severity.HIGH}:
        return ScanStatus.FAIL
    if sevs & {Severity.MEDIUM, Severity.LOW}:
        return ScanStatus.WARN
    return ScanStatus.PASS


def _skill_hash(skill_md: str, references: dict) -> str:
    h = hashlib.sha256()
    h.update(skill_md.encode("utf-8", "replace"))
    for name in sorted(references or {}):
        h.update(b"\0")
        h.update(name.encode("utf-8", "replace"))
        h.update(b"\0")
        h.update((references[name] or "").encode("utf-8", "replace"))
    return "sha256:" + h.hexdigest()


def _attribute(snippet: str, units: Optional[Iterable[ContentUnit]]) -> Optional[str]:
    """Best-effort: find which source file the offending text came from."""
    if not units:
        return None
    norm = " ".join(snippet.lower().split())
    if not norm:
        return None
    for u in units:
        if norm in " ".join(u.content.lower().split()):
            return u.path
    return None


# ─── pattern scanning ────────────────────────────────────────────────────────


def _scan_pattern_rules(surfaces: list[tuple[str, str, str]]) -> list[ScanFinding]:
    findings: list[ScanFinding] = []
    for label, text, surface in surfaces:
        is_instruction_file = (surface == SKILL_MD)
        for rule in PATTERN_RULES:
            if surface not in rule.applies_to:
                continue
            for m in rule.pattern.finditer(text):
                severity = None
                confidence = None
                if rule.refine is not None:
                    refined = rule.refine(m, text, label)
                    if refined is DROP:
                        continue  # rule chose to discard this match
                    if refined is not None:
                        severity, confidence = refined
                    # refined is None → keep the rule's declared severity
                # Role-tag XML in reference/lookup files is almost always
                # legitimate API documentation; downgrade so it never gates.
                if rule.name == "injection.role_tags" and not is_instruction_file:
                    severity = Severity.INFO
                findings.append(rule.finding(
                    file=label, line=line_of(text, m.start()),
                    snippet=m.group(0), severity=severity, confidence=confidence,
                ))
    return findings


def _semgrep_scan(scripts: dict[str, str]) -> list[ScanFinding]:
    """Optional hostile-code scan over shipped scripts. No-op if semgrep absent."""
    try:
        import importlib.util

        if importlib.util.find_spec("semgrep") is None:
            return []
    except Exception:
        return []
    # Lazy, best-effort hook; the static rules above remain the always-on layer.
    return []


# ─── category verdicts ───────────────────────────────────────────────────────


def _category_results(findings: list[ScanFinding], is_framework_skill: bool) -> list[CategoryResult]:
    """One row per taxonomy category — including green (PASS) rows for the
    categories that were checked and came back clean (the UI shows what ran)."""
    by_cat: dict[str, list[ScanFinding]] = {}
    for f in findings:
        by_cat.setdefault(f.category, []).append(f)
    results: list[CategoryResult] = []
    for cat in CATEGORIES:
        if cat == Category.STRUCTURE and not is_framework_skill:
            continue
        cat_findings = by_cat.get(cat.value, [])
        results.append(CategoryResult(
            category=cat.value,
            status=_status_for(cat_findings),
            findings=len(cat_findings),
        ))
    return results


def _counts(findings: list[ScanFinding]) -> dict[str, int]:
    out: dict[str, int] = {}
    for f in findings:
        out[f.severity.value] = out.get(f.severity.value, 0) + 1
    return out


# ─── public API ──────────────────────────────────────────────────────────────


def scan_skill(
    skill_md: str,
    references: dict[str, str],
    *,
    units: Optional[list[ContentUnit]] = None,
    scripts: Optional[dict[str, str]] = None,
    extract: Optional[Extract] = None,
    repo_url: str = "",
    enable_semgrep: bool = False,
    is_framework_skill: bool = False,
) -> ScanReport:
    """Scan the assembled skill and return a gated ScapeGuard report.

    When *is_framework_skill* is True, structural-quality checks run against the
    6 canonical sections (MEDIUM/WARN) so the user can still export but is told
    of any gaps.
    """
    references = references or {}
    scripts = scripts or {}

    surfaces: list[tuple[str, str, str]] = [("SKILL.md", skill_md, SKILL_MD)]
    surfaces.extend((name, content, REFERENCES) for name, content in references.items())
    surfaces.extend((name, content, SCRIPTS) for name, content in scripts.items())

    ctx = ScanContext(
        skill_md=skill_md, references=references, scripts=scripts,
        units=units, extract=extract, repo_url=repo_url,
        is_framework_skill=is_framework_skill,
    )

    findings: list[ScanFinding] = []
    findings.extend(_scan_pattern_rules(surfaces))
    for rule in CHECK_RULES:
        findings.extend(rule.check(ctx, rule))

    if enable_semgrep and scripts:
        findings.extend(_semgrep_scan(scripts))

    # attribute findings back to originating repo files
    for f in findings:
        f.source_path = _attribute(f.snippet, units)

    return ScanReport(
        status=_status_for(findings),
        findings=findings,
        engine=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        skill_hash=_skill_hash(skill_md, references),
        files_scanned=len(surfaces),
        categories=_category_results(findings, is_framework_skill),
        counts=_counts(findings),
        license=detect_license(units),
    )
