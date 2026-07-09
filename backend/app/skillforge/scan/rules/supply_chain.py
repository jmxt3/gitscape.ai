"""
Supply-chain rules (GS-DEP).

Consumes the extracted import graph and the raw manifest units to flag unpinned,
unverifiable, or URL-sourced dependencies and install-script abuse. These are
functional rules: they need signals a per-line regex can't see (the full set of
declared dependencies, whether an install target is actually imported anywhere).

Author: GitScape.ai
"""
from __future__ import annotations

import json
import re
from pathlib import PurePosixPath

from ...models import Confidence, ScanFinding, Severity
from ..context import ScanContext, line_of
from ..data.top_packages import ALL_TOP, edit_distance_at_most_one
from ..registry import Rule
from ..taxonomy import Category

C = Category.SUPPLY_CHAIN

_PINNED = re.compile(r"(==|>=|<=|~=|@|\bv?\d+\.\d+)")
_INSTALL = re.compile(
    r"\b(?:pip|pip3|uv)\s+(?:add|install)\s+([A-Za-z0-9._-]+)"
    r"|\bnpm\s+(?:i|install|add)\s+([@A-Za-z0-9._/-]+)"
    r"|\bnpx\s+([@A-Za-z0-9._/-]+)",
    re.I,
)


def _config_units(ctx: ScanContext):
    for u in (ctx.units or []):
        name = PurePosixPath(getattr(u, "path", "")).name.lower()
        if name in ("requirements.txt", "package.json", "pyproject.toml", "go.mod"):
            yield u, name


def _check_unpinned(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    unpinned: list[str] = []
    for u, name in _config_units(ctx):
        if name == "requirements.txt":
            for line in u.content.splitlines():
                line = line.strip()
                if not line or line.startswith(("#", "-")):
                    continue
                if not _PINNED.search(line):
                    unpinned.append(line)
        elif name == "package.json":
            try:
                data = json.loads(u.content)
            except Exception:
                continue
            for block in ("dependencies", "devDependencies"):
                for dep, spec in (data.get(block) or {}).items():
                    if isinstance(spec, str) and spec.strip() in ("*", "latest", ""):
                        unpinned.append(f"{dep}@{spec}")
    if not unpinned:
        return []
    sev = Severity.MEDIUM if len(unpinned) > 10 else Severity.LOW
    listed = ", ".join(unpinned[:10]) + ("…" if len(unpinned) > 10 else "")
    return [rule.finding(
        file="manifest", line=0, snippet=listed, severity=sev,
        message=f"{len(unpinned)} unpinned dependency spec(s): {listed}",
    )]


def _check_unverifiable_install(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    """Install instructions in SKILL.md naming a package not declared as a dependency."""
    extract = ctx.extract
    known: set[str] = set()
    if extract is not None:
        for dep in getattr(getattr(extract, "import_graph", None), "external", []) or []:
            known.add(getattr(dep, "name", "").lower())
    findings: list[ScanFinding] = []
    seen: set[str] = set()
    for m in _INSTALL.finditer(ctx.skill_md):
        pkg = next((g for g in m.groups() if g), "")
        base = pkg.lstrip("@").split("/")[0].split("[")[0].lower()
        if not base or base in seen:
            continue
        seen.add(base)
        if base not in known:
            findings.append(rule.finding(
                file="SKILL.md", line=line_of(ctx.skill_md, m.start()), snippet=m.group(0),
                message=f"Install instruction references an unverifiable package '{pkg}' "
                        "(not declared in the repo's dependencies).",
            ))
    return findings


def _check_preinstall(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    findings: list[ScanFinding] = []
    for u, name in _config_units(ctx):
        if name != "package.json":
            continue
        try:
            data = json.loads(u.content)
        except Exception:
            continue
        scripts = data.get("scripts") or {}
        for hook in ("preinstall", "postinstall", "prepare", "install"):
            if hook in scripts:
                findings.append(rule.finding(
                    file=getattr(u, "path", "package.json"), line=0,
                    snippet=f"{hook}: {str(scripts[hook])[:80]}",
                    message=f"package.json defines a '{hook}' lifecycle script (runs on install).",
                ))
    return findings


def _check_typosquat(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    """Declared deps that are one edit away from a popular package name."""
    extract = ctx.extract
    if extract is None:
        return []
    findings: list[ScanFinding] = []
    seen: set[str] = set()
    for dep in getattr(getattr(extract, "import_graph", None), "external", []) or []:
        name = getattr(dep, "name", "").lower()
        if not name or name in seen or name in ALL_TOP:
            continue
        seen.add(name)
        for popular in ALL_TOP:
            if abs(len(name) - len(popular)) <= 1 and edit_distance_at_most_one(name, popular):
                findings.append(rule.finding(
                    file=getattr(dep, "source_path", "manifest"), line=0, snippet=name,
                    message=f"Dependency '{name}' is one character from the popular "
                            f"package '{popular}' (possible typosquat).",
                ))
                break
    return findings


RULES: list[Rule] = [
    Rule(
        id="GS-DEP-001", name="supply_chain.unpinned", category=C,
        severity=Severity.LOW, confidence=Confidence.MEDIUM,
        check=_check_unpinned,
        message="Unpinned dependencies (version drift / substitution risk).",
        remediation="Pin dependencies to exact versions or lockfile hashes.",
    ),
    Rule(
        id="GS-DEP-002", name="supply_chain.unverifiable", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.LOW,
        check=_check_unverifiable_install,
        message="Install instruction for a package the repo never declares or imports.",
    ),
    Rule(
        id="GS-DEP-003", name="supply_chain.install_from_url", category=C,
        severity=Severity.HIGH, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\bpip\s+install\s+(?:git\+)?https?://|--index-url\s+https?://"
            r"|\bnpm\s+install\s+https?://|\bpip\s+install\s+-e\s+git\+",
            re.I),
        message="Installs a dependency directly from a URL / VCS (bypasses the registry).",
    ),
    Rule(
        id="GS-DEP-004", name="supply_chain.install_scripts", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        check=_check_preinstall,
        message="Package lifecycle install scripts present.",
    ),
    Rule(
        id="GS-DEP-005", name="supply_chain.typosquat", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.LOW,
        check=_check_typosquat,
        message="Dependency name resembles a popular package (possible typosquat).",
    ),
]
