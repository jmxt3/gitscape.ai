"""
Process-local LRU cache of built skill packages, keyed by digest hash + builder
version. `GET /converter` populates it after a build; `POST /skill-zip` reads it
so the (heavier) extraction never runs twice for the same digest.

Intentionally simple and in-memory: a cache miss just rebuilds from the digest,
so eviction or a cold process is always safe.

Author: GitScape.ai
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from typing import Optional

from .models import SkillPackage


class SkillCache:
    def __init__(self, maxsize: int = 32) -> None:
        self._lock = threading.Lock()
        self._store: "OrderedDict[str, SkillPackage]" = OrderedDict()
        self._maxsize = maxsize

    def get(self, key: str) -> Optional[SkillPackage]:
        with self._lock:
            pkg = self._store.get(key)
            if pkg is not None:
                self._store.move_to_end(key)
            return pkg

    def set(self, key: str, value: SkillPackage) -> None:
        with self._lock:
            self._store[key] = value
            self._store.move_to_end(key)
            while len(self._store) > self._maxsize:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# Shared singleton used by the API layer.
skill_cache = SkillCache()
