"""
Sanitize stage — prose only.

Normalizes generated prose so hidden-text tricks can't survive into SKILL.md:
NFKC normalization, removal of zero-width and bidirectional control characters,
and stripping of HTML comments. Never run this on code (it would corrupt it);
code safety is the scanner's job.

Author: GitScape.ai
"""
from __future__ import annotations

import re
import unicodedata

# zero-width + BOM
_ZERO_WIDTH = [0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]
# bidirectional / directional controls
_BIDI = [0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069, 0x200E, 0x200F, 0x061C]

_STRIP_TABLE = {cp: None for cp in (_ZERO_WIDTH + _BIDI)}
_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_HTML_TAG = re.compile(r"<[a-zA-Z/][^>]*>")


def strip_invisibles(text: str) -> str:
    """Remove zero-width + bidi control chars (no normalization)."""
    return text.translate(_STRIP_TABLE)


def sanitize_prose(text: str) -> str:
    """Full prose sanitization: NFKC, drop HTML comments and tags, strip invisibles."""
    text = unicodedata.normalize("NFKC", text)
    text = _HTML_COMMENT.sub("", text)
    text = _HTML_TAG.sub("", text)
    text = strip_invisibles(text)
    return text

