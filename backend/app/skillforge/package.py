"""
Package stage: zip the skill, enforcing the ScapeGuard trust gate.

Gate policy:
  * An "active payload" CRITICAL finding — a live credential, a remote-code-
    execution payload, or a known exfiltration endpoint — that is not low-
    confidence is an UNBYPASSABLE FAIL: the zip is never produced, even with
    bypass_scan_gate=True ("live credentials and RCE payloads never ship").
    These categories have format-specific, near-zero-false-positive detections,
    so a hard block is safe.
  * Every other FAIL (HIGH severity, or instruction-layer CRITICALs like prompt
    injection whose prose detection is fuzzier) is bypassable via an explicit
    user accept — a false positive must never become a permanent hard block.
  * WARN packages normally; the UI requires explicit acceptance before download.

Every produced zip carries its own `scan-report.json` so the audit travels with
the skill.

Author: GitScape.ai
"""
from __future__ import annotations

import io
import json
import zipfile

from .errors import ScanBlocked
from .models import Confidence, ScanReport, ScanStatus, Severity, SkillPackage

# Categories whose CRITICAL findings can NEVER be shipped. These are the active-
# payload detections (format-specific keys, RCE, drop endpoints) where a high/
# medium-confidence match is effectively certain.
_UNBYPASSABLE_CATEGORIES = frozenset({
    "secrets",
    "malicious_execution",
    "data_exfiltration",
})


def has_unbypassable_finding(report: ScanReport) -> bool:
    """True when the report contains an active-payload CRITICAL we won't ship.

    Low-confidence CRITICAL hits, and CRITICALs outside the active-payload
    categories (e.g. prompt injection), stay bypassable so a regex false
    positive can still be accepted by the user rather than blocking forever.
    """
    return any(
        f.severity == Severity.CRITICAL
        and f.confidence != Confidence.LOW
        and f.category in _UNBYPASSABLE_CATEGORIES
        for f in report.findings
    )


def is_bypassable(report: ScanReport) -> bool:
    """Whether the UI may offer an accept-and-download path for a FAIL report."""
    return not has_unbypassable_finding(report)


def build_zip(pkg: SkillPackage, *, allow_warn: bool = True, bypass_scan_gate: bool = False) -> io.BytesIO:
    """Serialize a SkillPackage to an in-memory ZIP.

    Raises:
        ScanBlocked: on an unbypassable CRITICAL finding (always); or, when
            bypass_scan_gate is False, on FAIL, or WARN when allow_warn is False.
    """
    report = pkg.scan_report
    status = report.status

    # Unbypassable critical findings block unconditionally.
    if has_unbypassable_finding(report):
        raise ScanBlocked(report)

    if not bypass_scan_gate:
        if status == ScanStatus.FAIL or (status == ScanStatus.WARN and not allow_warn):
            raise ScanBlocked(report)

    root = pkg.name
    manifest_json = json.dumps(pkg.manifest.model_dump(mode="json"), indent=2, ensure_ascii=False)
    scan_report_json = json.dumps(report.model_dump(mode="json"), indent=2, ensure_ascii=False)

    # SARIF ships alongside the JSON report for GitHub Code Scanning / CI import.
    from .scan.sarif import to_sarif

    sarif_json = json.dumps(to_sarif(report), indent=2, ensure_ascii=False)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{root}/SKILL.md", pkg.skill_md)
        for relpath, content in pkg.references.items():
            zf.writestr(f"{root}/{relpath}", content)
        for relpath, content in pkg.exporters.items():
            zf.writestr(f"{root}/{relpath}", content)
        zf.writestr(f"{root}/manifest.json", manifest_json)
        zf.writestr(f"{root}/scan-report.json", scan_report_json)
        zf.writestr(f"{root}/scan-report.sarif", sarif_json)

    buffer.seek(0)
    return buffer
