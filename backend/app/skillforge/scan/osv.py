"""
OSV.dev live vulnerability / malicious-package lookups.

A thin, fail-open client over the OSV.dev batch API. Given pinned dependencies
it returns the OSV IDs affecting each one; the supply-chain rules turn those
into GS-DEP-006 (known vulnerability) and GS-DEP-007 (malicious package,
`MAL-*`) findings.

Design constraints (Cloud Run, stateless, deterministic gate):
  * **Fail-open**: any network/parse error returns no results, so an OSV outage
    can never block a build or change the gate — it only removes signal.
  * **In-memory TTL cache** (1h), per-instance — fine on Cloud Run, no disk.
  * **Kill-switch**: `SCAN_OSV=0` disables the lookup entirely.
  * One batched HTTP call per scan (uncached deps only).

The design of the OSV batch query + TTL cache is derived from NVIDIA
SkillSpector (https://github.com/NVIDIA/SkillSpector), Apache-2.0. See
THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

import os
import time

import requests

_ENDPOINT = "https://api.osv.dev/v1/querybatch"
_TIMEOUT = 4.0  # seconds — scan happens at compile time, keep it snappy
_TTL = 3600.0  # 1 hour

# (ecosystem, name, version) -> (expiry_epoch, [osv_id, ...])
_cache: dict[tuple[str, str, str], tuple[float, list[str]]] = {}


def osv_enabled() -> bool:
    """OSV lookups are on by default; SCAN_OSV=0/false/no disables them."""
    return os.getenv("SCAN_OSV", "1").strip().lower() not in ("0", "false", "no")


def _now() -> float:
    return time.time()


def query_batch(
    packages: list[tuple[str, str, str]],
) -> dict[tuple[str, str, str], list[str]]:
    """Look up OSV IDs for pinned deps.

    Args:
        packages: list of (ecosystem, name, version), e.g. ("PyPI", "flask", "2.0.1").

    Returns:
        {(ecosystem, name, version): [osv_id, ...]} for packages with hits.
        Fail-open: on any error the affected keys are simply absent.
    """
    if not packages:
        return {}

    now = _now()
    out: dict[tuple[str, str, str], list[str]] = {}
    to_query: list[tuple[str, str, str]] = []
    for key in packages:
        cached = _cache.get(key)
        if cached is not None and cached[0] > now:
            if cached[1]:
                out[key] = cached[1]
        else:
            to_query.append(key)

    if not to_query:
        return out

    try:
        body = {
            "queries": [
                {"package": {"ecosystem": eco, "name": name}, "version": version}
                for (eco, name, version) in to_query
            ]
        }
        resp = requests.post(_ENDPOINT, json=body, timeout=_TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("results", [])
    except Exception:
        # Fail-open: no cache write, keys stay absent → no findings.
        return out

    for key, res in zip(to_query, results):
        ids = [
            v.get("id", "")
            for v in (res or {}).get("vulns", [])
            if v.get("id")
        ]
        _cache[key] = (now + _TTL, ids)
        if ids:
            out[key] = ids
    return out
