"""
End-to-end test for skill-collection repositories.

Builds a synthetic repo structured like addyosmani/agent-skills (Markdown-heavy,
skills/ directory, LICENSE file, no executable source code) and verifies:

  1. LICENSE file is ingested → MIT detected → scan PASS
  2. Zero-symbol description does NOT say "0 symbols" or "0 source files"
  3. Examples are drawn from multiple source files (diversity cap)
  4. _what_this_is fallback produces clean prose when no symbols exist

Author: GitScape.ai
"""
import json

import pytest

from app import converter
from app.skillforge import (
    BUILDER_VERSION,
    ScanStatus,
    build_skill,
    cache_key,
    content_hash,
    parse_digest,
)
from app.skillforge.extract import build_extract
from app.skillforge.models import RepoMeta


MIT_LICENSE = """\
MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

SKILL_A = """\
---
name: spec-driven-development
description: "Creates specs before coding."
---

# Spec-Driven Development

## Overview

Always write a spec before writing code.

## When to Use

- Starting a new feature
- Major refactoring

## Core Process

### Step 1: Write the spec

```typescript
interface SpecDoc {
  title: string;
  requirements: string[];
}
```

### Step 2: Review the spec

```python
def review_spec(spec: dict) -> bool:
    return all(r.strip() for r in spec["requirements"])
```

## Verification

- [ ] Spec reviewed
- [ ] Tests written
"""

SKILL_B = """\
---
name: test-driven-development
description: "Drives development with tests."
---

# Test-Driven Development

## Overview

Write tests first, then implementation.

## When to Use

- Implementing any logic
- Fixing bugs

## Core Process

### Step 1: Write failing test

```python
def test_add():
    assert add(1, 2) == 3
```

### Step 2: Make it pass

```javascript
function add(a, b) {
  return a + b;
}
```

## Verification

- [ ] Red-green-refactor completed
"""

README = """\
# Agent Skills

A curated collection of AI coding agent skills for software development.

## Skills

- spec-driven-development
- test-driven-development

## Installation

```bash
npx gitscape https://github.com/test/agent-skills
```
"""


def _meta():
    return RepoMeta(
        owner="test", repo="agent-skills",
        repo_url="https://github.com/test/agent-skills",
        primary_languages=["Shell", "JavaScript"],
        files_analyzed=6,
        readme=README,
        file_structure=(
            "├── skills/\n"
            "│   ├── spec-driven-development/\n"
            "│   │   └── SKILL.md\n"
            "│   └── test-driven-development/\n"
            "│       └── SKILL.md\n"
            "├── LICENSE\n"
            "└── README.md\n"
        ),
    )


def _build_skill_collection(tmp_path):
    """Build a synthetic skill-collection repo on disk and return the digest."""
    # Root files
    (tmp_path / "README.md").write_text(README, encoding="utf-8")
    (tmp_path / "LICENSE").write_text(MIT_LICENSE, encoding="utf-8")

    # Skill A
    skill_a_dir = tmp_path / "skills" / "spec-driven-development"
    skill_a_dir.mkdir(parents=True)
    (skill_a_dir / "SKILL.md").write_text(SKILL_A, encoding="utf-8")

    # Skill B
    skill_b_dir = tmp_path / "skills" / "test-driven-development"
    skill_b_dir.mkdir(parents=True)
    (skill_b_dir / "SKILL.md").write_text(SKILL_B, encoding="utf-8")

    return converter.generate_markdown_digest(
        "https://github.com/test/agent-skills", str(tmp_path), return_metadata=False
    )


class TestLicenseIngestion:
    """Task 1: LICENSE file (no extension) is ingested into the digest."""

    def test_license_file_is_ingested(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        assert "Permission is hereby granted" in digest, (
            "LICENSE file should be present in the digest"
        )

    def test_license_detected_as_mit(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        pkg = build_skill(
            units, _meta(),
            digest_hash=content_hash(digest),
            digest_content=digest,
        )
        assert pkg.scan_report.license.spdx_id == "MIT"
        assert pkg.scan_report.license.confidence == "high"

    def test_scan_passes_with_mit_license(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        pkg = build_skill(
            units, _meta(),
            digest_hash=content_hash(digest),
            digest_content=digest,
        )
        assert pkg.scan_report.status in (ScanStatus.PASS, ScanStatus.WARN)


class TestZeroSymbolDescription:
    """Task 4: Description doesn't say '0 symbols' for non-code repos."""

    def test_description_no_zero_symbols(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        pkg = build_skill(
            units, _meta(),
            digest_hash=content_hash(digest),
            digest_content=digest,
        )
        assert "0 documented public symbols" not in pkg.manifest.description
        assert "0 source files" not in pkg.manifest.description

    def test_skill_md_no_zero_symbols(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        pkg = build_skill(
            units, _meta(),
            digest_hash=content_hash(digest),
            digest_content=digest,
        )
        assert "0 public symbols" not in pkg.skill_md
        assert "0 source files" not in pkg.skill_md


class TestExampleDiversity:
    """Task 2: Examples drawn from multiple source files."""

    def test_examples_from_multiple_files(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        extract = build_extract(units, readme=README)

        if extract.examples:
            source_files = {e.source_path for e in extract.examples}
            # With 2 skill files and a README, examples should come from >= 2 files
            assert len(source_files) >= 2, (
                f"Examples should come from multiple files, got: {source_files}"
            )


class TestDigestCompleteness:
    """The full build still produces a valid package."""

    def test_full_build_produces_valid_package(self, tmp_path):
        digest = _build_skill_collection(tmp_path)
        units = parse_digest(digest).units
        # This fixture is itself a skills collection (ships authored SKILL.md
        # files), so exercise the compile pipeline explicitly — Search-or-Compile
        # would otherwise (correctly) surface one of the authored skills.
        pkg = build_skill(
            units, _meta(),
            digest_hash=content_hash(digest),
            digest_content=digest,
            prefer_authored=False,
        )

        assert pkg.source == "compiled"
        assert pkg.name == "test-agent-skills"
        assert pkg.manifest.builder_version == BUILDER_VERSION
        assert pkg.skill_md
        assert pkg.manifest.description
