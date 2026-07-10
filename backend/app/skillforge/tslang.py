"""
Shared tree-sitter parser loader.

One lazily-built parser per grammar, reused by both the symbol extractor
(`extract/symbols.py`) and the behavioral scanner (`scan/behavioral.py`).
Grammars ship as individual `tree-sitter-<lang>` wheels (Python, TypeScript/TSX,
JavaScript, Go); the native dependency stays lazy until a parser is requested.

Author: GitScape.ai
"""
from __future__ import annotations

# file suffix -> grammar key
SUFFIX_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".go": "go",
}

# Lazily-built parsers, keyed by grammar.
_PARSERS: dict[str, object] = {}


def get_parser(lang: str):
    """Return a cached tree-sitter Parser for a grammar key (raises on unknown)."""
    parser = _PARSERS.get(lang)
    if parser is not None:
        return parser
    from tree_sitter import Language, Parser  # local import keeps native dep lazy

    if lang == "python":
        import tree_sitter_python as ts

        capsule = ts.language()
    elif lang in ("typescript", "tsx"):
        import tree_sitter_typescript as ts

        capsule = ts.language_tsx() if lang == "tsx" else ts.language_typescript()
    elif lang == "javascript":
        import tree_sitter_javascript as ts

        capsule = ts.language()
    elif lang == "go":
        import tree_sitter_go as ts

        capsule = ts.language()
    else:
        raise ValueError(f"unsupported grammar: {lang}")

    parser = Parser(Language(capsule))
    _PARSERS[lang] = parser
    return parser
