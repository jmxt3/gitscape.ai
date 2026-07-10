"""
SARIF 2.1.0 export.

Renders a ScanReport as a SARIF log so ScapeGuard findings drop straight into
GitHub Code Scanning, VS Code SARIF viewers, and any SARIF-aware CI. One run,
tool.driver = ScapeGuard, rules taken from the registry, results from findings.

Author: GitScape.ai
"""
from __future__ import annotations

from ..models import ScanReport, Severity
from .rules import ALL_RULES
from .taxonomy import info

_SARIF_LEVEL = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "note",
    Severity.INFO: "note",
}

_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"


def _rule_descriptors() -> tuple[list[dict], dict[str, int]]:
    """Build reportingDescriptor entries + an id→index map for ruleIndex."""
    descriptors: list[dict] = []
    index: dict[str, int] = {}
    seen: set[str] = set()
    for rule in ALL_RULES:
        if rule.id in seen:
            continue
        seen.add(rule.id)
        ci = info(rule.category)
        index[rule.id] = len(descriptors)
        descriptors.append({
            "id": rule.id,
            "name": rule.name,
            "shortDescription": {"text": rule.message},
            "defaultConfiguration": {"level": _SARIF_LEVEL.get(rule.severity, "warning")},
            "properties": {
                "category": rule.category.value,
                "owasp-ast": list(ci.owasp_ast),
                "owasp-llm": list(ci.owasp_llm),
                "tags": [rule.category.value, *ci.owasp_ast, *ci.owasp_llm],
            },
        })
    return descriptors, index


def to_sarif(report: ScanReport, *, engine: str = "ScapeGuard", version: str = "") -> dict:
    descriptors, index = _rule_descriptors()
    version = version or report.engine_version or "2.0.0"

    results: list[dict] = []
    for f in report.findings:
        result: dict = {
            "ruleId": f.id or f.rule,
            "level": _SARIF_LEVEL.get(f.severity, "warning"),
            "message": {"text": f.message},
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": {"uri": f.source_path or f.file},
                    "region": {"startLine": max(f.line, 1)},
                }
            }],
            "properties": {
                "category": f.category,
                "confidence": f.confidence.value if hasattr(f.confidence, "value") else str(f.confidence),
                "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
                "owasp-ast": f.owasp_ast,
                "owasp-llm": f.owasp_llm,
                "skillFile": f.file,
            },
        }
        if (f.id or f.rule) in index:
            result["ruleIndex"] = index[f.id]
        results.append(result)

    return {
        "$schema": _SCHEMA,
        "version": "2.1.0",
        "runs": [{
            "tool": {
                "driver": {
                    "name": engine,
                    "version": version,
                    "informationUri": "https://gitscape.ai",
                    "rules": descriptors,
                }
            },
            "results": results,
            "properties": {
                "skillHash": report.skill_hash,
                "status": report.status.value,
                "riskScore": report.risk_score,
                "grade": report.grade,
                "filesScanned": report.files_scanned,
            },
        }],
    }
