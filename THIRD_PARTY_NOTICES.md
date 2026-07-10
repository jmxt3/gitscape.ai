# Third-Party Notices

GitScape includes work derived from the following third-party projects. We are
grateful to their authors and maintainers.

---

## NVIDIA SkillSpector

- **Project:** NVIDIA SkillSpector
- **Source:** https://github.com/NVIDIA/SkillSpector
- **License:** Apache License 2.0

GitScape's security scanner ("ScapeGuard") derives several detection patterns
and scoring constants from SkillSpector. No source files are vendored verbatim;
the derived material was reimplemented to fit ScapeGuard's declarative `Rule`
registry and deterministic gate. Derived material includes:

- **Detection patterns / keyword tables** in:
  - `backend/app/skillforge/scan/rules/injection.py` — anti-refusal / jailbreak,
    concealment ("do not tell the user"), and conditional-trigger cues
    (GS-INJ-006, GS-INJ-007, GS-INJ-008).
  - `backend/app/skillforge/scan/rules/exfil.py` — cloud-metadata / SSRF
    internal-endpoint signatures (GS-EXF-006).
  - `backend/app/skillforge/scan/rules/agency.py` — memory-poisoning and
    agent-snooping cues (GS-AGY-005, GS-AGY-006).
  - `backend/app/skillforge/scan/rules/obfuscation.py` — base64 data-URI payload
    detection and expanded homoglyph confusable ranges (GS-OBF-006, GS-OBF-005).
  - `backend/app/skillforge/scan/rules/execution.py` — cryptominer and
    offensive-tooling / webshell signatures ported from SkillSpector's YARA rule
    sets (GS-EXE-008, GS-EXE-009).
- **Risk-scoring constants** in `backend/app/skillforge/scan/scoring.py` — the
  per-severity point table and the ×1.3 executable-context multiplier.
- **OSV.dev batch-lookup + TTL-cache design** in `backend/app/skillforge/scan/osv.py`,
  feeding the supply-chain rules GS-DEP-006 (known vulnerability) and GS-DEP-007
  (malicious package).

### Apache License 2.0

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at:

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
