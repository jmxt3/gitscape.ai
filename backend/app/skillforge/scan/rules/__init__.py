"""
Rule aggregation — collects every ScapeGuard rule module into ALL_RULES.

Pattern rules and functional (check) rules live side by side; the engine sorts
them out by whether `.pattern` or `.check` is set.

Author: GitScape.ai
"""
from __future__ import annotations

from ..registry import Rule
from . import (
    agency,
    content_exposure,
    execution,
    exfil,
    injection,
    obfuscation,
    secrets,
    structure,
    supply_chain,
)

_MODULES = [
    injection,
    secrets,
    execution,
    exfil,
    supply_chain,
    obfuscation,
    content_exposure,
    agency,
    structure,
]

ALL_RULES: list[Rule] = [rule for mod in _MODULES for rule in mod.RULES]

PATTERN_RULES: list[Rule] = [r for r in ALL_RULES if r.pattern is not None]
CHECK_RULES: list[Rule] = [r for r in ALL_RULES if r.check is not None]

__all__ = ["ALL_RULES", "PATTERN_RULES", "CHECK_RULES"]
