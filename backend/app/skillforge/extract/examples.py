"""
Example mining.

Collects fenced code blocks from docs and short test files, dedupes by normalized
content hash, scores them, and keeps the top-N. The score favours runnable-looking
snippets (a call or assignment), a sensible length, and higher-priority languages.

Author: GitScape.ai
"""
from __future__ import annotations

import hashlib
import re
from pathlib import PurePosixPath

from ..models import CodeExample, ContentUnit, FileKind

_FENCE = re.compile(r"```([\w+-]*)\n(.*?)```", re.DOTALL)
_MIN_LEN = 20
_MAX_LEN = 1600
_TOP_N = 12

_LANG_PRIORITY = {
    "python": 3, "py": 3,
    "typescript": 3, "ts": 3, "tsx": 3,
    "javascript": 2, "js": 2, "jsx": 2,
    "go": 2,
    "bash": 1, "sh": 1, "shell": 1, "console": 1,
}
_SUFFIX_LANG = {
    ".py": "python", ".ts": "typescript", ".tsx": "tsx", ".js": "javascript",
    ".jsx": "javascript", ".go": "go",
}


def _normalize(code: str) -> str:
    return "".join(code.split()).lower()


def _norm_hash(code: str) -> str:
    return hashlib.sha256(_normalize(code).encode("utf-8")).hexdigest()


def _score(code: str, lang: str) -> int:
    score = _LANG_PRIORITY.get(lang.lower(), 0)
    if "(" in code and ")" in code:  # likely a call
        score += 2
    if re.search(r"[^=!<>]=[^=]", code):  # an assignment
        score += 1
    if _MIN_LEN <= len(code) <= _MAX_LEN:
        score += 1
    if len(code) > _MAX_LEN:
        score -= 1
    return score


def _candidates(units: list[ContentUnit]):
    for unit in units:
        if unit.kind == FileKind.DOCS:
            for info, body in _FENCE.findall(unit.content):
                yield info or "text", body.strip(), unit.path
        elif unit.kind == FileKind.TEST:
            body = unit.content.strip()
            if _MIN_LEN <= len(body) <= _MAX_LEN:  # only short, whole test files
                lang = _SUFFIX_LANG.get(PurePosixPath(unit.path).suffix.lower(), "text")
                yield lang, body, unit.path


def build_examples(units: list[ContentUnit]) -> list[CodeExample]:
    seen: set[str] = set()
    scored: list[tuple[int, CodeExample]] = []

    for lang, code, path in _candidates(units):
        if len(code) < _MIN_LEN:
            continue
        h = _norm_hash(code)
        if h in seen:
            continue
        seen.add(h)
        score = _score(code, lang)
        if score <= 0:
            continue
        scored.append((score, CodeExample(language=lang, code=code, source_path=path, score=score)))

    # Cap per source file to ensure diversity across reference files.
    # Without this, a single doc with many fenced blocks can dominate the top-N.
    _PER_FILE_CAP = 3
    file_counts: dict[str, int] = {}
    capped: list[tuple[int, CodeExample]] = []
    for score_val, ex in scored:
        count = file_counts.get(ex.source_path, 0)
        if count < _PER_FILE_CAP:
            capped.append((score_val, ex))
            file_counts[ex.source_path] = count + 1
    scored = capped

    # stable sort by score desc (Python's sort is stable, so insertion order is the tiebreak)
    scored.sort(key=lambda t: t[0], reverse=True)
    return [ex for _, ex in scored[:_TOP_N]]
