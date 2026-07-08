"""SkillForge exceptions."""
from __future__ import annotations


class BuildError(Exception):
    """Raised when a skill cannot be assembled within its constraints
    (e.g. SKILL.md exceeds the token budget even after trimming)."""


class ScanBlocked(Exception):
    """Raised when the security scanner returns FAIL and export is blocked.

    Carries the report so the API layer can surface findings to the user.
    """

    def __init__(self, report) -> None:  # report: ScanReport
        self.report = report
        super().__init__("Skill export blocked by security scan (FAIL).")
