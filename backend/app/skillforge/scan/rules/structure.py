"""
Structural-quality rules (GS-STR) — engineering (framework) skills only.

These fire on the assembled SKILL.md when the build is a framework skill and a
canonical section is missing. They are "negative" checks (fire on absence), so
they run as one functional check gated on ctx.is_framework_skill. MEDIUM → WARN:
the user can still export, but is told which load-bearing sections are missing.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ...models import Confidence, ScanFinding, Severity
from ..context import ScanContext
from ..registry import Rule
from ..taxonomy import Category

C = Category.STRUCTURE

# (rule_id, dotted_name, section_header_pattern, human_section_name)
_SECTIONS: list[tuple[str, str, re.Pattern, str]] = [
    ("GS-STR-001", "framework.missing_overview", re.compile(r"^## Overview", re.M), "Overview"),
    ("GS-STR-002", "framework.missing_when_to_use", re.compile(r"^## When to Use", re.M), "When to Use"),
    ("GS-STR-003", "framework.missing_core_process", re.compile(r"^## Core Process", re.M), "Core Process"),
    ("GS-STR-004", "framework.missing_rationalizations", re.compile(r"^## Common Rationalizations", re.M), "Common Rationalizations"),
    ("GS-STR-005", "framework.missing_red_flags", re.compile(r"^## Red Flags", re.M), "Red Flags"),
    ("GS-STR-006", "framework.missing_verification", re.compile(r"^## Verification", re.M), "Verification"),
]


def _check_sections(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    if not ctx.is_framework_skill:
        return []
    findings: list[ScanFinding] = []
    for rid, name, pattern, section in _SECTIONS:
        if not pattern.search(ctx.skill_md):
            f = rule.finding(
                file="SKILL.md", line=0,
                message=f"Engineering Skill is missing the required ## {section} section.",
            )
            f.id = rid
            f.rule = name
            findings.append(f)
    return findings


RULES: list[Rule] = [
    Rule(
        id="GS-STR-000", name="framework.structure", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.HIGH,
        check=_check_sections,
        message="Engineering Skill structural completeness.",
    ),
]
