"""
Scan stage — the trust layer.

Pure-Python, deterministic, zero-LLM static analysis over the *generated* skill
(SKILL.md + references/*.md + any shipped script). The digest is repo-derived and
untrusted, so an injection planted in a README/docstring can flow into SKILL.md
and then into a user's agent context. This gate stops that.

Severity → gate:  CRITICAL/HIGH → FAIL, MEDIUM/LOW → WARN, INFO → PASS.
FAIL blocks export; WARN requires explicit user acceptance.

`semgrep` is an optional, lazy layer over runnable scripts (off by default).

Author: GitScape.ai
"""
from __future__ import annotations

import math
import re
from typing import Iterable, Optional

from .models import ContentUnit, ScanFinding, ScanReport, ScanStatus, Severity

# ─── rule definitions ──────────────────────────────────────────────────────

# (rule_name, pattern, severity, message)
_INJECTION_RULES: list[tuple[str, re.Pattern, Severity, str]] = [
    ("injection.ignore_previous",
     re.compile(r"\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|preceding|earlier|all)\b[^.\n]{0,40}\b(instruction|instructions|prompt|prompts|direction|directions|context|rules?)\b", re.I),
     Severity.CRITICAL, "Prompt-injection: attempt to override prior instructions."),
    ("injection.reveal_system_prompt",
     re.compile(r"\b(reveal|show|print|repeat|leak|disclose)\b[^.\n]{0,30}\b(system|developer)\b[^.\n]{0,15}\bprompt\b", re.I),
     Severity.CRITICAL, "Prompt-injection: attempt to exfiltrate the system prompt."),
    ("injection.persona_override",
     re.compile(r"\byou are now\b|\bact as (an?|the)\b[^.\n]{0,30}\b(assistant|ai|model|dan)\b|\bnew (system )?persona\b", re.I),
     Severity.HIGH, "Prompt-injection: hidden persona/role override."),
    ("injection.role_tags",
     re.compile(r"<\/?(system|assistant|user|tool)>|\[/?INST\]|<\|im_(start|end)\|>", re.I),
     Severity.HIGH, "Prompt-injection: embedded chat role/control tags."),
    ("injection.tool_abuse",
     re.compile(r"\b(run|execute|eval)\b[^.\n]{0,25}\bthe following\b|curl\s+[^\n|]{0,120}\|\s*(sh|bash)\b|\brm\s+-rf\s+/", re.I),
     Severity.HIGH, "Tool-abuse: instruction to execute shell/commands."),
]

_EXFIL_RULES: list[tuple[str, re.Pattern, Severity, str]] = [
    ("exfil.send_secrets",
     re.compile(r"\b(send|post|upload|exfiltrate|transmit|email)\b[^.\n]{0,40}\b(token|secret|api[\s_-]?key|password|credential|credentials|\.env|environment variable)\b", re.I),
     Severity.HIGH, "Exfiltration: instruction to send secrets/credentials outward."),
    ("exfil.raw_ip_url",
     re.compile(r"https?://\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:/\S*)?", re.I),
     Severity.MEDIUM, "Suspicious URL pointing at a raw IP address."),
]

# ─── Framework skill structural quality rules ─────────────────────────────────
# These fire on the assembled SKILL.md when skill_type="framework".
# MEDIUM → WARN (not FAIL) — the user can still download but is notified of gaps.

