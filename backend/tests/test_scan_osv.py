"""
OSV.dev supply-chain lookup tests (GS-DEP-006 / 007).

The scanner must stay fail-open: an OSV outage removes signal but never blocks a
build or changes the gate. These tests mock the HTTP layer so they're offline.
"""
import pytest

from app.skillforge.models import ContentUnit, FileKind, ScanStatus, Severity
from app.skillforge.scan import osv, scan_skill


@pytest.fixture(autouse=True)
def _clear_osv_cache(monkeypatch):
    osv._cache.clear()
    monkeypatch.setenv("SCAN_OSV", "1")  # ensure enabled regardless of env
    yield
    osv._cache.clear()


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _req_units(content="flask==2.0.1\n"):
    return [ContentUnit(path="requirements.txt", content=content, kind=FileKind.CONFIG)]


def _patch_osv(monkeypatch, results, counter=None):
    def fake_post(url, json=None, timeout=None):
        if counter is not None:
            counter["n"] += 1
        return _FakeResp({"results": results})
    monkeypatch.setattr(osv.requests, "post", fake_post)


# ── query_batch unit behavior ────────────────────────────────────────────────

def test_query_batch_parses_ids(monkeypatch):
    _patch_osv(monkeypatch, [{"vulns": [{"id": "CVE-2021-1"}, {"id": "GHSA-x"}]}])
    out = osv.query_batch([("PyPI", "flask", "2.0.1")])
    assert out[("PyPI", "flask", "2.0.1")] == ["CVE-2021-1", "GHSA-x"]


def test_query_batch_caches(monkeypatch):
    counter = {"n": 0}
    _patch_osv(monkeypatch, [{"vulns": [{"id": "CVE-2021-1"}]}], counter)
    key = [("PyPI", "flask", "2.0.1")]
    osv.query_batch(key)
    osv.query_batch(key)  # second call should hit the cache, not the network
    assert counter["n"] == 1


def test_query_batch_fails_open_on_error(monkeypatch):
    def boom(url, json=None, timeout=None):
        raise TimeoutError("network down")
    monkeypatch.setattr(osv.requests, "post", boom)
    assert osv.query_batch([("PyPI", "flask", "2.0.1")]) == {}


# ── integration through scan_skill ───────────────────────────────────────────

def test_known_vulnerability_warns(monkeypatch):
    _patch_osv(monkeypatch, [{"vulns": [{"id": "CVE-2021-1234"}]}])
    report = scan_skill("# Skill", {}, units=_req_units())
    dep6 = [f for f in report.findings if f.id == "GS-DEP-006"]
    assert dep6, [f.id for f in report.findings]
    assert dep6[0].severity == Severity.MEDIUM
    assert report.status == ScanStatus.WARN


def test_malicious_package_is_critical(monkeypatch):
    _patch_osv(monkeypatch, [{"vulns": [{"id": "MAL-2024-9999"}]}])
    report = scan_skill("# Skill", {}, units=_req_units())
    dep7 = [f for f in report.findings if f.id == "GS-DEP-007"]
    assert dep7, [f.id for f in report.findings]
    assert dep7[0].severity == Severity.CRITICAL
    assert report.status == ScanStatus.FAIL
    # supply_chain is NOT unbypassable — a stale OSV record must not hard-brick.
    from app.skillforge.package import has_unbypassable_finding
    assert not has_unbypassable_finding(report)


def test_mal_and_cve_split_between_rules(monkeypatch):
    _patch_osv(monkeypatch, [{"vulns": [{"id": "MAL-1"}, {"id": "CVE-2"}]}])
    report = scan_skill("# Skill", {}, units=_req_units())
    ids = {f.id for f in report.findings}
    assert "GS-DEP-006" in ids and "GS-DEP-007" in ids


def test_outage_yields_no_osv_findings(monkeypatch):
    def boom(url, json=None, timeout=None):
        raise ConnectionError("osv unreachable")
    monkeypatch.setattr(osv.requests, "post", boom)
    report = scan_skill("# Skill", {}, units=_req_units())
    ids = {f.id for f in report.findings}
    assert "GS-DEP-006" not in ids and "GS-DEP-007" not in ids


def test_kill_switch_disables_lookup(monkeypatch):
    monkeypatch.setenv("SCAN_OSV", "0")
    called = {"n": 0}
    _patch_osv(monkeypatch, [{"vulns": [{"id": "MAL-1"}]}], called)
    report = scan_skill("# Skill", {}, units=_req_units())
    ids = {f.id for f in report.findings}
    assert "GS-DEP-006" not in ids and "GS-DEP-007" not in ids
    assert called["n"] == 0  # no network call when disabled


def test_clean_skill_no_network_and_no_dep_findings(monkeypatch):
    # No config units → no pinned deps → OSV never queried.
    called = {"n": 0}
    _patch_osv(monkeypatch, [], called)
    report = scan_skill("# Clean local library, no deps.", {})
    assert called["n"] == 0
    assert not [f for f in report.findings if f.id in ("GS-DEP-006", "GS-DEP-007")]
