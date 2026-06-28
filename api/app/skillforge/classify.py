"""
Classify stage: tag each path as docs / source / config / test / other.

Pure path + extension heuristics — no file I/O, no LLM. Test detection runs first
(a test file is also valid source, but we want it routed to example mining, not
the public API index).

Author: GitScape.ai
"""
from __future__ import annotations

from pathlib import PurePosixPath

from .models import FileKind

_TEST_DIR_TOKENS = {"test", "tests", "__tests__", "spec", "specs", "e2e"}

_CONFIG_NAMES = {
    "package.json", "pyproject.toml", "requirements.txt", "setup.py", "setup.cfg",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml", "go.mod", "go.sum",
    "cargo.toml", "pom.xml", "build.gradle", "makefile", "tsconfig.json",
    "pipfile", "poetry.lock", "uv.lock", "package-lock.json", "yarn.lock",
    "gemfile", "composer.json", "manifest.json", "vite.config.ts", "vite.config.js",
}
_CONFIG_EXTS = {
    ".toml", ".ini", ".cfg", ".conf", ".yaml", ".yml", ".properties",
    ".lock", ".gradle", ".tf", ".tfvars", ".hcl",
}
_DOC_EXTS = {".md", ".markdown", ".rst", ".txt"}
_SOURCE_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".go", ".rs", ".java",
    ".rb", ".php", ".c", ".h", ".cpp", ".hpp", ".cs", ".swift", ".kt", ".scala",
    ".sh", ".bash", ".lua", ".dart", ".ex", ".exs", ".vue", ".svelte", ".sql",
    ".sol", ".r", ".clj", ".elm", ".erl",
}


def _is_test(name: str, parts: tuple[str, ...]) -> bool:
    if any(seg in _TEST_DIR_TOKENS for seg in parts):
        return True
    return (
        name == "conftest.py"
        or name.startswith("test_")
        or name.startswith("test.")
        or "_test." in name
        or ".test." in name
        or ".spec." in name
        or "_spec." in name
    )


def classify_path(path: str, content: str = "") -> FileKind:
    """Return the FileKind for a repo-relative path. `content` is reserved for
    future content-sniffing and currently unused."""
    p = PurePosixPath(path.replace("\\", "/"))
    name = p.name.lower()
    suffix = p.suffix.lower()
    parts = tuple(seg.lower() for seg in p.parts)

    if _is_test(name, parts):
        return FileKind.TEST
    if name in _CONFIG_NAMES or suffix in _CONFIG_EXTS or name.startswith(".env"):
        return FileKind.CONFIG
    if suffix in _DOC_EXTS or "docs" in parts or "doc" in parts:
        return FileKind.DOCS
    if suffix in _SOURCE_EXTS:
        return FileKind.SOURCE
    return FileKind.OTHER