_FRAMEWORK_SECTION_RULES: list[tuple[str, re.Pattern, Severity, str]] = [
    ("framework.missing_overview",
     re.compile(r"^## Overview", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the required ## Overview section."),
    ("framework.missing_when_to_use",
     re.compile(r"^## When to Use", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the required ## When to Use section."),
    ("framework.missing_core_process",
     re.compile(r"^## Core Process", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the required ## Core Process section."),
    ("framework.missing_rationalizations",
     re.compile(r"^## Common Rationalizations", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the ## Common Rationalizations section."),
    ("framework.missing_red_flags",
     re.compile(r"^## Red Flags", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the required ## Red Flags section."),
    ("framework.missing_verification",
     re.compile(r"^## Verification", re.M),
     Severity.MEDIUM,
     "Engineering Skill is missing the required ## Verification section."),
]

# invisible / control characters that must not survive into shipped text
_INVISIBLE = {
    0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF,  # zero-width
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,  # bidi embeddings/overrides
    0x2066, 0x2067, 0x2068, 0x2069, 0x200E, 0x200F, 0x061C,  # isolates / marks
}

_B64_RUN = re.compile(r"[A-Za-z0-9+/]{120,}={0,2}")


def _line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts: dict[str, int] = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _scan_text(label: str, text: str) -> list[ScanFinding]:
    findings: list[ScanFinding] = []

    # Whether this file is the agent's instruction document (SKILL.md) or a
    # reference/lookup document.  Role-tag XML in reference files is almost
    # always legitimate API documentation (chat protocol schemas, OpenAPI specs,
    # etc.); downgrade those hits to INFO so they never gate the download.
    is_instruction_file = (label == "SKILL.md")

    for ruleset in (_INJECTION_RULES, _EXFIL_RULES):
        for rule, pattern, severity, message in ruleset:
            effective_severity = severity
            if rule == "injection.role_tags" and not is_instruction_file:
                # Reference-file role tags: informational only, not a gate.
                effective_severity = Severity.INFO
            for m in pattern.finditer(text):
                findings.append(ScanFinding(
                    rule=rule, severity=effective_severity, file=label,
                    line=_line_of(text, m.start()),
                    snippet=m.group(0)[:160], message=message,
                ))

    # invisible / bidi characters
    for i, ch in enumerate(text):
        if ord(ch) in _INVISIBLE:
            findings.append(ScanFinding(
                rule="hidden.invisible_char", severity=Severity.HIGH, file=label,
                line=_line_of(text, i),
                snippet=f"U+{ord(ch):04X}",
                message="Hidden text: zero-width or bidirectional control character.",
            ))
            break  # one finding per file is enough to gate

    # high-entropy base64 blobs
    for m in _B64_RUN.finditer(text):
        blob = m.group(0)
        if _shannon_entropy(blob) >= 4.0:
            findings.append(ScanFinding(
                rule="exfil.high_entropy_blob", severity=Severity.MEDIUM, file=label,
                line=_line_of(text, m.start()),
                snippet=blob[:48] + "…",
                message="High-entropy base64-like blob (possible hidden payload).",
            ))

    return findings


def _attribute(snippet: str, units: Optional[Iterable[ContentUnit]]) -> Optional[str]:
    """Best-effort: find which source file the offending text came from."""
    if not units:
        return None
    norm = " ".join(snippet.lower().split())
    if not norm:
        return None
    for u in units:
        if norm in " ".join(u.content.lower().split()):
            return u.path
    return None


def _semgrep_scan(scripts: dict[str, str]) -> list[ScanFinding]:
    """Optional hostile-code scan over shipped scripts. No-op if semgrep absent."""
    try:
        import importlib.util

        if importlib.util.find_spec("semgrep") is None:
            return []
    except Exception:
        return []
    # Lazy, best-effort: a full semgrep subprocess run is wired in deployment.
    # Kept as a hook so the static rules above remain the always-on layer.
    return []


def _status_for(findings: list[ScanFinding]) -> ScanStatus:
    sevs = {f.severity for f in findings}
    if sevs & {Severity.CRITICAL, Severity.HIGH}:
        return ScanStatus.FAIL
    if sevs & {Severity.MEDIUM, Severity.LOW}:
        return ScanStatus.WARN
    return ScanStatus.PASS


def scan_skill(
    skill_md: str,
    references: dict[str, str],
    *,
    units: Optional[list[ContentUnit]] = None,
    scripts: Optional[dict[str, str]] = None,
    enable_semgrep: bool = False,
    is_framework_skill: bool = False,
) -> ScanReport:
    """Scan the assembled skill and return a gated report.

    When *is_framework_skill* is True, additional structural quality checks run
    against the 6 canonical sections. Missing sections produce WARN findings
    (MEDIUM severity) so the user can still export but is informed of gaps.
    """
    findings: list[ScanFinding] = []

    findings.extend(_scan_text("SKILL.md", skill_md))
    for name, content in (references or {}).items():
        findings.extend(_scan_text(name, content))
    for name, content in (scripts or {}).items():
        findings.extend(_scan_text(name, content))

    if enable_semgrep and scripts:
        findings.extend(_semgrep_scan(scripts))

    if is_framework_skill:
        for rule, pattern, severity, message in _FRAMEWORK_SECTION_RULES:
            if not pattern.search(skill_md):
                findings.append(ScanFinding(
                    rule=rule,
                    severity=severity,
                    file="SKILL.md",
                    line=0,
                    message=message,
                ))

    # attribute findings back to originating repo files
    for f in findings:
        f.source_path = _attribute(f.snippet, units)

    return ScanReport(status=_status_for(findings), findings=findings)
