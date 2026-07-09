"""
Untrusted-content rules (GS-CNT) — the Snyk "W011" family.

A skill that fetches and then *acts on* third-party content is an indirect
prompt-injection vector: the attacker controls the fetched bytes, not the skill
author. GS-CNT-002 inventories the external domains a skill points at (minus the
repo's own host) as an INFO signal reviewers can eyeball.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

from ...models import Confidence, ScanFinding, Severity
from ..context import ScanContext, line_of
from ..registry import Rule
from ..taxonomy import Category

C = Category.CONTENT_EXPOSURE

_URL = re.compile(r"https?://([^/\s)\"']+)", re.I)


def _repo_hosts(repo_url: str) -> set[str]:
    hosts: set[str] = set()
    try:
        netloc = urlparse(repo_url).netloc.lower()
        if netloc:
            hosts.add(netloc)
            # also whitelist the owner's github pages / raw hosts
            hosts.update({"github.com", "raw.githubusercontent.com", "codeload.github.com"})
    except Exception:
        pass
    return hosts


def _check_external_domains(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    """One aggregated INFO finding listing external domains referenced in SKILL.md."""
    whitelist = _repo_hosts(ctx.repo_url)
    domains: list[str] = []
    seen: set[str] = set()
    for m in _URL.finditer(ctx.skill_md):
        host = m.group(1).lower().split(":")[0]
        if host and host not in whitelist and host not in seen:
            seen.add(host)
            domains.append(host)
    if not domains:
        return []
    listed = ", ".join(domains[:12]) + ("…" if len(domains) > 12 else "")
    return [rule.finding(
        file="SKILL.md", line=0, snippet=listed,
        message=f"Skill references {len(domains)} external domain(s): {listed}",
    )]


RULES: list[Rule] = [
    Rule(
        id="GS-CNT-001", name="content.fetch_and_obey", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\b(fetch|read|load|retrieve|browse|download)\b[^.\n]{0,50}https?://\S+[^.\n]{0,60}\b(follow|include|obey|execute|do what|instructions|as context)\b",
            re.I),
        message="Fetches remote content and treats it as instructions (indirect injection risk).",
        remediation="Treat fetched third-party content as data, never as instructions.",
    ),
    Rule(
        id="GS-CNT-002", name="content.external_domains", category=C,
        severity=Severity.INFO, confidence=Confidence.LOW,
        check=_check_external_domains,
        message="External domains referenced by the skill.",
    ),
    Rule(
        id="GS-CNT-003", name="content.html_comment", category=C,
        severity=Severity.LOW, confidence=Confidence.LOW,
        pattern=re.compile(r"<!--.*?-->", re.DOTALL),
        applies_to=frozenset({"skill_md"}),
        message="HTML comment survived into the shipped skill (should be stripped by sanitize).",
    ),
]
