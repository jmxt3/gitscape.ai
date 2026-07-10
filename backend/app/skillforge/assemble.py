"""
Assemble stage.

Renders the slim, token-budgeted SKILL.md plus the deterministic references/*.md,
every chunk stamped with the repo paths it came from.  Both the Code Skill and
Framework (Engineering) Skill paths now produce the canonical 6-section anatomy:

    Overview · When to Use · Core Process · Common Rationalizations · Red Flags · Verification

SKILL.md links into references/ for detail (progressive disclosure); the full
digest is not bundled.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from urllib.parse import quote
from dataclasses import dataclass, field

from app.skill_builder import generate_skill_name

from .errors import BuildError
from .models import (
    ContentUnit,
    Extract,
    FileKind,
    FrameworkProseFields,
    ProseFields,
    ProvenanceEntry,
    RepoMeta,
    Symbol,
)
from .sanitize import sanitize_prose

TOKEN_BUDGET = 5000  # SKILL.md hard cap for Code Skills
FRAMEWORK_TOKEN_BUDGET = 10_000  # Engineering Skills — all 6 sections are load-bearing
_MAX_QUICKREF = 20  # API symbols shown inline in Overview (trimmed under budget pressure)


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


@dataclass
class AssembledSkill:
    name: str
    description: str
    skill_md: str
    references: dict[str, str] = field(default_factory=dict)
    provenance: list[ProvenanceEntry] = field(default_factory=list)


# ─── description + prose ───────────────────────────────────────────────────


def _description(meta: RepoMeta, extract: Extract) -> str:
    """Build a description following the framework template:

    "[Third-person capability]. Use when [trigger 1], [trigger 2], or when
    the user mentions '[phrase]'. Not for [near-miss exclusion]."

    The description is the *only* thing in context before activation — it is
    the triggering mechanism. It must contain both WHAT (capability) and WHEN
    (concrete trigger conditions and user phrasings). It must NOT summarize
    the workflow steps.
    """
    langs = ", ".join(meta.primary_languages) or "multiple languages"
    repo = meta.repo
    n_sym = extract.api_index.total

    # Third-person capability statement
    capability = f"Guides agents through working with the {meta.owner}/{repo} codebase ({langs})"

    # Concrete trigger conditions with user phrasings
    if n_sym > 0:
        triggers = (
            f"Use when extending, debugging, or navigating {repo}, "
            f"or when the user mentions '{repo}', '{meta.owner}/{repo}', "
            f"or asks about its architecture, modules, or public API"
        )
    else:
        triggers = (
            f"Use when working with or extending {repo}, "
            f"or when the user mentions '{repo}', '{meta.owner}/{repo}', "
            f"or asks about its patterns, setup, or configuration"
        )

    # Near-miss exclusion
    exclusion = f"Not for general {langs} questions unrelated to {repo}"

    desc = f"{capability}. {triggers}. {exclusion}."
    return sanitize_prose(desc)[:1024]


_BADGE = re.compile(r"^\s*(\[!\[|!\[|<img|<p|<a|=+\s*$|-+\s*$)")


def _readme_intro(readme: str) -> str:
    if not readme:
        return ""
    para: list[str] = []
    for line in readme.splitlines():
        s = line.strip()
        if not s:
            if para:
                break
            continue
        if s.startswith("#") or _BADGE.match(s):
            if para:
                break
            continue
        para.append(s)
    return " ".join(para)[:600]


def _what_this_is(meta: RepoMeta, extract: Extract) -> str:
    intro = sanitize_prose(_readme_intro(meta.readme))
    if intro:
        return intro
    langs = ", ".join(meta.primary_languages) or "multiple languages"
    if extract.api_index.total > 0:
        return (
            f"{meta.owner}/{meta.repo} is a {langs} project with "
            f"{extract.api_index.total} public symbols across "
            f"{len(extract.api_index.modules)} source files."
        )
    return f"{meta.owner}/{meta.repo} is a {langs} project."


_TOP_DIR = re.compile(r"^(?:├── |└── )([\w.\-]+)/\s*$")


def _top_dirs(meta: RepoMeta) -> list[str]:
    """Top-level directories only (depth-0 entries of the shallow tree)."""
    seen: set[str] = set()
    out: list[str] = []
    for line in meta.structure_overview.splitlines():
        m = _TOP_DIR.match(line)
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            out.append(m.group(1))
    return out[:8]


# ─── references ────────────────────────────────────────────────────────────


def _fmt_symbol(sym: Symbol) -> str:
    line = f"- **`{sym.name}`** — `{sym.signature}`"
    if sym.summary:
        line += f"\n  {sym.summary}"
    return line


def _render_api_md(extract: Extract) -> str:
    if not extract.api_index.modules:
        return ""
    out = ["# API Reference", "", "Generated from parsed symbols — names, signatures, and the one-line purpose from each docstring/comment.", ""]
    for path, syms in extract.api_index.modules.items():
        out.append(f"## `{path}`")
        out.append(f"*source: {path}*")
        out.append("")
        for s in syms:
            out.append(_fmt_symbol(s))
        out.append("")
    return "\n".join(out).strip() + "\n"


def _render_architecture_md(meta: RepoMeta, extract: Extract, units: list[ContentUnit] | None = None) -> str:
    """Render a rich, agent-actionable architecture reference.

    Sections (in order of actionability):
    1. Purpose — what this project does (README intro)
    2. Entry Points — where to start
    3. Module Map — what each module does + key exports
    4. Dependency Flow — Mermaid graph from import graph
    5. External Dependencies — packages + declaring manifest
    6. Conventions — patterns the agent should follow
    7. Directory Structure — raw tree (least actionable, at the bottom)
    """
    out = ["# Architecture", ""]

    # ─── Purpose ───────────────────────────────────────────────────────────
    intro = sanitize_prose(_readme_intro(meta.readme))
    if intro:
        out += ["## Purpose", "", intro, ""]

    # ─── Entry Points ──────────────────────────────────────────────────────
    entry_points = _detect_entry_points(extract, units or [])
    if entry_points:
        out += ["## Entry Points", ""]
        for ep_path, ep_reason in entry_points:
            out.append(f"- `{ep_path}` — {ep_reason}")
        out.append("")

    # ─── Module Map ────────────────────────────────────────────────────────
    if extract.api_index.modules:
        table = _module_map_table(extract, units)
        out += ["## Module Map", ""] + table + [""]

    # ─── Dependency Flow (Mermaid) ─────────────────────────────────────────
    mermaid = _render_mermaid_flow(extract)
    if mermaid:
        out += ["## Dependency Flow", "", "```mermaid", mermaid, "```", ""]

    # ─── External Dependencies ─────────────────────────────────────────────
    if extract.import_graph.external:
        out += [
            "## External Dependencies", "",
            "| Package | Declared in |", "|---|---|",
        ]
        for dep in extract.import_graph.external:
            out.append(f"| `{dep.name}` | `{dep.source_path}` |")
        out.append("")

    # ─── Conventions ───────────────────────────────────────────────────────
    conventions = _conventions_section(meta, extract, units or [])
    if conventions:
        out += ["## Conventions", ""] + conventions + [""]

    # ─── Directory Structure (least actionable — last) ─────────────────────
    tree = meta.structure_overview or meta.file_structure
    if tree.strip():
        out += ["## Directory Structure", "", "```", tree.strip(), "```", ""]

    return "\n".join(out).strip() + "\n"


# ─── architecture helpers ──────────────────────────────────────────────────


_ENTRY_POINT_NAMES = {
    "main.py", "app.py", "cli.py", "__main__.py", "server.py", "manage.py",
    "index.ts", "index.js", "index.tsx", "index.jsx",
    "main.ts", "main.js", "main.go", "main.rs",
    "cmd/main.go",
}

_ENTRY_POINT_PATTERNS = [
    (re.compile(r'''if\s+__name__\s*==\s*['"]__main__['"]\s*:'''), "script entry point"),
    (re.compile(r'''app\s*=\s*(?:FastAPI|Flask|Django|Express|Starlette)\s*\('''), "application factory"),
    (re.compile(r'''createApp\s*\(|createServer\s*\('''), "application factory"),
    (re.compile(r'''func\s+main\s*\(\s*\)'''), "Go main function"),
    (re.compile(r'''fn\s+main\s*\(\s*\)'''), "Rust main function"),
]


def _detect_entry_points(
    extract: Extract, units: list[ContentUnit], max_entries: int = 6,
) -> list[tuple[str, str]]:
    """Detect likely entry points by filename patterns and content signatures."""
    found: list[tuple[str, str]] = []
    seen: set[str] = set()

    # Check API modules for known entry-point filenames
    all_paths = set(extract.api_index.modules.keys())
    for u in units:
        all_paths.add(u.path)

    for path in sorted(all_paths):
        from pathlib import PurePosixPath
        name = PurePosixPath(path).name.lower()
        if name in _ENTRY_POINT_NAMES and path not in seen:
            seen.add(path)
            found.append((path, "application entry point"))

    # Scan unit content for entry-point patterns
    for u in units:
        if u.path in seen:
            continue
        if u.kind not in (FileKind.SOURCE,):
            continue
        for pattern, reason in _ENTRY_POINT_PATTERNS:
            if pattern.search(u.content):
                seen.add(u.path)
                found.append((u.path, reason))
                break

    return found[:max_entries]


def _sanitize_mermaid_id(path: str) -> str:
    """Convert a file path to a valid Mermaid node ID.

    Mermaid node IDs cannot contain `/`, `.`, `-`, or spaces.
    """
    return re.sub(r"[^a-zA-Z0-9_]", "_", path)


def _render_mermaid_flow(
    extract: Extract, max_nodes: int = 25,
) -> str:
    """Generate a Mermaid dependency flow diagram from the internal import graph.

    When the graph exceeds max_nodes, collapses to directory-level nodes.
    Returns empty string if no internal imports exist.
    """
    internal = extract.import_graph.internal
    if not internal:
        return ""

    # Collect all nodes and edges
    all_paths = set(internal.keys())
    edges: list[tuple[str, str]] = []

    for importer, imported_modules in internal.items():
        from pathlib import PurePosixPath
        importer_dir = str(PurePosixPath(importer).parent)
        for mod in imported_modules:
            # Try to resolve relative imports to actual paths
            target = _resolve_import(importer, mod, all_paths)
            if target and target != importer:
                edges.append((importer, target))
                all_paths.add(target)

    if not edges:
        return ""

    # If too many nodes, collapse to directory level
    if len(all_paths) > max_nodes:
        return _render_mermaid_directory_level(edges)

    # Build the Mermaid diagram
    lines = ["graph TD"]

    # Declare nodes with readable labels
    declared: set[str] = set()
    for path in sorted(all_paths):
        node_id = _sanitize_mermaid_id(path)
        if node_id not in declared:
            declared.add(node_id)
            from pathlib import PurePosixPath
            short = PurePosixPath(path).name
            lines.append(f'    {node_id}["{short}"]')

    # Add edges (deduplicated)
    seen_edges: set[tuple[str, str]] = set()
    for src, dst in edges:
        src_id = _sanitize_mermaid_id(src)
        dst_id = _sanitize_mermaid_id(dst)
        edge_key = (src_id, dst_id)
        if edge_key not in seen_edges and src_id != dst_id:
            seen_edges.add(edge_key)
            lines.append(f"    {src_id} --> {dst_id}")

    return "\n".join(lines)


def _render_mermaid_directory_level(edges: list[tuple[str, str]]) -> str:
    """Collapse a file-level graph to directory-level nodes for large repos."""
    from pathlib import PurePosixPath

    dir_edges: set[tuple[str, str]] = set()
    all_dirs: set[str] = set()

    for src, dst in edges:
        src_dir = str(PurePosixPath(src).parent) or "root"
        dst_dir = str(PurePosixPath(dst).parent) or "root"
        all_dirs.add(src_dir)
        all_dirs.add(dst_dir)
        if src_dir != dst_dir:
            dir_edges.add((src_dir, dst_dir))

    if not dir_edges:
        return ""

    lines = ["graph TD"]
    for d in sorted(all_dirs):
        node_id = _sanitize_mermaid_id(d)
        label = d + "/" if d != "root" else "root"
        lines.append(f'    {node_id}["{label}"]')

    for src_dir, dst_dir in sorted(dir_edges):
        lines.append(f"    {_sanitize_mermaid_id(src_dir)} --> {_sanitize_mermaid_id(dst_dir)}")

    return "\n".join(lines)


def _resolve_import(importer: str, module: str, known_paths: set[str]) -> str | None:
    """Best-effort resolve a relative import to a known file path.

    e.g. importer='app/api.py', module='.models' → 'app/models.py'
    """
    from pathlib import PurePosixPath

    if not module.startswith("."):
        # Absolute import — try matching against known paths
        candidates = [
            module.replace(".", "/") + ".py",
            module.replace(".", "/") + "/index.ts",
            module.replace(".", "/") + "/index.js",
            module.replace(".", "/") + ".ts",
            module.replace(".", "/") + ".js",
        ]
        for c in candidates:
            if c in known_paths:
                return c
        return None

    # Count leading dots for relative level
    dots = len(module) - len(module.lstrip("."))
    remainder = module.lstrip(".")

    base = PurePosixPath(importer).parent
    for _ in range(dots - 1):
        base = base.parent

    if remainder:
        rel_path = str(base / remainder.replace(".", "/"))
    else:
        rel_path = str(base / "__init__")

    # Try common extensions
    for ext in (".py", ".ts", ".js", ".tsx", ".jsx", ""):
        candidate = rel_path + ext
        if candidate in known_paths:
            return candidate

    # Try as a package (directory with __init__.py)
    init_candidate = rel_path + "/__init__.py"
    if init_candidate in known_paths:
        return init_candidate

    return None


def _module_map_table(extract: Extract, units: list[ContentUnit] | None = None) -> list[str]:
    """Build a Module Map table: path | symbol count | purpose | key exports.

    Purpose is derived from the module's top-level docstring (Option A).
    """
    # Pre-build a path→docstring lookup from units
    docstrings: dict[str, str] = {}
    if units:
        for u in units:
            if u.path in extract.api_index.modules:
                ds = _extract_module_docstring(u.content)
                if ds:
                    docstrings[u.path] = ds

    lines = [
        "| Module | Purpose | Symbols | Key exports |",
        "|---|---|---|---|",
    ]
    for path, syms in extract.api_index.modules.items():
        count = len(syms)
        purpose = docstrings.get(path, "—")
        top_exports = ", ".join(f"`{s.name}`" for s in syms[:3])
        if len(syms) > 3:
            top_exports += f" (+{len(syms) - 3} more)"
        lines.append(f"| `{path}` | {purpose} | {count} | {top_exports} |")
    return lines


_RE_MODULE_DOCSTRING = re.compile(
    r'^\s*(?:"""|\'\'\'|/\*\*|///?)\s*(.+?)(?:"""|\'\'\'|\*/)?\s*$',
    re.MULTILINE,
)


