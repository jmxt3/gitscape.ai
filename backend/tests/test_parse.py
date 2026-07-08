import textwrap

from app import converter
from app.skillforge.models import FileKind
from app.skillforge.parse import parse_digest, units_from_clone

SEP = "=" * 48


def _digest(repo_url: str, n: int, *blocks: tuple[str, str]) -> str:
    parts = [f"Repository: {repo_url}", f"Files analyzed: {n}\n", "Directory structure:", "└── demo/", ""]
    for path, content in blocks:
        parts.append(SEP)
        parts.append(f"FILE: {path}")
        parts.append(SEP)
        parts.append(content)
        parts.append("")  # converter separates blocks with a blank line
    return "\n".join(parts)


def test_parse_digest_header_and_units():
    digest = _digest(
        "https://github.com/acme/demo",
        2,
        ("app/main.py", "def run():\n    return 1\n"),
        ("README.md", "# Demo\nHello.\n"),
    )
    doc = parse_digest(digest)

    assert doc.repo_url == "https://github.com/acme/demo"
    assert doc.files_analyzed == 2
    assert "demo/" in doc.tree
    assert [u.path for u in doc.units] == ["app/main.py", "README.md"]

    by_path = {u.path: u for u in doc.units}
    assert by_path["app/main.py"].language == "Python"
    assert by_path["app/main.py"].kind == FileKind.SOURCE
    assert "def run()" in by_path["app/main.py"].content
    assert by_path["README.md"].kind == FileKind.DOCS


def test_parse_digest_tolerant_to_missing_trailing_separator_and_short_rules():
    # 3-char rules and no blank line after the final file
    digest = (
        "Repository: https://example.com/x/y\n"
        "Files analyzed: 1\n\n"
        "===\nFILE: a.py\n===\n"
        "x = 1\n"
    )
    doc = parse_digest(digest)
    assert len(doc.units) == 1
    assert doc.units[0].path == "a.py"
    assert doc.units[0].content.strip() == "x = 1"


def test_parse_digest_matches_real_producer(tmp_path):
    """Round-trip: a digest produced by converter parses back to the same units
    that units_from_clone yields from the same directory."""
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "main.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    (tmp_path / "README.md").write_text("# Demo\n\nUsage here.\n", encoding="utf-8")
    (tmp_path / "pkg.ts").write_text("export const x = 1;\n", encoding="utf-8")

    digest = converter.generate_markdown_digest(
        "https://github.com/acme/demo", str(tmp_path), return_metadata=False
    )
    parsed = {u.path: u.content.strip() for u in parse_digest(digest).units}
    cloned = {u.path: u.content.strip() for u in units_from_clone(tmp_path)}

    assert parsed == cloned
    assert "app/main.py" in parsed
    assert parsed["app/main.py"] == "def run():\n    return 1"
