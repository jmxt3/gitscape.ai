"""
Optional LLM adjudication layer (Gemini) — advisory only.

Off by default. Enabled with SCAN_LLM_JUDGE=1 *and* a configured GEMINI_API_KEY.
Two jobs:
  1. False-positive adjudication of MEDIUM/HIGH findings — it may only lower a
     finding's *confidence* and attach a note. It NEVER changes severity, drops
     findings, or touches the status/gate: the deterministic engine remains the
     sole authority on what blocks. This preserves the zero-LLM guarantee for
     the security gate while letting reviewers see an LLM's second opinion.
  2. A short (2-3 sentence) behavioral summary of what the skill actually does,
     stored in ScanReport.summary (Gen-Trust-Hub style).

Any failure (no key, network error, malformed JSON) returns the report
unchanged — the judge can only add signal, never remove safety.

Author: GitScape.ai
"""
from __future__ import annotations

import json
import logging
import os

from ..models import Confidence, ScanReport, Severity

logger = logging.getLogger(__name__)

_TIMEOUT = 20
_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# confidence rank so the judge can only ever LOWER confidence, never raise it
_RANK = {Confidence.LOW: 0, Confidence.MEDIUM: 1, Confidence.HIGH: 2}
_ADJUDICABLE = {Severity.MEDIUM, Severity.HIGH}


def judge_enabled() -> bool:
    if os.getenv("SCAN_LLM_JUDGE", "").strip() not in ("1", "true", "yes"):
        return False
    try:
        from app.config import settings

        return bool(settings.GEMINI_API_KEY)
    except Exception:
        return False


def _prompt(report: ScanReport, skill_md: str) -> str:
    findings = [
        {"id": f.id, "category": f.category, "severity": f.severity.value,
         "message": f.message, "file": f.file, "snippet": f.snippet}
        for f in report.findings if f.severity in _ADJUDICABLE
    ]
    return (
        "You are a security reviewer adjudicating STATIC-SCANNER findings on an AI "
        "agent skill. For each finding, judge whether it is a true positive given "
        "the skill's context. You may ONLY assess likelihood — you cannot change "
        "severity or remove protections.\n\n"
        "Return STRICT JSON with keys:\n"
        '  "summary": 2-3 sentence plain-English description of what this skill does.\n'
        '  "verdicts": array of {"id": string, "true_positive": bool, '
        '"confidence": "high"|"medium"|"low", "note": short string}.\n\n'
        "No markdown, JSON only.\n\n"
        f"=== SKILL.md (first 4000 chars) ===\n{skill_md[:4000]}\n\n"
        f"=== FINDINGS ===\n{json.dumps(findings, ensure_ascii=False)}"
    )


def _extract_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text, strict=False)


def maybe_adjudicate(report: ScanReport, *, skill_md: str) -> ScanReport:
    """Return the report, optionally enriched with LLM confidence notes + summary.

    Safe no-op unless SCAN_LLM_JUDGE=1 and a Gemini key is present. Never raises.
    """
    if not judge_enabled():
        return report
    try:
        import requests

        from app.config import settings

        model = getattr(settings, "HD_MODEL", "gemini-2.5-flash")
        url = _ENDPOINT.format(model=model)
        body = {
            "contents": [{"parts": [{"text": _prompt(report, skill_md)}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        resp = requests.post(url, params={"key": settings.GEMINI_API_KEY}, json=body, timeout=_TIMEOUT)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = _extract_json(text)
    except Exception:
        logger.exception("LLM judge failed; returning deterministic report unchanged")
        return report

    if isinstance(data.get("summary"), str):
        report.summary = data["summary"].strip()

    verdicts = {v.get("id"): v for v in (data.get("verdicts") or []) if isinstance(v, dict)}
    by_id = {f.id: f for f in report.findings}
    for fid, v in verdicts.items():
        f = by_id.get(fid)
        if f is None or f.severity not in _ADJUDICABLE:
            continue  # only ever touch MEDIUM/HIGH; CRITICAL gate is untouchable
        try:
            proposed = Confidence(str(v.get("confidence", "")).lower())
        except ValueError:
            proposed = None
        # Only ever LOWER confidence — the judge cannot strengthen a finding.
        if proposed is not None and _RANK[proposed] < _RANK[f.confidence]:
            f.confidence = proposed
        note = v.get("note")
        if isinstance(note, str) and note.strip():
            prefix = "LLM: false positive — " if v.get("true_positive") is False else "LLM: "
            f.remediation = (f.remediation + " " if f.remediation else "") + prefix + note.strip()
    return report
