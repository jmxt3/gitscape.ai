"""
Obfuscation / evasion rules (GS-OBF).

Hidden text (zero-width, bidi), encoded payloads, and homoglyph tokens — the
tricks used to smuggle instructions or code past a human reviewer. The
invisible-char and homoglyph checks are functional (they inspect codepoints);
the encoded-blob checks are pattern rules with an entropy refinement.

Portions derived from NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector),
Apache-2.0. See THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

import base64
import re
import unicodedata
from typing import Optional

from ...models import Confidence, ScanFinding, Severity
from ..context import ScanContext, line_of, shannon_entropy
from ..registry import DROP, Rule
from ..taxonomy import Category

C = Category.OBFUSCATION

# invisible / control characters that must not survive into shipped text
_INVISIBLE = {
    0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF,  # zero-width
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,  # bidi embeddings/overrides
    0x2066, 0x2067, 0x2068, 0x2069, 0x200E, 0x200F, 0x061C,  # isolates / marks
}

_LATIN = re.compile(r"[A-Za-z]")
# Non-Latin letters commonly used as Latin homoglyphs. Beyond Cyrillic (а, е, о,
# р, с, х …) and Greek (ο, ν, α …) this now also covers Cherokee, Greek
# Extended, and fullwidth Latin forms — the confusable ranges SkillSpector maps.
_CONFUSABLE = re.compile(r"[Ѐ-ӿͰ-Ͽἀ-῿Ꭰ-᏿Ａ-ｚ]")
_WORD = re.compile(r"[^\s]{3,}")

# Payload signatures worth escalating a base64 data-URI to CRITICAL when decoded.
_DECODED_DANGER = re.compile(
    r"(curl|wget)\b[^\n|]{0,80}\|\s*(sh|bash|zsh|python3?)"
    r"|\b(exec|eval)\s*\(|new\s+Function\s*\(|/dev/tcp/|\bnc\s+[^\n]*-e\b"
    r"|\brm\s+-rf\b|Invoke-Expression|\biex\b|base64\s+-d",
    re.I)
# base64 magic prefixes for embedded binary assets (PNG/JPEG/GIF/BMP/ICO/WOFF).
_ASSET_MAGIC = (b"\x89PNG", b"GIF8", b"\xff\xd8\xff", b"BM", b"\x00\x00\x01\x00", b"wOFF", b"wOF2")


def _check_invisible(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    findings: list[ScanFinding] = []
    for label, text in ctx.all_surfaces():
        for i, ch in enumerate(text):
            if ord(ch) in _INVISIBLE:
                findings.append(rule.finding(
                    file=label, line=line_of(text, i),
                    snippet=f"U+{ord(ch):04X}",
                ))
                break  # one finding per file is enough to gate
    return findings


def _check_homoglyph(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    findings: list[ScanFinding] = []
    for label, text in ctx.all_surfaces():
        for m in _WORD.finditer(text):
            token = m.group(0)
            if _LATIN.search(token) and _CONFUSABLE.search(token):
                findings.append(rule.finding(
                    file=label, line=line_of(text, m.start()), snippet=token,
                ))
                break  # one representative token per file
    return findings


def _refine_entropy_blob(m: re.Match, text: str, label: str) -> Optional[tuple[Severity, Confidence]]:
    # Only fire when the base64-like run is actually high-entropy.
    return DROP if shannon_entropy(m.group(0)) < 4.0 else (Severity.MEDIUM, Confidence.MEDIUM)


def _refine_data_uri(m: re.Match, text: str, label: str) -> Optional[tuple[Severity, Confidence]]:
    """Decode a base64 data URI: escalate to CRITICAL when it hides an executable
    payload, drop embedded media assets, drop clean text (low-signal)."""
    blob = m.group(1)
    try:
        raw = base64.b64decode(blob + "=" * (-len(blob) % 4))
    except Exception:
        return None  # present but undecodable — keep the declared MEDIUM warn
    if any(raw.startswith(magic) for magic in _ASSET_MAGIC):
        return DROP  # embedded image/font, not a smuggled payload
    if _DECODED_DANGER.search(raw.decode("utf-8", "replace")):
        return (Severity.CRITICAL, Confidence.HIGH)
    return DROP


RULES: list[Rule] = [
    Rule(
        id="GS-OBF-001", name="hidden.invisible_char", category=C,
        severity=Severity.HIGH, confidence=Confidence.HIGH,
        check=_check_invisible,
        message="Hidden text: zero-width or bidirectional control character.",
        remediation="Strip the invisible characters; they can smuggle instructions past review.",
    ),
    Rule(
        id="GS-OBF-002", name="exfil.high_entropy_blob", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"[A-Za-z0-9+/]{120,}={0,2}"), refine=_refine_entropy_blob,
        message="High-entropy base64-like blob (possible hidden payload).",
    ),
    Rule(
        id="GS-OBF-003", name="obfuscation.escape_run", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"(?:\\x[0-9a-fA-F]{2}){20,}|(?:\\u[0-9a-fA-F]{4}){10,}"),
        message="Dense hex/unicode escape run (encoded string, likely obfuscation).",
    ),
    Rule(
        id="GS-OBF-004", name="obfuscation.char_chain_exec", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"(exec|eval)\s*\([^)]{0,40}\[::-1\]|(?:chr\(\d+\)\s*\+\s*){4,}chr\(\d+\)",
            re.I),
        message="String-reversal / chr() chain feeding an exec/eval (obfuscated code).",
    ),
    Rule(
        id="GS-OBF-005", name="obfuscation.homoglyph", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        check=_check_homoglyph,
        message="Mixed-script homoglyph token (Latin + Cyrillic/Greek) — visual spoofing.",
    ),
    Rule(
        id="GS-OBF-006", name="obfuscation.data_uri_payload", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.MEDIUM,
        pattern=re.compile(r"data:[\w.+-]*/?[\w.+-]*;base64,([A-Za-z0-9+/]{16,}={0,2})", re.I),
        refine=_refine_data_uri,
        message="Base64 data-URI payload (decodes to executable content).",
        remediation="Remove the embedded data-URI payload; smuggled base64 must not ship in a skill.",
    ),
]
