"""
Prompt-injection rules (GS-INJ) — instruction-layer attacks in skill prose.

The digest is repo-derived and untrusted: an injection planted in a README or
docstring can flow into SKILL.md and then into a user's agent context. These
pattern rules stop that at the trust gate.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ...models import Confidence, Severity
from ..registry import REFERENCES, SCRIPTS, SKILL_MD, Rule
from ..taxonomy import Category

C = Category.PROMPT_INJECTION

RULES: list[Rule] = [
    Rule(
        id="GS-INJ-001", name="injection.ignore_previous", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|preceding|earlier|all)\b[^.\n]{0,40}\b(instruction|instructions|prompt|prompts|direction|directions|context|rules?)\b",
            re.I),
        message="Prompt-injection: attempt to override prior instructions.",
        remediation="Remove the override instruction from the source doc; it must not reach the agent.",
    ),
    Rule(
        id="GS-INJ-002", name="injection.reveal_system_prompt", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\b(reveal|show|print|repeat|leak|disclose)\b[^.\n]{0,30}\b(system|developer)\b[^.\n]{0,15}\bprompt\b",
            re.I),
        message="Prompt-injection: attempt to exfiltrate the system prompt.",
    ),
    Rule(
        id="GS-INJ-003", name="injection.persona_override", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\byou are now\b|\bact as (an?|the)\b[^.\n]{0,30}\b(assistant|ai|model|dan)\b|\bnew (system )?persona\b",
            re.I),
        message="Prompt-injection: hidden persona/role override.",
    ),
    Rule(
        # Role-tag XML in reference files is almost always legitimate API
        # documentation (chat schemas, OpenAPI specs); the engine downgrades
        # this to INFO outside SKILL.md via the `applies_to` split below.
        id="GS-INJ-004", name="injection.role_tags", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"<\/?(system|assistant|user|tool)>|\[/?INST\]|<\|im_(start|end)\|>", re.I),
        message="Prompt-injection: embedded chat role/control tags.",
    ),
    Rule(
        id="GS-INJ-005", name="injection.execute_the_following", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"\b(run|execute|eval)\b[^.\n]{0,25}\bthe following\b", re.I),
        message="Prompt-injection: instruction to execute the following commands.",
    ),
]