def _extract_module_docstring(content: str) -> str:
    """Extract the first-line purpose from a module's top-level docstring.

    Looks for Python triple-quote docstrings, JS/TS /** doc comments,
    or // leading comments at the very top of the file.
    Returns at most 80 characters.
    """
    lines = content.lstrip().splitlines()[:10]  # only scan first 10 lines
    if not lines:
        return ""

    # Python: """...""" or '''...''' at top level
    joined = "\n".join(lines)
    py_match = re.search(r'^(?:"""|\'\'\'|\s*"""\s*\n)\s*(.+?)(?:\.|\n)', joined)
    if py_match:
        return py_match.group(1).strip()[:80]

    # JS/TS: /** ... */ or // at top
    js_match = re.search(r'^\s*(?:/\*\*\s*\n?\s*\*?\s*|//\s*)(.+)', joined)
    if js_match:
        return js_match.group(1).strip().rstrip("*/").strip()[:80]

    return ""


def _conventions_section(
    meta: RepoMeta, extract: Extract, units: list[ContentUnit],
) -> list[str]:
    """Derive observable conventions from the codebase structure."""
    lines: list[str] = []

    # Primary languages
    if meta.primary_languages:
        langs = ", ".join(meta.primary_languages)
        lines.append(f"- Primary languages: {langs}")

    # Test structure
    test_paths = [u.path for u in units if u.kind == FileKind.TEST]
    if test_paths:
        from pathlib import PurePosixPath
        test_dirs = sorted({str(PurePosixPath(p).parent) for p in test_paths})[:3]
        lines.append(f"- Tests located in: {', '.join('`' + d + '`' for d in test_dirs)}")

    # Config locations
    config_paths = [u.path for u in units if u.kind == FileKind.CONFIG]
    if config_paths:
        from pathlib import PurePosixPath
        config_names = sorted({PurePosixPath(p).name for p in config_paths})[:5]
        lines.append(f"- Configuration files: {', '.join('`' + n + '`' for n in config_names)}")

    # Module count
    if extract.api_index.total > 0:
        lines.append(
            f"- {extract.api_index.total} public symbols across "
            f"{len(extract.api_index.modules)} source modules"
        )

    # External dependency count
    if extract.import_graph.external:
        lines.append(f"- {len(extract.import_graph.external)} external dependencies")

    return lines


