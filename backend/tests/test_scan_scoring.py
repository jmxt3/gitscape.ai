"""
Risk score + letter grade tests (ScapeGuard v2.1).

Covers the band boundaries, the FAIL→F clamp, the executable multiplier, the
dedupe cap, and — most importantly — the invariant that score/grade never
influence the deterministic gate.
"""
from app.skillforge.models import Confidence, ScanFinding, ScanStatus, Severity
from app.skillforge.package import has_unbypassable_finding
from app.skillforge.scan import scan_skill
from app.skillforge.scan.scoring import compute_score, grade_for


def _f(severity, confidence=Confidence.HIGH, file="SKILL.md", rid="GS-X-001"):
    return ScanFinding(rule="t", id=rid, category="c", severity=severity,
                       confidence=confidence, file=file)


# ── grade bands ──────────────────────────────────────────────────────────────

def test_no_findings_grades_a():
    assert compute_score([]) == 0
    assert grade_for(ScanStatus.PASS, 0) == "A"


def test_info_only_grades_a():
    # INFO carries 0 points → clean score → A.
    findings = [_f(Severity.INFO, Confidence.LOW)]
    assert compute_score(findings) == 0
    assert grade_for(ScanStatus.PASS, compute_score(findings)) == "A"


def test_low_medium_bands():
    # One LOW (5 * 0.5 = 2.5 → 2) → B.
    assert grade_for(ScanStatus.WARN, compute_score([_f(Severity.LOW, Confidence.LOW)])) == "B"
    # Several MEDIUMs push into C without any HIGH/CRITICAL (so status is WARN).
    meds = [_f(Severity.MEDIUM, Confidence.HIGH, rid=f"GS-M-{i}") for i in range(4)]
    score = compute_score(meds)  # 4 * 10 * 1.0 = 40
    assert score == 40
    assert grade_for(ScanStatus.WARN, score) == "C"


def test_warn_only_can_still_grade_f():
    # A pile of MEDIUMs (>50 pts) is WARN by the gate but grades F by score.
    meds = [_f(Severity.MEDIUM, Confidence.HIGH, rid=f"GS-M-{i}") for i in range(6)]
    score = compute_score(meds)  # 60
    assert score > 50
    assert grade_for(ScanStatus.WARN, score) == "F"


def test_fail_always_clamps_to_f():
    # Even a tiny score, when the gate FAILs, must present as F.
    assert grade_for(ScanStatus.FAIL, 0) == "F"
    assert grade_for(ScanStatus.FAIL, 5) == "F"


def test_single_critical_is_f_not_c():
    findings = [_f(Severity.CRITICAL)]
    # A CRITICAL always FAILs the gate, so the grade must be F (never C at 50).
    assert grade_for(ScanStatus.FAIL, compute_score(findings)) == "F"


# ── weighting ────────────────────────────────────────────────────────────────

def test_confidence_dampens_score():
    high = compute_score([_f(Severity.HIGH, Confidence.HIGH)])
    low = compute_score([_f(Severity.HIGH, Confidence.LOW)])
    assert high == 25
    assert low < high  # 25 * 0.5 = 12


def test_executable_multiplier():
    prose = compute_score([_f(Severity.HIGH, Confidence.HIGH, file="SKILL.md")])
    script = compute_score([_f(Severity.HIGH, Confidence.HIGH, file="setup.py")])
    assert script > prose  # 25 * 1.3 = 32 vs 25


def test_dedupe_cap():
    # The same (rule, file) repeated 5× counts at most twice.
    dupes = [_f(Severity.MEDIUM, Confidence.HIGH) for _ in range(5)]
    assert compute_score(dupes) == 20  # 2 * 10, not 5 * 10


# ── the invariant: score is display-only ─────────────────────────────────────

def test_score_does_not_affect_status_or_gate():
    # A high-score WARN report must stay WARN and stay shippable.
    text = "\n".join(f"TODO item {i} eval(" for i in range(8))
    report = scan_skill(text, {})
    # dynamic_eval is MEDIUM/LOW → WARN regardless of how high the score climbs
    assert report.status == ScanStatus.WARN
    assert not has_unbypassable_finding(report)
    # grade reflects the score, but the gate is untouched
    assert report.grade in {"A", "B", "C", "F"}


def test_clean_skill_scores_zero_and_grades_a():
    text = (
        "# CSV Toolkit\n\nA small local library for reading and writing CSV "
        "files with no network access. Use read_csv(path) and write_csv(path, rows)."
    )
    report = scan_skill(text, {})
    assert report.status == ScanStatus.PASS
    assert report.risk_score == 0
    assert report.grade == "A"
