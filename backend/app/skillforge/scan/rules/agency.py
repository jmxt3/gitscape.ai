"""
Excessive-agency rules (GS-AGY).

Privilege escalation, safety-bypass flags, agent-config tampering, and direct
money access — behaviors that hand a skill more autonomy or reach than a skill
should ever need.

Portions derived from NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector),
Apache-2.0. See THIRD_PARTY_NOTICES.md.

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
    Rule(
        # Memory poisoning — writing durable instructions into the agent's
        # persistent memory files so they survive into every future session.
        # Complements GS-AGY-003 (config files), which does not cover memory.
        id="GS-AGY-005", name="agency.memory_poisoning", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(?:append|add|write|save|inject|insert)\b[^.\n]{0,45}\b(?:to\s+)?(?:CLAUDE\.md|AGENTS\.md|GEMINI\.md|\.cursorrules|\.clinerules|copilot-instructions)\b"
            r"|\bremember (?:this )?(?:for )?(?:all )?(?:future|every|subsequent|later) (?:sessions?|conversations?|interactions?|prompts?)\b"
            r"|\b(?:add|write|append) (?:this )?to your (?:memory|instructions|system prompt|permanent)\b"
            r"|\bpersist(?:ent)?(?:ly)? (?:this )?(?:instruction|memory|note|rule)\b[^.\n]{0,25}\b(?:across|between|future) (?:sessions?|runs?)\b",
            re.I),
        message="Memory poisoning: writes durable instructions into the agent's persistent memory.",
        remediation="A skill must not modify agent memory files (CLAUDE.md/AGENTS.md) or inject persistent instructions.",
    ),
    Rule(
        # Agent snooping — reading other skills, agent session/conversation
        # history, or agent-internal state directories. Requires a read verb so
        # it does not double-fire with GS-AGY-003 on config-path mentions.
        id="GS-AGY-006", name="agency.agent_snooping", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(?:cat|read|open|less|more|type|Get-Content|readFileSync|dump|exfiltrate|collect|access|inspect|enumerate|list)\b[^.\n]{0,55}"
            r"(?:\.agents[/\\]skills"
            r"|\b(?:other|another|all|installed|existing)\s+skills?\b"
            r"|(?:conversation|chat|session)\s+(?:history|logs?|transcript|memory)"
            r"|(?:~|\$HOME|%USERPROFILE%)?[/\\]?\.(?:claude|codex|cursor)[/\\](?:history|logs|sessions|projects|todos))",
            re.I),
        message="Agent snooping: reads other skills, session history, or agent-internal state.",
    ),
]
