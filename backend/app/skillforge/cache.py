"""
Process-local LRU cache of built skill packages, keyed by digest hash + builder
version. `GET /converter` populates it after a build; `POST /skill-zip` reads it
so the (heavier) extraction never runs twice for the same digest.

Memory-leak guards added over the original count-only LRU:
  - _ENTRY_TTL_SECONDS: entries older than this are evicted on read (prevents
    stale results being served after the upstream repo changes).
  - _MAX_BYTES: total heap cap across all entries; LRU eviction continues until
    both count and byte limits are satisfied.
  - _estimate_bytes: fast approximation (skill_md + references) — avoids a full
    pickle/marshal round-trip just to measure size.

Intentionally simple and in-memory: a cache miss just rebuilds from the digest,
so eviction or a cold process is always safe.

Author: GitScape.ai
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Optional

from .models import SkillPackage

# ─── Limits ───────────────────────────────────────────────────────────────────

_MAX_ENTRIES = 32
_ENTRY_TTL_SECONDS = 3600           # 1 hour — Cloud Run instance warm window
_MAX_BYTES = 200 * 1024 * 1024      # 200 MB total heap cap across all entries


def _estimate_bytes(pkg: SkillPackage) -> int:
    """Fast byte-size approximation of the two largest fields in a package."""
    return len(pkg.skill_md.encode("utf-8", errors="replace")) + sum(
        len(v.encode("utf-8", errors="replace")) for v in pkg.references.values()
    )


class SkillCache:
    def __init__(self, maxsize: int = _MAX_ENTRIES) -> None:
        self._lock = threading.Lock()
        self._store: "OrderedDict[str, SkillPackage]" = OrderedDict()
        self._timestamps: dict[str, float] = {}
        self._sizes: dict[str, int] = {}
        self._maxsize = maxsize
        self._total_bytes: int = 0

    # ─── Public API ──────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[SkillPackage]:
        with self._lock:
            pkg = self._store.get(key)
            if pkg is None:
                return None
            # Evict expired entry on read
            if time.monotonic() - self._timestamps.get(key, 0.0) > _ENTRY_TTL_SECONDS:
                self._evict(key)
                return None
            self._store.move_to_end(key)
            return pkg

    def set(self, key: str, value: SkillPackage) -> None:
        size = _estimate_bytes(value)
        with self._lock:
            # Update byte accounting if replacing an existing entry
            if key in self._store:
                self._total_bytes -= self._sizes.get(key, 0)
            self._store[key] = value
            self._store.move_to_end(key)
            self._timestamps[key] = time.monotonic()
            self._sizes[key] = size
            self._total_bytes += size
            # Evict LRU entries until both count and byte limits are satisfied
            while (len(self._store) > self._maxsize or
                   self._total_bytes > _MAX_BYTES):
                oldest_key = next(iter(self._store))
                self._evict(oldest_key)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._timestamps.clear()
            self._sizes.clear()
            self._total_bytes = 0

    # ─── Internal ────────────────────────────────────────────────────────────

    def _evict(self, key: str) -> None:
        """Remove one entry and update byte accounting. Must be called with lock held."""
        self._store.pop(key, None)
        self._total_bytes -= self._sizes.pop(key, 0)
        self._timestamps.pop(key, None)

    # ─── Diagnostics (safe to call without lock — approximate) ──────────────

    @property
    def entry_count(self) -> int:
        return len(self._store)

    @property
    def total_bytes(self) -> int:
        return self._total_bytes


# Shared singleton used by the API layer.
skill_cache = SkillCache()
