"""
Scan context + shared helpers.

ScanContext is the immutable bundle every functional rule receives: the three
skill surfaces (SKILL.md, references, scripts) plus the richer signals a regex
can't see — the source ContentUnits, the extracted import graph, and the repo
URL (used to whitelist a skill's own domain).

Author: GitScape.ai
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

# Imported lazily-typed to avoid a hard dependency cycle with models/extract.
try:  # pragma: no cover - typing convenience only
    from ..models import ContentUnit
except Exception:  # pragma: no cover
    ContentUnit = object  # type: ignore


@dataclass(frozen=True)
class ScanContext:
    skill_md: str
    references: dict  # filename -> content
    scripts: dict  # filename -> content
    units: Optional[list] = None  # list[ContentUnit]
    extract: object = None  # skillforge.models.Extract | None
    repo_url: str = ""
    is_framework_skill: bool = False

    def all_surfaces(self) -> list[tuple[str, str]]:
        """(label, text) pairs across SKILL.md + references + scripts."""
        out: list[tuple[str, str]] = [("SKILL.md", self.skill_md)]
        out.extend((name, content) for name, content in (self.references or {}).items())
        out.extend((name, content) for name, content in (self.scripts or {}).items())
        return out


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts: dict[str, int] = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())
