"""
Extract stage — the deterministic quality lever.

Turns classified ContentUnits into a structured Extract: a public API/symbol
index (tree-sitter), an import/dependency graph, mined setup/quickstart, and
deduped code examples. Zero LLM.

Author: GitScape.ai
"""
from __future__ import annotations

from ..models import ContentUnit, Extract
from .examples import build_examples
from .graph import build_import_graph
from .setup import build_setup
from .symbols import build_api_index

__all__ = [
    "build_extract",
    "build_api_index",
    "build_import_graph",
    "build_setup",
    "build_examples",
]


def build_extract(units: list[ContentUnit], readme: str = "") -> Extract:
    return Extract(
        api_index=build_api_index(units),
        import_graph=build_import_graph(units),
        setup=build_setup(units, readme=readme),
        examples=build_examples(units),
    )
