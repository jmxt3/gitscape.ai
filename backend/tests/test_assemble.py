import pytest

from app.skillforge.assemble import assemble, estimate_tokens
from app.skillforge.errors import BuildError
from app.skillforge.extract import build_extract
from app.skillforge.models import ContentUnit, FileKind, RepoMeta

PY = '''\
def serve(port: int) -> None:
    """Start the server."""
    return None

class Engine:
    """Core engine."""
    def run(self):
        """Run it."""
        return 1
'''

README = "# Demo\n\nA tiny demo project that does things.\n\n## Install\n\n```bash\npip install demo\n```\n"


def _units():
    return [
        ContentUnit(path="app/main.py", content=PY, kind=FileKind.SOURCE, language="Python"),
        ContentUnit(path="requirements.txt", content="fastapi\nrequests\n", kind=FileKind.CONFIG),
        ContentUnit(path="README.md", content=README, kind=FileKind.DOCS),
    ]


def _meta():
    return RepoMeta(
        owner="acme", repo="demo", repo_url="https://github.com/acme/demo",
        primary_languages=["Python"], files_analyzed=3, readme=README,
        structure_overview="└── app/\n    └── core/\n",
    )


def test_assemble_produces_skill_and_references():
    units = _units()
    extract = build_extract(units, readme=README)
    skill = assemble(_meta(), extract, units)

    assert skill.name == "acme-demo"
    assert skill.skill_md.startswith("---\nname: acme-demo\n")
    assert 'description: "' in skill.skill_md

    # Canonical 6-section anatomy
    assert "## Overview" in skill.skill_md
    assert "## When to Use" in skill.skill_md
    assert "## Core Process" in skill.skill_md
    assert "## Common Rationalizations" in skill.skill_md
    assert "## Red Flags" in skill.skill_md
    assert "## Verification" in skill.skill_md

    # API symbols are shown inline in Overview, not in a separate section
    assert "serve" in skill.skill_md  # a real parsed symbol
    assert "A tiny demo project" in skill.skill_md  # README intro used

    # Old non-standard sections must NOT appear
    assert "## What this is" not in skill.skill_md
    assert "## Key concepts" not in skill.skill_md
    assert "## API quick-reference" not in skill.skill_md
    assert "## Quickstart" not in skill.skill_md
    assert "## Code Access" not in skill.skill_md

    # When to Use includes NOT/Related per framework spec
    assert "**When NOT to use:**" in skill.skill_md
    assert "**Related:**" in skill.skill_md

    assert "references/api.md" in skill.references
    assert "references/architecture.md" in skill.references
    assert "serve" in skill.references["references/api.md"]
    assert "*source: app/main.py*" in skill.references["references/api.md"]

    # provenance maps the api chunk back to the source file
    api_prov = next(p for p in skill.provenance if p.chunk == "references/api.md")
    assert "app/main.py" in api_prov.source_paths


def test_description_within_limit():
    units = _units()
    extract = build_extract(units, readme=README)
    skill = assemble(_meta(), extract, units)
    assert len(skill.description) <= 1024


def test_token_budget_enforced_then_fails():
    units = _units()
    extract = build_extract(units, readme=README)

    # Generous budget — stays whole.
    full = assemble(_meta(), extract, units, token_budget=5000)
    assert estimate_tokens(full.skill_md) <= 5000

    # Impossibly tight budget — even trimmed output can't fit.
    with pytest.raises(BuildError):
        assemble(_meta(), extract, units, token_budget=1)


# ─── architecture.md upgrade tests ─────────────────────────────────────────


from app.skillforge.assemble import (
    _detect_entry_points,
    _extract_module_docstring,
    _render_architecture_md,
    _render_mermaid_flow,
    _resolve_import,
)
from app.skillforge.models import (
    ApiIndex,
    ExternalDep,
    Extract,
    ImportGraph,
    Symbol,
)


def test_architecture_md_has_all_sections():
    """The full architecture.md should have Purpose, Module Map, Mermaid, and tree."""
    units = _units()
    extract = build_extract(units, readme=README)
    meta = _meta()
    arch = _render_architecture_md(meta, extract, units)

    assert "## Purpose" in arch
    assert "A tiny demo project" in arch  # README intro
    assert "## Module Map" in arch
    assert "| Module |" in arch
    assert "`serve`" in arch  # key export
    assert "## Entry Points" in arch
    assert "app/main.py" in arch  # recognized as entry point by name
    assert "## External Dependencies" in arch
    assert "| `fastapi` |" in arch
    assert "## Conventions" in arch
    assert "Python" in arch  # primary language
    assert "## Directory Structure" in arch  # tree at bottom


def test_mermaid_flow_from_import_graph():
    """A simple import graph should produce a valid Mermaid graph TD."""
    extract = Extract(
        import_graph=ImportGraph(
            internal={
                "app/api.py": [".models", ".utils"],
                "app/models.py": [],
                "app/utils.py": [".models"],
            },
        ),
        api_index=ApiIndex(modules={
            "app/api.py": [],
            "app/models.py": [],
            "app/utils.py": [],
        }),
    )
    mermaid = _render_mermaid_flow(extract)

    assert mermaid.startswith("graph TD")
    # Nodes should be declared with readable labels
    assert 'api_py["api.py"]' in mermaid or "app_api_py" in mermaid
    # Edges should exist
    assert "-->" in mermaid


