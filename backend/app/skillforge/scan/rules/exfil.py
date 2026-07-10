"""
Data-exfiltration rules (GS-EXF) — secrets/env/files leaving the machine.

Portions derived from NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector),
Apache-2.0. See THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from typing import Optional

from ...models import Confidence, Severity
from ..registry import DROP, Rule
from ..taxonomy import Category

C = Category.DATA_EXFILTRATION

# Indicators, in a small window around an internal/metadata endpoint, that turn
# a mere mention into an SSRF-to-credential-theft signal. Absent these, an
# endpoint reference is documentation and is downgraded to INFO (won't gate).
_SSRF_CRED_CONTEXT = re.compile(
    r"security-credentials|iam[/\\]|/token\b|access[._-]?key|credential|secret|password|\.env"
    r"|\bsend\b|\bpost\b|\bupload\b|\bexfiltrate\b|\btransmit\b|\bemail\b",
    re.I)


def _refine_internal_endpoint(m: re.Match, text: str, label: str) -> Optional[tuple[Severity, Confidence]]:
    """Keep HIGH only when credential/exfil context surrounds the endpoint;
    otherwise a plain metadata-service mention is documentation → INFO."""
    lo = max(0, m.start() - 140)
    hi = min(len(text), m.end() + 140)
    if _SSRF_CRED_CONTEXT.search(text[lo:hi]):
        return None  # keep declared HIGH/HIGH
    return (Severity.INFO, Confidence.LOW)

RULES: list[Rule] = [
    Rule(
        id="GS-EXF-001", name="exfil.send_secrets", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(send|post|upload|exfiltrate|transmit|email)\b[^.\n]{0,40}\b(token|secret|api[\s_-]?key|password|credential|credentials|\.env|environment variable)\b",
            re.I),
        message="Exfiltration: instruction to send secrets/credentials outward.",
    ),
    Rule(
        id="GS-EXF-002", name="exfil.raw_ip_url", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"https?://\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:/\S*)?", re.I),
        message="Suspicious URL pointing at a raw IP address.",
    ),
    Rule(
        id="GS-EXF-003", name="exfil.known_endpoint", category=C,
        severity=Severity.HIGH, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"webhook\.site|requestbin\.(?:com|net)|pipedream\.net|ngrok(?:-free)?\.app"
            r"|pastebin\.com/raw|discord(?:app)?\.com/api/webhooks|api\.telegram\.org/bot"
            r"|hookb\.in|beeceptor\.com",
            re.I),
        message="Reference to a known data-exfiltration / drop endpoint.",
    ),
    Rule(
        id="GS-EXF-004", name="exfil.env_harvest", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(printenv|env)\b[^\n|]{0,40}\|\s*(curl|wget|nc)"
            r"|os\.environ[^\n]{0,120}(requests\.(post|put)|urlopen)"
            r"|process\.env[^\n]{0,120}fetch\s*\(",
            re.I),
        message="Environment-variable harvesting piped to a network call.",
    ),
    Rule(
        id="GS-EXF-005", name="exfil.sensitive_path", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"(~|\$HOME|%USERPROFILE%)?[/\\]?\.?(ssh/id_[a-z]+|aws/credentials|git-credentials|npmrc)"
            r"|/etc/shadow|\bid_rsa\b",
            re.I),
        message="Reads a sensitive credential file (SSH keys, AWS creds, .npmrc).",
    ),
    Rule(
        # SSRF / cloud-metadata endpoints. The refine keeps this at HIGH only
        # when credential-path or outward-send context is nearby, so a reference
        # doc merely describing the metadata service stays INFO and won't gate.
        id="GS-EXF-006", name="exfil.internal_endpoint", category=C,
        severity=Severity.HIGH, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"169\.254\.169\.254|metadata\.google\.internal|/computeMetadata/v\d"
            r"|/latest/meta-data/|kubernetes\.default\.svc|localhost:2375|127\.0\.0\.1:2375",
            re.I),
        refine=_refine_internal_endpoint,
        message="SSRF: accesses a cloud-metadata / internal service endpoint (credential-theft vector).",
        remediation="Skills must not query instance-metadata endpoints; remove the request.",
    ),
]
