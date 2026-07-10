"""
Prompt-injection rules (GS-INJ) — instruction-layer attacks in skill prose.

The digest is repo-derived and untrusted: an injection planted in a README or
docstring can flow into SKILL.md and then into a user's agent context. These
pattern rules stop that at the trust gate.

Portions derived from NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector),
Apache-2.0. See THIRD_PARTY_NOTICES.md.

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
    Rule(
        # Anti-refusal / jailbreak framing — instructing the agent to drop its
        # safety guidelines or adopt an unrestricted persona (DAN and kin).
        id="GS-INJ-006", name="injection.anti_refusal", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\byou (?:must|will) (?:always )?(?:comply|obey)\b"
            r"|\b(?:never|do not|don't) (?:refuse|decline|reject|say no)\b"
            r"|\byou have no (?:restrictions|limitations|filters|guidelines|rules)\b"
            r"|\bignore your (?:guidelines|training|safety|restrictions|programming|policies)\b"
            r"|\b(?:enable|activate|enter) (?:dan|developer|jailbreak|unrestricted) mode\b"
            r"|\byou are (?:now )?dan\b",
            re.I),
        message="Prompt-injection: anti-refusal / jailbreak framing (disable safety, unrestricted persona).",
        remediation="Remove the jailbreak framing from the source doc; it must not reach the agent.",
    ),
    Rule(
        # Concealment — instructing the agent to hide an action from the user.
        # SkillSpector's highest-signal tool-poisoning cue; a legitimate skill
        # never needs the agent to keep something from its own operator.
        id="GS-INJ-007", name="injection.concealment", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\b(?:do not|don't|never)\b[^.\n]{0,30}\b(?:tell|inform|notify|alert|warn|reveal to|disclose to|mention (?:this|it) to)\b[^.\n]{0,20}\b(?:the )?(?:user|human|operator|developer)\b"
            r"|\bwithout (?:telling|informing|notifying|alerting|the user's knowledge|the user knowing|asking the user)\b"
            r"|\bkeep (?:this|it) (?:hidden|secret|concealed)\b[^.\n]{0,25}\b(?:user|them|operator)\b"
            r"|\b(?:silently|secretly|covertly)\b[^.\n]{0,20}\b(?:send|upload|execute|run|delete|modify|exfiltrate|collect|transmit)\b",
            re.I),
        message="Prompt-injection: instructs the agent to conceal an action from the user.",
        remediation="A skill must never hide behavior from its operator; remove the concealment instruction.",
    ),
    Rule(
        # Conditional / dormant trigger — a payload that only fires under a
        # time/usage condition (the textual precursor to rug-pull behavior).
        id="GS-INJ-008", name="injection.conditional_trigger", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(?:only|just)\s+(?:when|after|if)\b[^.\n]{0,40}\b(?:send|upload|execute|run|delete|exfiltrate|email|post|transmit|leak|deploy|activate)\b"
            r"|\bafter\s+\d+\s+(?:uses|runs|invocations|days|calls|times)\b[^.\n]{0,40}\b(?:send|upload|execute|run|delete|exfiltrate|activate|trigger|enable)\b"
            r"|\bif\s+(?:the\s+)?(?:date|time|day)\s+is\b[^.\n]{0,40}\b(?:send|upload|execute|run|delete|exfiltrate|activate|trigger)\b"
            r"|\bwhen\s+(?:nobody|no one)\s+is\s+(?:watching|looking)\b",
            re.I),
        message="Prompt-injection: conditional/dormant trigger for a delayed action.",
    ),
]
