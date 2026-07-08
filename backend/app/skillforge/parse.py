"""
Parse stage: turn a source into a list of ContentUnit.

Two producers, one downstream shape:
  - parse_digest(text)   — re-parse a Gitingest-style digest by its FILE: markers
                           (used by /skill-zip rebuilds and all tests).
  - units_from_clone(root) — read the live clone (the primary /converter path),
                           reusing converter's file-walk and ignore rules.

The digest has a single producer (converter.generate_markdown_digest): a 48-`=`
separator line, then `FILE: <path>`, then another separator, then the content.
The splitter is tolerant (>=3 `=`, optional trailing separator) and therefore
also accepts upstream Gitingest output.

Author: GitScape.ai
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from app import converter
from app.skill_builder import EXT_TO_LANGUAGE

from .classify import classify_path
from .models import ContentUnit, DigestDoc

# A FILE block header: a separator line, a `FILE: <path>` line, another separator.
_MARKER = re.compile(r"(?m)^={3,}[ \t]*\nFILE:[ \t]*(?P<path>.+?)[ \t]*\n={3,}[ \t]*\n")

_RE_REPO = re.compile(r"(?m)^Repository:[ \t]*(?P<url>.+?)[ \t]*$")
_RE_FILES = re.compile(r"(?m)^Files analyzed:[ \t]*(?P<n>\d+)")


def _language_for(path: str) -> Optional[str]:
    return EXT_TO_LANGUAGE.get(Path(path).suffix.lower())


def _make_unit(path: str, content: str) -> ContentUnit:
    rel = path.replace("\\", "/").strip()
    return ContentUnit(
        path=rel,
        content=content,
        language=_language_for(rel),
        kind=classify_path(rel, content),
        size=len(content.encode("utf-8")),
    )


def parse_digest(text: str) -> DigestDoc:
    """Split a digest stream into ContentUnits plus header metadata."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    matches = list(_MARKER.finditer(text))
    header = text[: matches[0].start()] if matches else text

    repo_url = ""
    m = _RE_REPO.search(header)
    if m:
        repo_url = m.group("url").strip()

    files_declared = None
    m = _RE_FILES.search(header)
    if m:
        files_declared = int(m.group("n"))

    tree = ""
    idx = header.find("Directory structure:")
    if idx != -1:
        tree = header[idx + len("Directory structure:") :].strip("\n")

    units: list[ContentUnit] = []
    for i, mt in enumerate(matches):
        path = mt.group("path")
        start = mt.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        # converter prepends a blank line before each separator block; trim the
        # surrounding blank lines but preserve interior code formatting.
        content = text[start:end].strip("\n")
        units.append(_make_unit(path, content))

    return DigestDoc(
        repo_url=repo_url,
        files_analyzed=files_declared if files_declared is not None else len(units),
        tree=tree,
        units=units,
    )


def units_from_clone(root: Path) -> list[ContentUnit]:
    """Build ContentUnits directly from a cloned repo on disk.

    Reuses converter.get_all_text_files so the unit set matches exactly what the
    digest would contain (same ignore rules, same text-file filter).
    """
    units: list[ContentUnit] = []
    for fp in converter.get_all_text_files(root):
        try:
            content = fp.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = fp.relative_to(root).as_posix()
        units.append(_make_unit(rel, content))
    return units
