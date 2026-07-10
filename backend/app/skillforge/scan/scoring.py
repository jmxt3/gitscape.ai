"""
Risk score + letter grade — a legible summary layered over the gate.

The score is a weighted sum of findings; the grade (A/B/C/F) is a one-glyph
verdict for manifests, registry pages, and the UI. Both are *display only*:
they never influence `_status_for` or `has_unbypassable_finding`, so the
deterministic PASS/WARN/FAIL gate remains the sole authority on what ships.
The grade clamps to F whenever the gate FAILs, so a single CRITICAL can never
present as a passing "C".

Scoring constants (severity points, executable ×1.3 multiplier) are derived from
NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector), Apache-2.0. The
confidence weighting is a GitScape addition — our Confidence field is
load-bearing, so low-confidence regex hits should not drag a grade down as hard
as a high-confidence one. See THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

from typing import Iterable

from ..models import Confidence, ScanFinding, ScanStatus, Severity

# Points per finding by severity (SkillSpector's table).
SEVERITY_POINTS: dict[Severity, int] = {
    Severity.CRITICAL: 50,
    Severity.HIGH: 25,
    Severity.MEDIUM: 10,
    Severity.LOW: 5,
    Severity.INFO: 0,
}

# Confidence dampener (GitScape): a LOW-confidence hit counts for half.
_CONF_WEIGHT: dict[Confidence, float] = {
    Confidence.LOW: 0.5,
    Confidence.MEDIUM: 0.85,
    Confidence.HIGH: 1.0,
}

# A finding in an executable script weighs more than the same finding in prose
# (SkillSpector's ×1.3). No-op on the compile path today (skills are markdown);
# live once third-party skills with scripts/ are scanned.
_EXEC_MULTIPLIER = 1.3
_EXEC_SUFFIXES = (".py", ".js", ".ts", ".mjs", ".cjs", ".sh", ".bash", ".zsh",
                  ".ps1", ".rb", ".go", ".pl", ".php")

# Cap how many times one (rule, file) pair can contribute, so a single repeated
# pattern can't alone drag a skill from B to F.
_DEDUPE_CAP = 2

# Grade band ceilings for a non-FAIL report.
_GRADE_A_MAX = 0
_GRADE_B_MAX = 20
_GRADE_C_MAX = 50


def _is_executable(file: str) -> bool:
    return file.lower().endswith(_EXEC_SUFFIXES)


def compute_score(findings: Iterable[ScanFinding]) -> int:
    """Weighted 0..∞ risk score. Higher is worse."""
    seen: dict[tuple[str, str], int] = {}
    total = 0.0
    for f in findings:
        base = SEVERITY_POINTS.get(f.severity, 0)
        if base == 0:
            continue
        key = (f.id or f.rule, f.file)
        n = seen.get(key, 0)
        if n >= _DEDUPE_CAP:
            continue
        seen[key] = n + 1
        weight = _CONF_WEIGHT.get(f.confidence, 1.0)
        mult = _EXEC_MULTIPLIER if _is_executable(f.file) else 1.0
        total += base * weight * mult
    return int(round(total))


def grade_for(status: ScanStatus, score: int) -> str:
    """Letter grade. FAIL always clamps to F regardless of score."""
    if status == ScanStatus.FAIL:
        return "F"
    if score <= _GRADE_A_MAX:
        return "A"
    if score <= _GRADE_B_MAX:
        return "B"
    if score <= _GRADE_C_MAX:
        return "C"
    return "F"