def _render_examples_md(extract: Extract) -> str:
    if not extract.examples:
        return ""
    out = ["# Examples", ""]
    for i, ex in enumerate(extract.examples, 1):
        out.append(f"## Example {i} — `{ex.source_path}`")
        out.append("")
        out.append(f"```{ex.language}")
        out.append(ex.code)
        out.append("```")
        out.append("")
    return "\n".join(out).strip() + "\n"


def _render_setup_md(extract: Extract) -> str:
    setup = extract.setup
    if not setup.quickstart and not setup.commands:
        return ""
    out = ["# Setup", ""]
    if setup.quickstart:
        out.append(sanitize_prose(setup.quickstart))
        out.append("")
    if setup.commands:
        out += ["## Commands", "", "```bash"] + setup.commands + ["```", ""]
    return "\n".join(out).strip() + "\n"


def _render_config_md(units: list[ContentUnit], extract: Extract) -> str:
    config_paths = [u.path for u in units if u.kind == FileKind.CONFIG]
    if not config_paths and not extract.import_graph.external:
        return ""
    out = ["# Configuration", ""]
    if config_paths:
        out += ["## Config & manifest files", ""]
        out += [f"- `{p}`" for p in config_paths]
        out.append("")
    if extract.import_graph.external:
        out += ["## Declared dependencies", ""]
        out += [f"- `{d.name}`" for d in extract.import_graph.external]
        out.append("")
    return "\n".join(out).strip() + "\n"