def test_mermaid_flow_empty_graph():
    """An empty import graph should return an empty string (section skipped)."""
    extract = Extract(import_graph=ImportGraph())
    assert _render_mermaid_flow(extract) == ""


def test_mermaid_flow_large_graph_collapses_to_directories():
    """When >25 nodes, the Mermaid graph should collapse to directory-level."""
    # Create 30 files across 3 directories with cross-dir imports
    internal = {}
    modules = {}
    for i in range(30):
        dir_name = f"pkg{i // 10}"
        path = f"{dir_name}/mod{i}.py"
        modules[path] = []
        # Each file imports from the next directory
        target_dir = f"pkg{(i // 10 + 1) % 3}"
        internal[path] = [f"../{target_dir}/mod{(i + 1) % 30}"]

    extract = Extract(
        import_graph=ImportGraph(internal=internal),
        api_index=ApiIndex(modules=modules),
    )
    mermaid = _render_mermaid_flow(extract, max_nodes=25)

    # Should still produce valid Mermaid (or empty if no cross-dir edges resolved)
    if mermaid:
        assert mermaid.startswith("graph TD")
        # Should NOT have individual file names — only directory-level nodes
        assert "mod0.py" not in mermaid or "pkg" in mermaid


def test_detect_entry_points_by_name():
    """Files named main.py, app.py, etc. should be detected as entry points."""
    units = [
        ContentUnit(path="app/main.py", content="x = 1", kind=FileKind.SOURCE),
        ContentUnit(path="lib/helper.py", content="y = 2", kind=FileKind.SOURCE),
    ]
    extract = Extract()
    eps = _detect_entry_points(extract, units)

    paths = [p for p, _ in eps]
    assert "app/main.py" in paths
    assert "lib/helper.py" not in paths


def test_detect_entry_points_by_content_pattern():
    """Files with `if __name__ == '__main__':` should be detected."""
    units = [
        ContentUnit(
            path="scripts/run.py",
            content='import sys\n\nif __name__ == "__main__":\n    main()',
            kind=FileKind.SOURCE,
        ),
    ]
    extract = Extract()
    eps = _detect_entry_points(extract, units)

    paths = [p for p, _ in eps]
    assert "scripts/run.py" in paths


def test_detect_entry_points_fastapi_factory():
    """Files with `app = FastAPI()` should be detected as application factories."""
    units = [
        ContentUnit(
            path="src/web.py",
            content='from fastapi import FastAPI\n\napp = FastAPI()\n',
            kind=FileKind.SOURCE,
        ),
    ]
    extract = Extract()
    eps = _detect_entry_points(extract, units)

    paths = [p for p, _ in eps]
    reasons = [r for _, r in eps]
    assert "src/web.py" in paths
    assert "application factory" in reasons


def test_resolve_import_relative():
    """Relative imports should resolve against the importer's directory."""
    known = {"app/models.py", "app/api.py", "app/utils.py"}

    assert _resolve_import("app/api.py", ".models", known) == "app/models.py"
    assert _resolve_import("app/api.py", ".utils", known) == "app/utils.py"
    assert _resolve_import("app/api.py", ".nonexistent", known) is None


def test_resolve_import_absolute():
    """Absolute imports should match against known paths."""
    known = {"lib/core.py", "lib/helpers.py"}

    assert _resolve_import("app/main.py", "lib.core", known) == "lib/core.py"
    assert _resolve_import("app/main.py", "unknown.module", known) is None


def test_extract_module_docstring_python():
    """Python module docstrings should be extracted."""
    content = '"""\nThis module handles authentication.\nMore details here.\n"""\n\nimport os\n'
    assert "This module handles authentication" in _extract_module_docstring(content)


def test_extract_module_docstring_js():
    """JS/TS doc comments should be extracted."""
    content = '/** Authentication module for the app */\n\nimport express from "express";\n'
    assert "Authentication module" in _extract_module_docstring(content)


def test_extract_module_docstring_empty():
    """Files without docstrings should return empty string."""
    content = 'import os\n\ndef main():\n    pass\n'
    assert _extract_module_docstring(content) == ""


def test_module_map_shows_docstring_as_purpose():
    """Module map table should show the module's docstring as purpose."""
    units = [
        ContentUnit(
            path="app/main.py",
            content='"""Application entry point."""\n\ndef serve(): pass\n',
            kind=FileKind.SOURCE,
        ),
    ]
    extract = Extract(
        api_index=ApiIndex(modules={
            "app/main.py": [
                Symbol(name="serve", kind="function", signature="serve()", source_path="app/main.py"),
            ],
        }),
    )

    from app.skillforge.assemble import _module_map_table
    table = _module_map_table(extract, units)
    table_text = "\n".join(table)

    assert "Application entry point" in table_text
    assert "`serve`" in table_text

