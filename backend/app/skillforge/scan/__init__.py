"""
ScapeGuard — GitScape's agent-skill security engine.

Deterministic, zero-LLM static analysis over generated skills. This package
replaces the former single-file `scan.py`; `from .scan import scan_skill`
keeps working via the re-export below.

Author: GitScape.ai
"""
from __future__ import annotations

from .engine import ENGINE_NAME, ENGINE_VERSION, scan_skill
from .taxonomy import CATEGORIES, Category

__all__ = ["scan_skill", "ENGINE_NAME", "ENGINE_VERSION", "CATEGORIES", "Category"]
