"""
HD mode — optional LLM prose via Gemini Flash.

The deterministic build is the default and makes ZERO LLM calls. HD only rewrites
short natural-language glue (the "what this is" paragraph, the "when to use"
bullets, and the description) from the already-structured Extract — never from the
raw digest. The key is held server-side (config.GEMINI_API_KEY); if it's absent or
the call fails, generate_prose returns None and the caller falls back to the
deterministic prose.

Author: GitScape.ai
"""
from __future__ import annotations

import json
import logging
import re

import requests

from app.config import settings

from .models import Extract, FrameworkProcessStep, FrameworkProseFields, FrameworkRationalization, FrameworkVerificationItem, ProseFields, RepoMeta

logger = logging.getLogger(__name__)

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_TIMEOUT = 20


def hd_available() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _structured_context(meta: RepoMeta, extract: Extract) -> str:
    langs = ", ".join(meta.primary_languages) or "multiple languages"
    lines = [f"Repository: {meta.owner}/{meta.repo}", f"Languages: {langs}"]

    syms = [s for module in extract.api_index.modules.values() for s in module]
    if syms:
        lines.append("Key public symbols:")
        for s in syms[:25]:
            summary = f" — {s.summary}" if s.summary else ""
            lines.append(f"  - {s.kind} {s.name}: {s.signature}{summary}")

    if extract.import_graph.external:
        deps = ", ".join(d.name for d in extract.import_graph.external[:20])
        lines.append(f"External dependencies: {deps}")

    if extract.setup.commands:
        lines.append("Setup commands: " + "; ".join(extract.setup.commands[:8]))

    # ── Skill-collection metadata (from file tree) ──────────────────────
    # Detect skill directories (skills/<name>/SKILL.md pattern)
    tree = meta.file_structure or ""
    skill_dirs = list(dict.fromkeys(re.findall(r"skills/([^/\s]+)/SKILL\.md", tree)))
    if skill_dirs:
        lines.append(f"\nThis repository is a SKILL COLLECTION containing {len(skill_dirs)} skills:")
        for s in skill_dirs[:30]:
            lines.append(f"  - {s}")

    # Detect commands (commands/<name>.toml or .claude/commands/<name>.md)
    cmd_matches = list(dict.fromkeys(re.findall(r"commands/([^/\s]+)\.\w+", tree)))
    if cmd_matches:
        lines.append(f"\nSlash commands ({len(cmd_matches)}):")
        for c in cmd_matches[:15]:
            lines.append(f"  - /{c}")

    # Detect agent personas (agents/<name>.md)
    agent_matches = list(dict.fromkeys(re.findall(r"agents/([^/\s]+)\.md", tree)))
    if agent_matches:
        lines.append(f"\nAgent personas ({len(agent_matches)}):")
        for a in agent_matches:
            lines.append(f"  - {a}")

    if meta.readme:
        lines.append("README excerpt:\n" + meta.readme[:1500])

    return "\n".join(lines)


def _prompt(meta: RepoMeta, extract: Extract) -> str:
    return (
        "You are a technical writer producing prose for an Anthropic Agent Skill "
        "(SKILL.md) that describes a code repository. Use ONLY the structured "
        "context below — never invent files, APIs, or facts not present.\n\n"
        "Return STRICT JSON with exactly these keys:\n"
        '  "description": A description following this exact template (max 1024 chars):\n'
        '                 "[Third-person capability statement, e.g. \'Guides agents through working with {repo}\']. Use when [trigger condition 1], [trigger condition 2], or when the user mentions \'[phrase 1]\', \'[phrase 2]\' — even if they don\'t explicitly ask for {repo}. NOT for [near-miss exclusion]; for that, see [adjacent-skill-name]."\n'
        '  "what_this_is": a single plain paragraph (3-5 sentences) describing the '
        "project, its purpose, architecture, and stack.\n"
        '  "when_to_use": an array of 3-5 short bullet strings.\n\n'
        "No markdown, no code fences, no commentary — JSON only.\n\n"
        "=== STRUCTURED CONTEXT ===\n" + _structured_context(meta, extract)
    ).replace("{repo}", meta.repo)


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text[3:] else text.strip("`")
        text = text.lstrip("json").strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    # strict=False tolerates literal newlines/tabs inside JSON strings, which
    # Gemini commonly emits for multi-line prose values.
    return json.loads(text, strict=False)