def _build_references(meta: RepoMeta, extract: Extract, units: list[ContentUnit]):
    refs: dict[str, str] = {}
    prov: list[ProvenanceEntry] = []

    api = _render_api_md(extract)
    if api:
        refs["references/api.md"] = api
        prov.append(ProvenanceEntry(chunk="references/api.md", source_paths=list(extract.api_index.modules)))

    arch = _render_architecture_md(meta, extract, units)
    if arch:
        refs["references/architecture.md"] = arch
        prov.append(ProvenanceEntry(
            chunk="references/architecture.md",
            source_paths=list(extract.api_index.modules) + [d.source_path for d in extract.import_graph.external],
        ))

    examples = _render_examples_md(extract)
    if examples:
        refs["references/examples.md"] = examples
        prov.append(ProvenanceEntry(chunk="references/examples.md", source_paths=[e.source_path for e in extract.examples]))

    setup = _render_setup_md(extract)
    if setup:
        refs["references/setup.md"] = setup
        prov.append(ProvenanceEntry(chunk="references/setup.md", source_paths=[u.path for u in units if u.path.lower().startswith("readme") or "readme" in u.path.lower()]))

    config = _render_config_md(units, extract)
    if config:
        refs["references/config.md"] = config
        prov.append(ProvenanceEntry(chunk="references/config.md", source_paths=[u.path for u in units if u.kind == FileKind.CONFIG]))

    return refs, prov


