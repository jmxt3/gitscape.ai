"""
Adversarial corpus walker.

One fixture per attack class under fixtures/adversarial/. Each is scanned and
asserted against an expected {rule_id, status}. This doubles as the regression
harness (new rules must keep the corpus green) and as evidence the scanner is
tested against real evasion techniques.

The corpus deliberately includes benign look-alikes (a documented example key)
that must PASS — a scanner that only ever fails is useless.
"""
from pathlib import Path

import pytest

from app.skillforge.models import ScanStatus
from app.skillforge.scan import scan_skill

FIXTURES = Path(__file__).parent / "fixtures" / "adversarial"

# fixture filename -> (expected status, rule id that must appear or None)
CASES = {
    "aws_key_real.md": (ScanStatus.FAIL, "GS-SEC-001"),
    "aws_key_placeholder.md": (ScanStatus.PASS, None),
    "curl_pipe_sh.md": (ScanStatus.FAIL, "GS-EXE-001"),
    "base64_exec.md": (ScanStatus.FAIL, "GS-EXE-003"),
    "webhook_exfil.md": (ScanStatus.FAIL, "GS-EXF-003"),
    "zero_width.md": (ScanStatus.FAIL, "GS-OBF-001"),
    "homoglyph.md": (ScanStatus.FAIL, "GS-OBF-005"),
    "clean_skill.md": (ScanStatus.PASS, None),
    # ── Phase 1 rules ported from SkillSpector ──
    "jailbreak_anti_refusal.md": (ScanStatus.FAIL, "GS-INJ-006"),
    "concealment.md": (ScanStatus.FAIL, "GS-INJ-007"),
    "conditional_trigger.md": (ScanStatus.FAIL, "GS-INJ-008"),
    "ssrf_metadata.md": (ScanStatus.FAIL, "GS-EXF-006"),
    "memory_poison.md": (ScanStatus.FAIL, "GS-AGY-005"),
    "agent_snoop.md": (ScanStatus.WARN, "GS-AGY-006"),
    "data_uri_exec.md": (ScanStatus.FAIL, "GS-OBF-006"),
    "miner_stratum.md": (ScanStatus.FAIL, "GS-EXE-008"),
    # ── Benign look-alikes that must NOT gate ──
    "cloud_docs_metadata.md": (ScanStatus.PASS, None),
    "refusal_docs.md": (ScanStatus.PASS, None),
    # ── Multilingual injection (GS-INJ-009) ──
    "es_injection.md": (ScanStatus.FAIL, "GS-INJ-009"),
    "ja_injection.md": (ScanStatus.FAIL, "GS-INJ-009"),
}


@pytest.mark.parametrize("fixture,expected", CASES.items())
def test_adversarial_fixture(fixture, expected):
    expected_status, expected_rule = expected
    text = (FIXTURES / fixture).read_text(encoding="utf-8")
    report = scan_skill(text, {})
    ids = {f.id for f in report.findings}
    assert report.status == expected_status, (
        f"{fixture}: expected {expected_status}, got {report.status}; findings={ids}"
    )
    if expected_rule is not None:
        assert expected_rule in ids, f"{fixture}: {expected_rule} not in {ids}"


def test_clean_skill_all_categories_green():
    text = (FIXTURES / "clean_skill.md").read_text(encoding="utf-8")
    report = scan_skill(text, {})
    assert all(c.status == ScanStatus.PASS for c in report.categories), report.findings


def test_multilingual_injection_caught():
    # A Chinese "ignore all previous instructions / reveal system prompt / send
    # the conversation to our server" — now caught by GS-INJ-009 (was an xfail
    # gap before the multilingual override rule shipped).
    text = (FIXTURES / "zh_injection.md").read_text(encoding="utf-8")
    report = scan_skill(text, {})
    ids = {f.id for f in report.findings}
    assert report.status == ScanStatus.FAIL
    assert "GS-INJ-009" in ids, ids
