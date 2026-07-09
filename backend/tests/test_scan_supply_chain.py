"""ScapeGuard supply-chain rules (GS-DEP) — import-graph aware."""
from app.skillforge.models import (
    ContentUnit,
    Extract,
    ExternalDep,
    FileKind,
    ImportGraph,
)
from app.skillforge.scan import scan_skill


def _ids(report):
    return {f.id for f in report.findings}


def _extract(names):
    return Extract(import_graph=ImportGraph(
        external=[ExternalDep(name=n, source_path="requirements.txt") for n in names]
    ))


def test_typosquat_transposition():
    report = scan_skill("clean\n", {}, extract=_extract(["reqeusts"]))
    assert "GS-DEP-005" in _ids(report)


def test_known_package_not_flagged_as_typosquat():
    report = scan_skill("clean\n", {}, extract=_extract(["requests", "flask", "numpy"]))
    assert "GS-DEP-005" not in _ids(report)


def test_install_from_url():
    report = scan_skill("Install: pip install git+https://github.com/x/y\n", {})
    assert "GS-DEP-003" in _ids(report)


def test_unverifiable_install_instruction():
    # SKILL.md says `pip install foopkg` but foopkg is not a declared dependency
    report = scan_skill("Run `pip install totally-not-declared` first.\n", {}, extract=_extract(["requests"]))
    assert "GS-DEP-002" in _ids(report)


def test_unpinned_requirements():
    units = [ContentUnit(path="requirements.txt", content="requests\nflask\n", kind=FileKind.CONFIG)]
    report = scan_skill("clean\n", {}, units=units)
    assert "GS-DEP-001" in _ids(report)


def test_preinstall_script_flagged():
    units = [ContentUnit(
        path="package.json",
        content='{"scripts": {"postinstall": "node evil.js"}}',
        kind=FileKind.CONFIG,
    )]
    report = scan_skill("clean\n", {}, units=units)
    assert "GS-DEP-004" in _ids(report)
