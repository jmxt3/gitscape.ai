"""
Shared test fixtures.

Keep the suite offline and deterministic: OSV.dev lookups are disabled by
default so no test accidentally hits the network when scanning pinned deps.
Tests that exercise OSV (test_scan_osv.py) opt back in via their own fixture,
which runs after this one.
"""
import pytest


@pytest.fixture(autouse=True)
def _disable_osv_by_default(monkeypatch):
    monkeypatch.setenv("SCAN_OSV", "0")