# ─── SKILL.md ──────────────────────────────────────────────────────────────


def _flatten_symbols(extract: Extract) -> list[Symbol]:
    flat: list[Symbol] = []
    for syms in extract.api_index.modules.values():
        flat.extend(syms)
    return flat


def _when_to_use_lines(meta: RepoMeta, prose: ProseFields | None) -> list[str]:
    """Build the When to Use section body with positive triggers, negative
    exclusions, and related-skill cross-references per the framework spec."""
    langs = ", ".join(meta.primary_languages) or "multiple languages"
    if prose and prose.when_to_use:
        items = [f"- {sanitize_prose(item)}" for item in prose.when_to_use]
    else:
        items = [
            f"- Understanding the architecture and module layout of {meta.repo}",
            f"- Extending or modifying {meta.repo} consistent with its existing patterns",
            f"- Debugging issues by tracing through {meta.repo}'s modules and dependencies",
            f"- Setting up, running, or configuring {meta.repo}",
            f"- Calling functions, classes, or methods in {meta.repo}'s public API",
        ]
    items.append("")
    items.append(
        f"**When NOT to use:** General {langs} questions, "
        f"tutorials, or tasks unrelated to the {meta.repo} codebase."
    )
    items.append("")
    items.append(
        f"**Related:** For general {langs} guidance, use language-specific skills instead."
    )
    return items