def generate_prose(meta: RepoMeta, extract: Extract) -> ProseFields | None:
    """Return HD prose, or None when unavailable / on any failure."""
    key = settings.GEMINI_API_KEY
    if not key:
        return None

    url = _ENDPOINT.format(model=settings.HD_MODEL)
    body = {
        "contents": [{"parts": [{"text": _prompt(meta, extract)}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
            # Disable "thinking" — 2.5-flash otherwise spends the output budget on
            # reasoning tokens and truncates the JSON. Short prose needs none.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    try:
        resp = requests.post(url, params={"key": key}, json=body, timeout=_TIMEOUT)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = _extract_json(text)
        return ProseFields(
            description=data.get("description"),
            what_this_is=data.get("what_this_is"),
            when_to_use=[str(x) for x in (data.get("when_to_use") or [])][:6],
        )
    except Exception:
        logger.exception("HD prose generation failed; falling back to deterministic prose")
        return None


def _framework_prompt(meta: RepoMeta, extract: Extract) -> str:
    """Build the Gemini prompt that generates all 6 canonical engineering skill sections."""
    return (
        "You are a senior engineering skills author producing a Production-grade Engineering Skill "
        "(SKILL.md) for an AI coding agent working in this repository. "
        "Your goal is to teach the agent HOW TO ACT in this codebase — not just what it contains.\n\n"
        "If the repository is a SKILL COLLECTION (contains a skills/ directory with SKILL.md files), "
        "focus on the collection's purpose, the individual skills it provides, the slash commands, "
        "and the development lifecycle it enforces — NOT on code symbols or dependencies.\n\n"
        "Use ONLY the structured context below. Do not invent files, APIs, or facts not present.\n\n"
        "Return STRICT JSON with exactly these keys:\n"
        '  "description": A description following this exact template (max 1024 chars):\n'
        '                 "[Third-person capability statement, e.g. \'Guides agents through working with {repo}\']. Use when [trigger condition 1], [trigger condition 2], or when the user mentions \'[phrase 1]\', \'[phrase 2]\' — even if they don\'t explicitly ask for {repo}. NOT for [near-miss exclusion]; for that, see [adjacent-skill-name]."\n'
        '  "summary_title": One sentence capturing the essence/vision/design philosophy of this codebase (max 150 chars). Example: "Distinctive, production-grade frontend interfaces that reject generic AI aesthetics through intentional design choices."\n'
        '  "summary_bullets": Array of exactly 4 concise, high-impact bullet points summarizing the core engineering rules/philosophy of this repository.\n'
        '  "overview": A short overview (1-2 sentences) explaining what this skill does and why an agent should follow it, followed by a single line stating the core principle (e.g. "Tests are proof — \'seems right\' is not done."). Max 300 characters.\n'
        '  "when_to_use": Array of 4-6 short strings. Each is a concrete trigger scenario.\n'
        '  "when_not_to_use": One sentence. The counter-indicator (when NOT to use this skill).\n'
        '  "related": One sentence outlining an adjacent scenario and the adjacent skill to follow (e.g. "For UI changes, follow the frontend-ui-engineering skill.").\n'
        '  "core_process": Array of {"title": string, "content": string} objects. '
        "3-5 numbered steps that define the workflow. Each step should have a descriptive title "
        "and 2-4 sentences of content, explaining the reasoning behind the step (WHY it exists), "
        "using the imperative mood, incorporating exact commands/templates/thresholds where relevant, "
        "and avoiding shouting MUST/ALWAYS.\n"
        '  "common_rationalizations": Array of {"excuse": string, "reality": string} objects. '
        "3-5 rows of shortcuts engineers/agents take and why they fail in this codebase.\n"
        '  "red_flags": Array of 5-7 short strings. Observable warning signs that the agent '
        "is going off track.\n"
        '  "verification": Array of {"criterion": string, "evidence": string} objects. Checklist items an agent checks before declaring work done. Each item must have a specific exit criterion and the name of the artifact/output that proves it.\n\n'
        "No markdown, no code fences, no commentary — JSON only.\n\n"
        "=== STRUCTURED CONTEXT ===\n" + _structured_context(meta, extract)
    ).replace("{repo}", meta.repo)


def generate_framework_prose(meta: RepoMeta, extract: Extract) -> FrameworkProseFields | None:
    """Return all 6 framework skill sections from Gemini, or None on any failure.

    This is the HD path for Engineering Skills. It uses a higher token budget
    (2048) and a richer prompt than the Code Skill prose path.
    """
    key = settings.GEMINI_API_KEY
    if not key:
        return None

    url = _ENDPOINT.format(model=settings.HD_MODEL)
    body = {
        "contents": [{"parts": [{"text": _framework_prompt(meta, extract)}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    try:
        resp = requests.post(url, params={"key": key}, json=body, timeout=_TIMEOUT)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = _extract_json(text)

        core_process = [
            FrameworkProcessStep(title=s.get("title", ""), content=s.get("content", ""))
            for s in (data.get("core_process") or [])
            if isinstance(s, dict)
        ]
        rationalizations = [
            FrameworkRationalization(excuse=r.get("excuse", ""), reality=r.get("reality", ""))
            for r in (data.get("common_rationalizations") or [])
            if isinstance(r, dict)
        ]
        verification = [
            FrameworkVerificationItem(criterion=v.get("criterion", ""), evidence=v.get("evidence", ""))
            for v in (data.get("verification") or [])
            if isinstance(v, dict)
        ]

        return FrameworkProseFields(
            description=data.get("description"),
            summary_title=data.get("summary_title"),
            summary_bullets=[str(x) for x in (data.get("summary_bullets") or [])][:4],
            overview=data.get("overview"),
            when_to_use=[str(x) for x in (data.get("when_to_use") or [])][:7],
            when_not_to_use=data.get("when_not_to_use"),
            related=data.get("related"),
            core_process=core_process,
            common_rationalizations=rationalizations,
            red_flags=[str(x) for x in (data.get("red_flags") or [])][:8],
            verification=verification[:10],
        )
    except Exception:
        logger.exception("Framework prose generation failed; caller should handle None")
        return None
