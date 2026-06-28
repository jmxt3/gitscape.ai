"""
Package stage: zip the skill, enforcing the scan gate.

A FAIL status blocks packaging (raises ScanBlocked). WARN packages normally — the
UI is responsible for requiring explicit acceptance before download.

Author: GitScape.ai
"""
from __future__ import annotations

import io
import json
import zipfile

from .errors import ScanBlocked
from .models import ScanStatus, SkillPackage


def build_zip(pkg: SkillPackage, *, allow_warn: bool = True) -> io.BytesIO:
    """Serialize a SkillPackage to an in-memory ZIP.

    Raises:
        ScanBlocked: if the scan status is FAIL (always), or WARN when
            allow_warn is False.
    """
    status = pkg.scan_report.status
    if status == ScanStatus.FAIL or (status == ScanStatus.WARN and not allow_warn):
        raise ScanBlocked(pkg.scan_report)

    root = pkg.name
    manifest_json = json.dumps(pkg.manifest.model_dump(mode="json"), indent=2, ensure_ascii=False)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{root}/SKILL.md", pkg.skill_md)
        for relpath, content in pkg.references.items():
            zf.writestr(f"{root}/{relpath}", content)
        for relpath, content in pkg.exporters.items():
            zf.writestr(f"{root}/{relpath}", content)
        zf.writestr(f"{root}/manifest.json", manifest_json)

    buffer.seek(0)
    return buffer
