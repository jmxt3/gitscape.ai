"""
Rule registry — the declarative shape every ScapeGuard check shares.

A rule is either a *pattern* rule (a compiled regex matched against text) or a
*functional* rule (a callable that inspects richer context — the import graph,
co-occurring tokens, whole-file structure). Both produce ScanFinding objects
through the same helpers so severity, confidence, and OWASP tags stay uniform.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from ..models import Confidence, ScanFinding, Severity
from .taxonomy import Category, info

# Which skill surfaces a rule applies to.
SKILL_MD = "skill_md"
REFERENCES = "references"
SCRIPTS = "scripts"
ALL_SURFACES = frozenset({SKILL_MD, REFERENCES, SCRIPTS})

# Sentinel a `refine` callback returns to DROP a match entirely (as opposed to
# returning None, which keeps the rule's declared severity/confidence).
DROP = object()


@dataclass(frozen=True)
class Rule:
    """One ScapeGuard check.

    `pattern` rules run per-surface via the engine's text scanner; `check` rules
    are handed the full ScanContext and return findings themselves.
    """

    id: str  # stable issue code, e.g. "GS-SEC-001"
    name: str  # legacy dotted alias, e.g. "secrets.aws_access_key"
    category: Category
    severity: Severity
    confidence: Confidence
    message: str
    pattern: Optional[re.Pattern] = None
    check: Optional[Callable] = None  # (ScanContext) -> list[ScanFinding]
    # Per-match refinement for pattern rules. Given (match, text, label) it
    # returns None to keep the declared severity/confidence, the DROP sentinel
    # to discard the match, or an overriding (severity, confidence) tuple.
    # Used by secrets to downgrade placeholders and gate on entropy.
    refine: Optional[Callable] = None
    applies_to: frozenset = ALL_SURFACES
    remediation: str = ""

    def finding(
        self,
        *,
        file: str,
        line: int = 0,
        snippet: str = "",
        severity: Optional[Severity] = None,
        confidence: Optional[Confidence] = None,
        message: Optional[str] = None,
    ) -> ScanFinding:
        """Build a ScanFinding from this rule, stamping category + OWASP tags."""
        ci = info(self.category)
        return ScanFinding(
            rule=self.name,
            id=self.id,
            category=self.category.value,
            severity=severity or self.severity,
            confidence=confidence or self.confidence,
            owasp_ast=list(ci.owasp_ast),
            owasp_llm=list(ci.owasp_llm),
            file=file,
            line=line,
            snippet=snippet[:160],
            message=message or self.message,
            remediation=self.remediation,
        )
