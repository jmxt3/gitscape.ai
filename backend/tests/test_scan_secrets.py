"""ScapeGuard secrets rules (GS-SEC) — detection + false-positive guard."""
import pytest

from app.skillforge.models import ScanStatus, Severity
from app.skillforge.scan import scan_skill


def _ids(report):
    return {f.id for f in report.findings}


@pytest.mark.parametrize("rule_id,text", [
    ("GS-SEC-001", "aws_key = AKIA" + "ABCDEFGHIJKLMNOP"),
    ("GS-SEC-002", "token: ghp_" + "b" * 36),
    ("GS-SEC-004", "key sk-ant-" + "c" * 24),
    ("GS-SEC-005", "google AIza" + "D" * 35),
    ("GS-SEC-006", "slack xoxb-" + "1234567890-abcdef"),
    ("GS-SEC-007", "stripe sk_live_" + "abcd1234efgh5678"),
    ("GS-SEC-008", "-----BEGIN OPENSSH PRIVATE KEY-----"),
])
def test_secret_formats_detected_and_critical(rule_id, text):
    report = scan_skill(text + "\n", {})
    assert rule_id in _ids(report), report.findings
    finding = next(f for f in report.findings if f.id == rule_id)
    assert finding.severity == Severity.CRITICAL
    assert report.status == ScanStatus.FAIL


def test_aws_docs_example_is_not_a_failure():
    # The canonical AWS documentation example key must never gate a download.
    report = scan_skill("Example only: AKIAIOSFODNN7EXAMPLE\n", {})
    assert report.status == ScanStatus.PASS
    finding = next(f for f in report.findings if f.id == "GS-SEC-001")
    assert finding.severity == Severity.INFO


def test_placeholder_env_example_downgraded():
    report = scan_skill("clean\n", {".env.example": "API_KEY=your-api-key-here-xxxx\n"})
    assert report.status == ScanStatus.PASS


def test_generic_assignment_entropy_gate():
    # low-entropy value -> dropped (not a secret); high-entropy -> HIGH finding
    low = scan_skill('password = "aaaaaaaaaaaaaaaaaa"\n', {})
    assert not any(f.id == "GS-SEC-010" for f in low.findings)
    high = scan_skill('secret = "xQ9fL2mZ8pR4tV6wY1nB3jH5kD7"\n', {})
    assert any(f.id == "GS-SEC-010" for f in high.findings)


def test_owasp_tags_present_on_secret_findings():
    report = scan_skill("ghp_" + "e" * 36 + "\n", {})
    finding = next(f for f in report.findings if f.id == "GS-SEC-002")
    assert "AST05" in finding.owasp_ast
    assert finding.category == "secrets"