def _render_skill_md(
    meta: RepoMeta,
    extract: Extract,
    name: str,
    description: str,
    ref_files: list[str],
    quickref_n: int,
    include_overview_detail: bool,
    prose: ProseFields | None = None,
    digest_filename: str | None = None,
) -> str:
    """Render the canonical 6-section Code Skill anatomy.

    Sections: Overview · When to Use · Core Process · Common Rationalizations ·
    Red Flags · Verification · References.  This matches the AGENT-SKILLS-FRAMEWORK
    specification (§3.2) so every generated skill is structurally compliant.
    """
    langs = ", ".join(meta.primary_languages) or "multiple languages"
    overview_text = sanitize_prose(prose.what_this_is) if (prose and prose.what_this_is) else _what_this_is(meta, extract)
    repo_title = meta.repo.replace("-", " ").replace("_", " ").title()

    lines: list[str] = [
        "---",
        f"name: {name}",
        f'description: "{description}"',
        "---",
        "",
        f"# {repo_title} Code Skill",
        "",
    ]

    # ─── Overview ──────────────────────────────────────────────────────────
    lines += ["## Overview", "", overview_text, ""]

    if include_overview_detail:
        dirs = _top_dirs(meta)
        if dirs:
            lines.append("Top-level areas: " + ", ".join(f"`{d}/`" for d in dirs) + ".")
            lines.append("")
        if extract.api_index.total > 0:
            lines.append(
                f"Primary languages: {langs}. "
                f"The codebase contains {extract.api_index.total} public symbols "
                f"across {len(extract.api_index.modules)} source files."
            )
        else:
            lines.append(f"Primary languages: {langs}.")
        lines.append("")

    # Inline API quick-reference (trimmed under budget pressure)
    flat = _flatten_symbols(extract)
    if flat and quickref_n > 0:
        lines.append("**Key symbols:**")
        lines.append("")
        for s in flat[:quickref_n]:
            summary = f" — {s.summary}" if s.summary else ""
            lines.append(f"- `{s.name}` `{s.signature}`{summary}")
        if len(flat) > quickref_n:
            lines.append("")
            lines.append(f"*…and {len(flat) - quickref_n} more — see `references/api.md`.*")
        lines.append("")

    # ─── When to Use ───────────────────────────────────────────────────────
    lines += ["## When to Use", "", *_when_to_use_lines(meta, prose), ""]

    # ─── Core Process ──────────────────────────────────────────────────────
    lines += [
        "## Core Process", "",
        "### Step 1: Understand the Architecture", "",
        f"Read the existing code in {meta.repo} before making changes. "
        "Check `references/architecture.md` to understand the module layout, "
        "dependency graph, and internal import structure. The goal is to extend "
        "existing patterns, not invent new ones.", "",
        "### Step 2: Locate Relevant Modules", "",
        f"Use `references/api.md` to find the public symbols, functions, and classes "
        f"relevant to the task. Trace the call chain through {meta.repo}'s internal "
        "imports to understand how the pieces connect.", "",
        "### Step 3: Make Changes Following Existing Patterns", "",
        f"Implement the change consistent with {meta.repo}'s established conventions: "
        "naming patterns, error handling style, module organization, and test structure. "
        "Consistency matters more than personal preference.", "",
        "### Step 4: Verify the Change", "",
        "Run the project's test suite and confirm all tests pass. If no tests exist "
        "for the changed behavior, write them first. Check that no regressions were "
        "introduced in adjacent modules.", "",
    ]

    # ─── Common Rationalizations ───────────────────────────────────────────
    lines += [
        "## Common Rationalizations", "",
        "| Rationalization | Reality |", "|---|---|",
        f'| "I know {meta.repo} well enough to skip reading the existing code" '
        '| Every session starts with stale context. Re-read the architecture '
        'reference before assuming you know the current state. |',
        f'| "This change is too small to need tests" '
        '| Small changes in unfamiliar codebases cause the most subtle regressions. '
        'A test that fails without the fix and passes with it is the minimum bar. |',
        f'| "I\'ll follow the patterns later, let me just get it working first" '
        '| Pattern violations compound. Code that works but violates the repository\'s '
        'conventions creates maintenance debt for every future contributor. |',
        "",
    ]

    # ─── Red Flags ─────────────────────────────────────────────────────────
    lines += [
        "## Red Flags", "",
        f"- Making changes to {meta.repo} without reading `references/architecture.md` first",
        "- Inventing new patterns instead of extending existing ones",
        "- Skipping the test suite before declaring the task complete",
        "- Modifying code outside the scope of the current task",
        "",
    ]

    # ─── Verification ──────────────────────────────────────────────────────
    lines += [
        "## Verification", "",
        "Before declaring this workflow complete, confirm each item with evidence:", "",
        f"- [ ] Changes follow {meta.repo}'s existing patterns — evidence: diff review against `references/architecture.md`",
        "- [ ] All tests pass — evidence: test runner output",
        "- [ ] No regressions introduced in adjacent modules — evidence: full test suite output",
        "- [ ] Code is consistent with the repository's naming and style conventions — evidence: code review",
        "",
    ]

    # ─── References ────────────────────────────────────────────────────────
    if ref_files or digest_filename:
        lines += ["## References", ""]
        labels = {
            "references/api.md": "Full API reference",
            "references/architecture.md": "Architecture & dependencies",
            "references/examples.md": "Usage examples",
            "references/setup.md": "Setup & commands",
            "references/config.md": "Configuration",
        }
        for rf in ref_files:
            lines.append(f"- [{labels.get(rf, rf)}]({rf})")
        if digest_filename:
            lines.append(f"- [Full Code Digest]({digest_filename})")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def _render_framework_skill_md(
    meta: RepoMeta,
    name: str,
    description: str,
    fw: FrameworkProseFields,
    ref_files: list[str] | None = None,
    digest_filename: str | None = None,
) -> str:
    """Render the canonical 6-section engineering skill anatomy.

    Every section is load-bearing and is always included. This renderer is
    only called from the HD path — fw is guaranteed non-None. Code Access
    content is folded into the References section as a bullet item.
    """
    repo_title = meta.repo.replace("-", " ").replace("_", " ").title()
    lines: list[str] = [
        "---",
        f"name: {name}",
        f'description: "{description}"',
        "---",
        "",
        f"# {repo_title} Code Skill",
        "",
    ]

    # ─── Overview ─────────────────────────────────────────────────────────
    lines += ["## Overview", ""]
    if fw.overview:
        lines.append(sanitize_prose(fw.overview))
    else:
        lines.append(
            f"{meta.owner}/{meta.repo} is a project that requires careful, structured engineering "
            "practices. This skill guides agents through the established patterns and workflows."
        )
    lines.append("")

    # ─── When to Use ──────────────────────────────────────────────────
    lines += ["## When to Use", ""]
    if fw.when_to_use:
        for item in fw.when_to_use:
            lines.append(f"- {sanitize_prose(item)}")
    else:
        lines.append(f"- Working within the {meta.repo} codebase")
        lines.append("- Making changes that affect existing patterns or architecture")
    if fw.when_not_to_use:
        lines.append("")
        lines.append(f"**When NOT to use:** {sanitize_prose(fw.when_not_to_use)}")
    else:
        langs = ", ".join(meta.primary_languages) or "multiple languages"
        lines.append("")
        lines.append(
            f"**When NOT to use:** General {langs} questions, "
            f"tutorials, or tasks unrelated to the {meta.repo} codebase."
        )
    if fw.related:
        lines.append("")
        lines.append(f"**Related:** {sanitize_prose(fw.related)}")
    else:
        langs = ", ".join(meta.primary_languages) or "multiple languages"
        lines.append("")
        lines.append(
            f"**Related:** For general {langs} guidance, use language-specific skills instead."
        )
    lines.append("")

    # ─── Core Process ────────────────────────────────────────────────
    lines += ["## Core Process", ""]
    if fw.core_process:
        for i, step in enumerate(fw.core_process, 1):
            lines.append(f"### Step {i}: {step.title}")
            lines.append("")
            lines.append(sanitize_prose(step.content))
            lines.append("")
    else:
        lines += [
            "### Step 1: Understand the Context",
            "",
            f"Read the existing code in {meta.repo} before making changes. "
            "Identify the patterns being extended, not invented.",
            "",
        ]

    # ─── Common Rationalizations ─────────────────────────────────────
    lines += ["## Common Rationalizations", ""]
    if fw.common_rationalizations:
        lines += ["| Rationalization | Reality |", "|---|---|"]  
        for r in fw.common_rationalizations:
            excuse = sanitize_prose(r.excuse).replace("|", "\\|")
            reality = sanitize_prose(r.reality).replace("|", "\\|")
            lines.append(f"| {excuse} | {reality} |")
    else:
        lines += [
            "| Rationalization | Reality |",
            "|---|---|",
            "| \"I know the codebase, I don't need to follow the process\" | "
            "Consistency matters more than speed. Future agents and engineers depend on predictable patterns. |",
        ]
    lines.append("")

    # ─── Red Flags ──────────────────────────────────────────────────────────
    lines += ["## Red Flags", ""]
    if fw.red_flags:
        for flag in fw.red_flags:
            lines.append(f"- {sanitize_prose(flag)}")
    else:
        lines.append("- Changes made without reading existing patterns first")
        lines.append("- No tests written before implementation")
    lines.append("")

    # ─── Verification ──────────────────────────────────────────────────────
    lines += ["## Verification", "",
              "Before declaring this workflow complete, confirm each item with evidence:", ""]
    if fw.verification:
        for item in fw.verification:
            if isinstance(item, str):
                lines.append(f"- [ ] {sanitize_prose(item)}")
            else:
                lines.append(f"- [ ] {sanitize_prose(item.criterion)} — evidence: {sanitize_prose(item.evidence)}")
    else:
        lines.append("- [ ] All tests pass — evidence: test runner output")
        lines.append(f"- [ ] Code follows existing patterns in {meta.repo} — evidence: diff review")
        lines.append("- [ ] No regressions introduced — evidence: full test suite output")
    lines.append("")

    # ─── References (includes Code Access as a bullet) ─────────────────────
    has_refs = (ref_files and len(ref_files) > 0) or digest_filename or meta.repo_url
    if has_refs:
        lines += ["## References", ""]
        labels = {
            "references/api.md": "Full API reference",
            "references/architecture.md": "Architecture & dependencies",
            "references/examples.md": "Usage examples",
            "references/setup.md": "Setup & commands",
            "references/config.md": "Configuration",
        }
        if ref_files:
            for rf in ref_files:
                lines.append(f"- [{labels.get(rf, rf)}]({rf})")
        if digest_filename:
            lines.append(f"- [Full Code Digest]({digest_filename})")
        if meta.repo_url:
            encoded_url = quote(meta.repo_url, safe="")
            lines.append(
                f"- [GitScape Code Digest](https://gitscape.ai/?repo={encoded_url}) — "
                f"full source digest via the GitScape API"
            )
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def assemble(
    meta: RepoMeta,
    extract: Extract,
    units: list[ContentUnit],
    token_budget: int = TOKEN_BUDGET,
    prose: ProseFields | None = None,
    framework_prose: FrameworkProseFields | None = None,
    prebuilt_references: dict[str, str] | None = None,
    digest_filename: str | None = None,
) -> AssembledSkill:
    """Assemble a SkillPackage.

    Both paths now produce the canonical 6-section skill anatomy:
    Overview · When to Use · Core Process · Common Rationalizations · Red Flags · Verification.

    When *framework_prose* is provided the LLM-generated content fills the sections.
    When only *prose* is provided the deterministic Code Skill path is used.
    """
    name = generate_skill_name(meta.owner, meta.repo)
    description = _description(meta, extract)

    if framework_prose is not None:
        # Engineering Skill path — HD, with budget enforcement
        if framework_prose.description:
            description = sanitize_prose(framework_prose.description)[:1024]
        # Use caller-supplied references (live-clone quality) when available;
        # fall back to digest-reconstructed references on a cold cache miss.
        if prebuilt_references is not None:
            references, provenance = prebuilt_references, []
        else:
            references, provenance = _build_references(meta, extract, units)
        ref_files = list(references.keys()) if isinstance(references, dict) else []

        skill_md = _render_framework_skill_md(
            meta, name, description, framework_prose,
            ref_files=ref_files, digest_filename=digest_filename,
        )
        # Budget enforcement for framework skills too
        fw_budget = max(token_budget, FRAMEWORK_TOKEN_BUDGET)
        if estimate_tokens(skill_md) > fw_budget:
            # Framework skills don't trim sections, but log the overage
            import logging
            logging.getLogger(__name__).warning(
                "Framework SKILL.md exceeds %d-token budget (%d tokens); "
                "proceeding without trimming (all sections are load-bearing).",
                fw_budget, estimate_tokens(skill_md),
            )
        return AssembledSkill(
            name=name,
            description=description,
            skill_md=skill_md,
            references=references,
            provenance=provenance,
        )

    # Code Skill path — deterministic + optional prose glue
    if prose and prose.description:
        description = sanitize_prose(prose.description)[:1024]
    references, provenance = _build_references(meta, extract, units)
    ref_files = list(references.keys())

    # Budget loop: trim API quick-ref rows in Overview, then drop Overview detail.
    quickref_n = _MAX_QUICKREF
    include_overview_detail = True
    while True:
        skill_md = _render_skill_md(
            meta, extract, name, description, ref_files, quickref_n,
            include_overview_detail, prose, digest_filename=digest_filename,
        )
        if estimate_tokens(skill_md) <= token_budget:
            break
        if quickref_n > 0:
            quickref_n = max(0, quickref_n - 5)
        elif include_overview_detail:
            include_overview_detail = False
        else:
            raise BuildError(
                f"SKILL.md exceeds the {token_budget}-token budget "
                f"({estimate_tokens(skill_md)} tokens) even after trimming."
            )

    return AssembledSkill(
        name=name,
        description=description,
        skill_md=skill_md,
        references=references,
        provenance=provenance,
    )
