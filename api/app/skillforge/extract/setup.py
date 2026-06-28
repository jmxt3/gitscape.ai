"""
Setup / quickstart extraction.

Pulls install + usage guidance from the README (the install/usage/quickstart
section plus any shell command blocks) and from `package.json` scripts. No LLM —
just structured mining of what the maintainer already wrote.

Author: GitScape.ai
"""
from __future__ import annotations

import json
import re
from pathlib import PurePosixPath

from ..models import ContentUnit, FileKind, SetupInfo

_FENCE = re.compile(r"```([\w+-]*)\n(.*?)```", re.DOTALL)
_SECTION_KEYWORDS = ("install", "usage", "getting started", "quickstart", "quick start", "setup", "running")
_CMD_HINTS = ("npm", "pnpm", "yarn", "pip", "uv", "git", "docker", "make", "go ", "cargo", "python", "poetry", "bun")
_MAX_COMMANDS = 14


def _readme_unit(units: list[ContentUnit]) -> ContentUnit | None:
    for unit in units:
        if unit.kind == FileKind.DOCS and PurePosixPath(unit.path).name.lower().startswith("readme"):
            return unit
    return None


def _looks_like_command(line: str) -> bool:
    s = line.strip().lstrip("$ ").strip()
    return bool(s) and (s.startswith(_CMD_HINTS) or s.split(" ", 1)[0] in {"sh", "bash", "node"})


def _commands_from_fences(text: str) -> list[str]:
    cmds: list[str] = []
    for info, body in _FENCE.findall(text):
        is_shell = info.lower() in ("sh", "bash", "shell", "console", "zsh", "")
        for raw in body.splitlines():
            line = raw.strip().lstrip("$ ").strip()
            if not line or line.startswith("#"):
                continue
            if is_shell and _looks_like_command(line):
                cmds.append(line)
    return cmds


def _install_section(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    capturing = False
    capture_level = 0
    for line in lines:
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            title = m.group(2).lower()
            if capturing and level <= capture_level:
                break
            if any(k in title for k in _SECTION_KEYWORDS):
                capturing = True
                capture_level = level
                out.append(line)
                continue
        if capturing:
            out.append(line)
    return "\n".join(out).strip()


def build_setup(units: list[ContentUnit], readme: str = "") -> SetupInfo:
    readme_unit = _readme_unit(units)
    text = readme or (readme_unit.content if readme_unit else "")

    commands = _commands_from_fences(text)

    # package.json scripts -> `npm run <name>`
    for unit in units:
        if PurePosixPath(unit.path).name.lower() == "package.json":
            try:
                scripts = json.loads(unit.content).get("scripts", {})
            except Exception:
                scripts = {}
            for name in list(scripts)[:6]:
                commands.append(f"npm run {name}")
            break

    # de-dupe preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for c in commands:
        if c not in seen:
            seen.add(c)
            deduped.append(c)
        if len(deduped) >= _MAX_COMMANDS:
            break

    return SetupInfo(quickstart=_install_section(text), commands=deduped)
