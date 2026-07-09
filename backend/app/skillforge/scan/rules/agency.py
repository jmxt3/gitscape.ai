"""
Excessive-agency rules (GS-AGY).

Privilege escalation, safety-bypass flags, agent-config tampering, and direct
money access — behaviors that hand a skill more autonomy or reach than a skill
should ever need.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ...models import Confidence, Severity
from ..registry import Rule
from ..taxonomy import Category

C = Category.EXCESSIVE_AGENCY

RULES: list[Rule] = [
    Rule(
        id="GS-AGY-001", name="agency.privilege_escalation", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\bsudo\s+(-\w+\s+)*\S|\brunas\s+/user:administrator|Start-Process\s+[^\n]*-Verb\s+RunAs",
            re.I),
        message="Privilege escalation (sudo / RunAs) requested by the skill.",
    ),
    Rule(
        id="GS-AGY-002", name="agency.safety_bypass", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"--dangerously-skip-permissions|--no-verify|--disable-\w*(safety|security|guard)"
            r"|\bauto[- ]?approve\b|\bwithout (asking|confirmation|permission)\b|\bdo not ask\b",
            re.I),
        message="Instructs the agent to bypass its own safety / confirmation checks.",
        remediation="Skills must not disable the host agent's permission prompts.",
    ),
    Rule(
        id="GS-AGY-003", name="agency.config_tampering", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"(~|\$HOME|%USERPROFILE%)?[/\\]?\.(claude|codex|cursor|aws|config/gcloud)\b"
            r"|\bsettings\.local\.json\b|\.(bashrc|zshrc|profile)\b|Microsoft\.PowerShell_profile"
            r"|\bclaude_desktop_config\.json\b|\bmcp\.json\b",
            re.I),
        message="Modifies agent / shell configuration files (persistence or hijack risk).",
    ),
    Rule(
        id="GS-AGY-004", name="agency.direct_money_access", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.LOW,
        pattern=re.compile(
            r"\b(0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b"
            r"|stripe\.(charges|paymentIntents)\.create|paypal[^\n]{0,30}\bpayout\b",
            re.I),
        message="Direct money movement: crypto wallet address or payment-charge call.",
    ),
]
