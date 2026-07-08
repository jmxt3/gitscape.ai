"""
Lightweight import / dependency graph.

External dependencies come from manifest files (the reliable signal); internal
edges are the relative imports mined per source file. Regex-based on purpose —
no tomllib (we target 3.10) and no extra parse pass.

Author: GitScape.ai
"""
from __future__ import annotations

import json
import re
from pathlib import PurePosixPath

from ..models import ContentUnit, ExternalDep, FileKind, ImportGraph

_MAX_INTERNAL_PER_FILE = 20

# dependencies = [ "fastapi>=0.1", ... ]  (PEP 621)
_RE_PYPROJECT_DEPS = re.compile(r"dependencies\s*=\s*\[(.*?)\]", re.DOTALL)
_RE_QUOTED = re.compile(r"""['"]([^'"]+)['"]""")
_RE_PY_IMPORT = re.compile(r"(?m)^\s*(?:from\s+(\.[.\w]*)|import\s+(\.[.\w]*))")
_RE_JS_IMPORT = re.compile(r"""(?:import\s.*?from\s*|require\(\s*)['"](\.[^'"]+)['"]""")
_RE_GOMOD_REQUIRE = re.compile(r"(?m)^\s*([\w./-]+)\s+v[\w.\-+]+")


def _dep_name(spec: str) -> str:
    """Strip version/extras: 'fastapi[standard]>=0.1' -> 'fastapi'."""
    spec = spec.strip()
    for sep in (" ", ">", "<", "=", "!", "~", ";", "[", "@"):
        idx = spec.find(sep)
        if idx > 0:
            spec = spec[:idx]
    return spec.strip()


def _external_from_unit(unit: ContentUnit) -> list[str]:
    name = PurePosixPath(unit.path).name.lower()
    text = unit.content
    deps: list[str] = []

    if name == "package.json":
        try:
            data = json.loads(text)
        except Exception:
            return []
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            block = data.get(key)
            if isinstance(block, dict):
                deps.extend(block.keys())
    elif name == "requirements.txt":
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith(("#", "-")):
                continue
            n = _dep_name(line)
            if n:
                deps.append(n)
    elif name == "pyproject.toml":
        for block in _RE_PYPROJECT_DEPS.findall(text):
            for spec in _RE_QUOTED.findall(block):
                n = _dep_name(spec)
                if n:
                    deps.append(n)
    elif name == "go.mod":
        deps.extend(_RE_GOMOD_REQUIRE.findall(text))

    return deps


def _internal_from_unit(unit: ContentUnit) -> list[str]:
    suffix = PurePosixPath(unit.path).suffix.lower()
    found: list[str] = []
    if suffix == ".py":
        for a, b in _RE_PY_IMPORT.findall(unit.content):
            mod = a or b
            if mod:
                found.append(mod)
    elif suffix in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"):
        found.extend(_RE_JS_IMPORT.findall(unit.content))
    # de-dupe preserving order, cap
    seen: set[str] = set()
    out: list[str] = []
    for m in found:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out[:_MAX_INTERNAL_PER_FILE]


def build_import_graph(units: list[ContentUnit]) -> ImportGraph:
    graph = ImportGraph()
    seen_ext: set[str] = set()
    for unit in units:
        if unit.kind == FileKind.CONFIG:
            for dep in _external_from_unit(unit):
                if dep and dep not in seen_ext:
                    seen_ext.add(dep)
                    graph.external.append(ExternalDep(name=dep, source_path=unit.path))
        elif unit.kind in (FileKind.SOURCE, FileKind.TEST):
            internal = _internal_from_unit(unit)
            if internal:
                graph.internal[unit.path] = internal
    return graph
