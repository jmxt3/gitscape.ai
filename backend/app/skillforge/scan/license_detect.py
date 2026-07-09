"""
License detection — enrichment, not a gate.

Makes the landing-page promise ("license detected and carried into the
manifest") true. Identifies the repo's license from a LICENSE/COPYING file via
distinctive-phrase matching, with package.json / pyproject fallbacks. Pure
Python, no network, no SPDX dependency.

Author: GitScape.ai
"""
from __future__ import annotations

import json
import re
from pathlib import PurePosixPath

from ..models import ContentUnit, LicenseInfo

# Ordered: earlier, more specific families win over their supersets.
_PHRASES: list[tuple[str, re.Pattern]] = [
    ("AGPL-3.0", re.compile(r"GNU AFFERO GENERAL PUBLIC LICENSE.*Version 3", re.I | re.S)),
    ("GPL-3.0", re.compile(r"GNU GENERAL PUBLIC LICENSE.*Version 3", re.I | re.S)),
    ("GPL-2.0", re.compile(r"GNU GENERAL PUBLIC LICENSE.*Version 2", re.I | re.S)),
    ("LGPL-3.0", re.compile(r"GNU LESSER GENERAL PUBLIC LICENSE.*Version 3", re.I | re.S)),
    ("Apache-2.0", re.compile(r"Apache License.*Version 2\.0", re.I | re.S)),
    ("MPL-2.0", re.compile(r"Mozilla Public License Version 2\.0", re.I | re.S)),
    ("BSD-3-Clause", re.compile(r"Redistribution and use.*Neither the name", re.I | re.S)),
    ("BSD-2-Clause", re.compile(r"Redistribution and use in source and binary forms", re.I | re.S)),
    ("MIT", re.compile(r"Permission is hereby granted, free of charge", re.I | re.S)),
    ("ISC", re.compile(r"ISC License|Permission to use, copy, modify, and/or distribute", re.I | re.S)),
    ("Unlicense", re.compile(r"This is free and unencumbered software released into the public domain", re.I | re.S)),
]

_LICENSE_FILE = re.compile(r"^(licen[sc]e|copying|unlicense)(\.\w+)?$", re.I)


def _spdx_from_text(text: str) -> str | None:
    for spdx, pattern in _PHRASES:
        if pattern.search(text):
            return spdx
    return None


def detect_license(units: list[ContentUnit] | None) -> LicenseInfo:
    if not units:
        return LicenseInfo()
    # 1) A dedicated license file is the strongest signal.
    for u in units:
        name = PurePosixPath(u.path).name
        if _LICENSE_FILE.match(name):
            spdx = _spdx_from_text(u.content or "")
            if spdx:
                return LicenseInfo(spdx_id=spdx, source_path=u.path, confidence="high")
            return LicenseInfo(spdx_id="NOASSERTION", source_path=u.path, confidence="low")
    # 2) Fallbacks: package.json / pyproject metadata.
    for u in units:
        name = PurePosixPath(u.path).name.lower()
        if name == "package.json":
            try:
                lic = json.loads(u.content).get("license")
                if isinstance(lic, str) and lic:
                    return LicenseInfo(spdx_id=lic, source_path=u.path, confidence="medium")
            except Exception:
                pass
        elif name == "pyproject.toml":
            m = re.search(r'license\s*=\s*[{"\']?\s*(?:text\s*=\s*)?["\']([A-Za-z0-9.\-+ ]+)["\']', u.content, re.I)
            if m:
                return LicenseInfo(spdx_id=m.group(1).strip(), source_path=u.path, confidence="low")
    return LicenseInfo()
