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
import unicodedata
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

# ---------------------------------------------------------------------------
# Pre-filter: guard rails before any snippet reaches the assembled skill.
#
# Test fixtures and README examples sometimes contain adversarial strings as
# part of their own test data (e.g. "Ignore all previous instructions").
# Without this filter those strings flow into references/examples.md and
# trigger CRITICAL ScapeGuard findings (GS-INJ-001, GS-OBF-001, GS-OBF-005)
# on every skill that includes such a file.
# ---------------------------------------------------------------------------

# Prompt-injection phrases (mirrors GS-INJ-001 / GS-INJ-006 patterns).
_INJECTION_RE = re.compile(
    r"\b(ignore|disregard|forget)\b[^.\n]{0,40}"
    r"\b(previous|prior|above|preceding|earlier|all)\b[^.\n]{0,40}"
    r"\b(instruction|instructions|prompt|prompts|direction|directions|context|rules?)\b"
    r"|\byou (?:must|will) (?:always )?(?:comply|obey)\b"
    r"|\b(?:never|do not|don't) (?:refuse|decline|reject|say no)\b"
    r"|\byou have no (?:restrictions|limitations|filters|guidelines|rules)\b"
    r"|\bignore your (?:guidelines|training|safety|restrictions|programming|policies)\b"
    r"|\b(?:enable|activate|enter) (?:dan|developer|jailbreak|unrestricted) mode\b"
    r"|\byou are (?:now )?dan\b",
    re.I,
)

# Invisible / bidirectional control codepoints (mirrors GS-OBF-001).
_INVISIBLE = frozenset([
    0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
    0x2066, 0x2067, 0x2068, 0x2069, 0x200E, 0x200F, 0x061C,
])

# Homoglyph detector (mirrors GS-OBF-005): a token mixing Latin with
# Cyrillic/Greek/fullwidth characters.
_LATIN_RE = re.compile(r"[A-Za-z]")
_CONFUSABLE_RE = re.compile(r"[Ѐ-ӿͰ-Ͽἀ-῿Ꭰ-᏿Ａ-ｚ]")
_WORD_RE = re.compile(r"[^\s]{3,}")


def _has_invisible(text: str) -> bool:
    return any(ord(ch) in _INVISIBLE for ch in text)


def _has_homoglyph(text: str) -> bool:
    for m in _WORD_RE.finditer(text):
        token = m.group(0)
        if _LATIN_RE.search(token) and _CONFUSABLE_RE.search(token):
            return True
    return False


def _is_safe(code: str) -> bool:
    """Return False if the snippet contains injection or obfuscation patterns."""
    if _INJECTION_RE.search(code):
        return False
    if _has_invisible(code):
        return False
    if _has_homoglyph(code):
        return False
    return True


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


def build_examples(units: list[ContentUnit]) -> list[CodeExample]:
    seen: set[str] = set()
    scored: list[tuple[int, CodeExample]] = []

    for lang, code, path in _candidates(units):
        if len(code) < _MIN_LEN:
            continue
        # Drop snippets that would trigger ScapeGuard injection/obfuscation gates.
        if not _is_safe(code):
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
