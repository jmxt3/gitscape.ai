"""
Ingest stage: content hashing and cache keys.

The digest is the unit of caching. The same repo at the same commit produces the
same digest text, so its SHA-256 (combined with the builder version) is a stable
cache key — re-running an identical digest never recomputes the skill.

Author: GitScape.ai
"""
from __future__ import annotations

import hashlib

# Bump when the build output format changes so cached packages are invalidated.
BUILDER_VERSION = "1.0.0"


def content_hash(text: str) -> str:
    """SHA-256 hex digest of the digest text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def cache_key(digest_text: str, builder_version: str = BUILDER_VERSION) -> str:
    """Cache key = digest hash + builder version."""
    return f"{content_hash(digest_text)}:{builder_version}"
