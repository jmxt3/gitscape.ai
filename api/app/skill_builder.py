"""
Skill package builder for GitScape.ai.

Generates canonical Anthropic Agent Skills output:
  - SKILL.md   : YAML frontmatter + agent system instructions
  - DIGEST.md  : Full code digest (source-of-truth knowledge base)
  - manifest.json : Machine-readable metadata for Google ADK / OpenAI Agents

Author: João Machete
"""

import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from collections import Counter

# Extension → Language display name mapping
EXT_TO_LANGUAGE: dict = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",
    ".r": "R",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".ps1": "PowerShell",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "CSS",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".dart": "Dart",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".erl": "Erlang",
    ".lua": "Lua",
    ".tf": "Terraform",
    ".graphql": "GraphQL",
    ".sol": "Solidity",
}


def detect_primary_languages(files: List[Path], top_n: int = 3) -> List[str]:
    """
    Detect the primary programming languages from a list of file paths.
    Returns the top N languages sorted by file count, descending.
    """
    lang_counter: Counter = Counter()
    for f in files:
        lang = EXT_TO_LANGUAGE.get(f.suffix.lower())
        if lang:
            lang_counter[lang] += 1

    return [lang for lang, _ in lang_counter.most_common(top_n)]


def generate_skill_name(owner: str, repo: str) -> str:
    """
    Generate a canonical skill name: lowercase-with-hyphens, per AgentSkills standard.
    """
    return f"{owner.lower()}-{repo.lower()}"


def generate_skill_description(
    owner: str,
    repo: str,
    languages: List[str],
    files_analyzed: int,
) -> str:
    """
    Generate a rich, semantic skill description. This is the critical field that
    drives skill triggering in Claude and other agents — must include:
    - Repo identity
    - Language/framework specifics
    - Action verbs + use-case triggers
    - Clear boundaries
    """
    lang_str = ", ".join(languages) if languages else "multiple languages"
    return (
        f"Specialist skill for the {owner}/{repo} codebase ({lang_str}). "
        f"Use when working with, understanding, modifying, extending, or debugging the {repo} project. "
        f"Covers architecture, API design, implementation patterns, configuration, and {files_analyzed} analyzed source files. "
        f"Activate when the user asks about {repo} code, wants to add features, fix bugs, understand the codebase structure, "
        f"integrate with the {repo} system, or needs expert guidance on this specific repository."
    )


def generate_skill_md(
    owner: str,
    repo: str,
    repo_url: str,
    languages: List[str],
    files_analyzed: int,
    generated_at: str,
    structure_overview: str = "",
) -> str:
    """
    Generate a canonical SKILL.md conforming to the Anthropic Agent Skills open standard.
    See: https://agentskills.io

    Design decisions vs best practices:
    - Only name + description in YAML frontmatter (spec requires exactly two fields)
    - ## Overview and ## Capabilities have lean static fallbacks; WebLLM replaces them with
      repo-specific content at generation time
    - DIGEST.md reference + guardrail live in ## Knowledge Base (a static section that WebLLM
      never replaces) so the instruction survives regardless of AI generation state
    - ## Usage Instructions removed entirely — Claude knows how to read a reference file
    - ## Boundaries compressed to one line — description already scopes the skill
    """
    skill_name = generate_skill_name(owner, repo)
    description = generate_skill_description(owner, repo, languages, files_analyzed)
    lang_str = ", ".join(languages) if languages else "multiple languages"

    # Build the Architecture & Structure block.
    # When the API provides a shallow tree, embed it verbatim in a fenced code block
    # so the agent can navigate the repo without hallucinating paths.
    # The WebLLM will later prepend a single-sentence introduction above this block.
    if structure_overview and structure_overview.strip():
        architecture_block = "```\n" + structure_overview.strip() + "\n```"
    else:
        architecture_block = (
            f"The repository is organized as a standard {lang_str} project."
        )

    template = """\
---
name: {skill_name}
description: "{description}"
---

# {owner}/{repo} — Code Skill

## Overview

## Capabilities

## Knowledge Base

`DIGEST.md` is the primary source-of-truth. Do not reference files, functions, or APIs not present in it.

| Repository | [{repo_url}]({repo_url}) |
|---|---|
| Files Analyzed | {files_analyzed} |
| Primary Languages | {lang_str} |
| Generated | {generated_at} |

## Architecture & Structure

{architecture_block}

## Boundaries

Only reference what exists in `DIGEST.md`. This skill covers the repository state at {generated_at}.
"""

    return template.format(
        skill_name=skill_name,
        description=description,
        owner=owner,
        repo=repo,
        repo_url=repo_url,
        lang_str=lang_str,
        files_analyzed=files_analyzed,
        generated_at=generated_at,
        architecture_block=architecture_block,
    )


def generate_manifest_json(
    owner: str,
    repo: str,
    repo_url: str,
    languages: List[str],
    files_analyzed: int,
    generated_at: str,
) -> dict:
    """
    Generate a machine-readable manifest.json compatible with:
    - Anthropic Agent Skills standard (agentskills.io)
    - Google ADK SkillToolset metadata
    - OpenAI Agents SDK tool metadata
    """
    skill_name = generate_skill_name(owner, repo)
    description = generate_skill_description(owner, repo, languages, files_analyzed)

    return {
        "schema_version": "1.0",
        "name": skill_name,
        "display_name": f"{owner}/{repo}",
        "description": description,
        "version": "1.0.0",
        "capabilities": [
            "code-understanding",
            "architecture-analysis",
            "api-reference",
            "implementation-guidance",
        ],
        "framework_compatibility": [
            "claude-skills",
            "google-adk",
            "agno",
            "openai-agents",
            "langchain",
            "langgraph",
        ],
        "files": {
            "instructions": "SKILL.md",
            "knowledge_base": "DIGEST.md",
        },
        "metadata": {
            "source_repo": repo_url,
            "generated_by": "GitScape.ai",
            "generated_by_url": "https://gitscape.ai",
            "generated_at": generated_at,
            "files_analyzed": files_analyzed,
            "primary_languages": languages,
        },
    }


def build_skill_zip(
    owner: str,
    repo: str,
    repo_url: str,
    digest_md: str,
    languages: List[str],
    files_analyzed: int,
) -> io.BytesIO:
    """
    Build an in-memory ZIP containing:
      - SKILL.md
      - DIGEST.md
      - manifest.json

    Returns a BytesIO object ready to stream as a file download.
    """
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    skill_md = generate_skill_md(
        owner=owner,
        repo=repo,
        repo_url=repo_url,
        languages=languages,
        files_analyzed=files_analyzed,
        generated_at=generated_at,
    )

    manifest = generate_manifest_json(
        owner=owner,
        repo=repo,
        repo_url=repo_url,
        languages=languages,
        files_analyzed=files_analyzed,
        generated_at=generated_at,
    )
    manifest_json_str = json.dumps(manifest, indent=2, ensure_ascii=False)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", skill_md.encode("utf-8"))
        zf.writestr("DIGEST.md", digest_md.encode("utf-8"))
        zf.writestr("manifest.json", manifest_json_str.encode("utf-8"))

    buffer.seek(0)
    return buffer
