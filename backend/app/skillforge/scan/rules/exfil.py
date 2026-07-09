"""
Data-exfiltration rules (GS-EXF) — secrets/env/files leaving the machine.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ...models import Confidence, Severity
from ..registry import Rule
from ..taxonomy import Category

C = Category.DATA_EXFILTRATION

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
]
