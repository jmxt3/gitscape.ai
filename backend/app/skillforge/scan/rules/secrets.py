"""
Secrets rules (GS-SEC) — hardcoded credentials in the shipped skill.

Makes the landing-page promise ("secrets and credentials detected") literally
true. Every rule runs against SKILL.md, references, and scripts. The shared
`refine` guard keeps this safe to hard-block on: documented example keys,
angle-bracket placeholders, and `.env.example` sources are downgraded to INFO
so they never gate a legitimate download.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from typing import Optional

from ...models import Confidence, Severity
from ..context import shannon_entropy
from ..registry import DROP, Rule
from ..taxonomy import Category

C = Category.SECRETS

# ── false-positive guard ────────────────────────────────────────────────────

_PLACEHOLDER = re.compile(
    r"example|sample|placeholder|your[-_ ]?(api|key|token|secret)|xxxx|changeme|"
    r"redacted|dummy|test[-_]?key|<[^>]+>|\.\.\.|\bnnnn\b|abcdef123456|0{6,}",
    re.I,
)
_DOC_EXAMPLE_KEYS = {
    "AKIAIOSFODNN7EXAMPLE",  # canonical AWS docs example
    "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
}


def _looks_like_placeholder(value: str, label: str) -> bool:
    if value in _DOC_EXAMPLE_KEYS:
        return True
    if _PLACEHOLDER.search(value):
        return True
    low = label.lower()
    if low.endswith((".env.example", ".env.sample", ".sample", ".example")):
        return True
    return False


def _refine_secret(m: re.Match, text: str, label: str) -> Optional[tuple[Severity, Confidence]]:
    """Downgrade obvious non-secrets to INFO (never drop — surfacing helps)."""
    if _looks_like_placeholder(m.group(0), label):
        return (Severity.INFO, Confidence.LOW)
    return None  # keep the rule's declared severity/confidence


def _refine_generic_assignment(
    m: re.Match, text: str, label: str
) -> Optional[tuple[Severity, Confidence]]:
    """Generic key=value: only fire when the value looks random (entropy gate)."""
    value = m.group("val")
    if _looks_like_placeholder(value, label):
        return (Severity.INFO, Confidence.LOW)
    if shannon_entropy(value) < 3.5:
        return DROP  # low-entropy value: almost certainly not a real secret
    return (Severity.HIGH, Confidence.MEDIUM)


RULES: list[Rule] = [
    Rule(
        id="GS-SEC-001", name="secrets.aws_access_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\bAKIA[0-9A-Z]{16}\b"), refine=_refine_secret,
        message="Hardcoded AWS access key ID.",
        remediation="Rotate the key immediately and load credentials from the environment.",
    ),
    Rule(
        id="GS-SEC-002", name="secrets.github_token", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b"),
        refine=_refine_secret, message="Hardcoded GitHub token.",
        remediation="Revoke the token on GitHub and use a secrets manager.",
    ),
    Rule(
        id="GS-SEC-003", name="secrets.openai_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b"), refine=_refine_secret,
        message="Hardcoded OpenAI API key.",
    ),
    Rule(
        id="GS-SEC-004", name="secrets.anthropic_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"), refine=_refine_secret,
        message="Hardcoded Anthropic API key.",
    ),
    Rule(
        id="GS-SEC-005", name="secrets.google_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), refine=_refine_secret,
        message="Hardcoded Google API key.",
    ),
    Rule(
        id="GS-SEC-006", name="secrets.slack_token", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"), refine=_refine_secret,
        message="Hardcoded Slack token.",
    ),
    Rule(
        id="GS-SEC-007", name="secrets.stripe_live_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"\b[sr]k_live_[A-Za-z0-9]{16,}\b"), refine=_refine_secret,
        message="Hardcoded Stripe live secret key.",
    ),
    Rule(
        id="GS-SEC-008", name="secrets.private_key", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----"), refine=_refine_secret,
        message="Embedded PEM private key.",
    ),
    Rule(
        id="GS-SEC-009", name="secrets.jwt", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.LOW,
        pattern=re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
        refine=_refine_secret, message="JSON Web Token (JWT) in shipped text.",
    ),
    Rule(
        id="GS-SEC-010", name="secrets.generic_assignment", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"(?i)(api[_-]?key|secret|passwd|password|access[_-]?token|auth[_-]?token)\s*[:=]\s*['\"](?P<val>[^'\"\s]{16,})['\"]"),
        refine=_refine_generic_assignment,
        message="Hardcoded secret assigned to a credential-named variable.",
    ),
]
