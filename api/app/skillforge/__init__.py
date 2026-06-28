"""
SkillForge — deterministic-first Agent Skill builder for GitScape.ai.

Pipeline: ingest → parse → classify → extract → sanitize → assemble → scan → package.
~90% of the work is deterministic (no LLM); an LLM only writes short prose glue in
the optional HD tier.

This package __init__ stays import-light on purpose: the tree-sitter-backed
extractor lives behind `builder.build_skill`, imported lazily by the API layer so
that `import app.skillforge` never pulls native grammars.

Author: GitScape.ai
"""
from __future__ import annotations

from .builder import build_skill
from .cache import skill_cache
from .classify import classify_path
from .errors import BuildError, ScanBlocked
from .ingest import BUILDER_VERSION, cache_key, content_hash
from .models import RepoMeta, ScanStatus, SkillPackage
from .package import build_zip
from .parse import parse_digest, units_from_clone

__all__ = [
    "BUILDER_VERSION",
    "cache_key",
    "content_hash",
    "parse_digest",
    "units_from_clone",
    "classify_path",
    "skill_cache",
    "build_skill",
    "build_zip",
    "RepoMeta",
    "SkillPackage",
    "ScanStatus",
    "BuildError",
    "ScanBlocked",
]
