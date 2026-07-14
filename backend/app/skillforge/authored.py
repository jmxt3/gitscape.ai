"""
Search-or-Compile: detect a maintainer-authored skill already in the repo.

Increasingly, maintainers ship hand-authored Agent Skills in their repos (the
`npx skills add owner/repo` convention). When a repo already has one, GitScape
should **scan that skill as-is** rather than regenerate a worse one — then
compile only for the long tail of repos that ship no skill.

This module finds committed `SKILL.md` skills in the cloned repo's ContentUnits.
A file qualifies as an authored skill when it is named `SKILL.md` AND either
lives under a recognized skills directory or carries a `name:` frontmatter field
(so a stray file named SKILL.md doesn't get mistaken for a skill).

Author: GitScape.ai
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import PurePosixPath

_FRONTMATTER = re.compile(r"^\s*---\s*\n(.*?)\n---\s*", re.S)
# Directories the skills ecosystem (Vercel `skills`, Claude, Cursor) uses.
_SKILL_DIRS = ("skills/", ".claude/skills/", ".agents/skills/", ".cursor/skills/")
_REF_DIRS = ("references", "scripts", "assets")


@dataclass
class AuthoredSkill:
    dir: str  # POSIX skill directory ("" when SKILL.md is at repo root)
    name: str
    description: str
    skill_md: str
    references: dict[str, str] = field(default_factory=dict)  # rel-to-dir -> content


def _parse_frontmatter(md: str) -> tuple[str, str]:
    m = _FRONTMATTER.match(md)
    name = description = ""
    if m:
        for line in m.group(1).splitlines():
            s = line.strip()
            if s.lower().startswith("name:"):
                name = s.split(":", 1)[1].strip().strip("\"'")
            elif s.lower().startswith("description:"):
                description = s.split(":", 1)[1].strip().strip("\"'")
    return name, description


def _under_skill_dir(skill_dir: str) -> bool:
    probe = (skill_dir + "/").lstrip("./")
    return any(d in probe or probe.startswith(d) for d in _SKILL_DIRS)


def detect_authored_skills(units) -> list[AuthoredSkill]:
    """Return committed authored skills in the repo, best candidate first ([] if none)."""
    by_path = {u.path: u.content for u in (units or [])}
    found: list[AuthoredSkill] = []
    for path, content in by_path.items():
        if PurePosixPath(path).name != "SKILL.md":
            continue
        parent = PurePosixPath(path).parent
        skill_dir = "" if str(parent) == "." else parent.as_posix()
        name, description = _parse_frontmatter(content)
        # Qualify: must be a real skill, not a stray SKILL.md.
        if not name and not _under_skill_dir(skill_dir):
            continue
        prefix = f"{skill_dir}/" if skill_dir else ""
        references: dict[str, str] = {}
        for p, c in by_path.items():
            if p == path or not p.startswith(prefix):
                continue
            rel = p[len(prefix):]
            if rel.split("/", 1)[0] in _REF_DIRS:
                references[rel] = c
        found.append(AuthoredSkill(
            dir=skill_dir,
            name=name or (parent.name if parent.name != "." else "skill"),
            description=description,
            skill_md=content,
            references=references,
        ))

    # Prefer skills under a recognized skills dir, then shallower paths.
    found.sort(key=lambda s: (0 if _under_skill_dir(s.dir) else 1, s.dir.count("/")))
    return found
