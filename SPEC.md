# Spec: Exclude Test Files from Example Mining

## Objective
Prevent adversarial test cases, fixtures, and assertions within test files from being extracted as usage examples. This avoids carrying malicious payloads or obfuscated patterns into the assembled skill's `references/examples.md`, which incorrectly penalizes the repository's security grade in ScapeGuard (fixing the scan failures for `gitscape.ai`).

## Commands / User Flows
- A user triggers a repository scan or skill compilation (either via CLI or Web UI).
- The repository is ingested and files are classified.
- During example mining, files classified as `FileKind.TEST` are ignored and not treated as example candidates.
- The compiled skill is scanned by ScapeGuard without any adversarial test payloads leaking into the assembled markdown surfaces.
- The security score and grade of the repository (like `gitscape.ai`) reflect only the actual production and documentation surfaces, leading to correct and clean passing grades.

## Project Structure
- [backend/app/skillforge/extract/examples.py](file:///c:/Users/jmach/dev/GitScape/backend/app/skillforge/extract/examples.py): Remove the `FileKind.TEST` extraction logic from `_candidates` so that only `FileKind.DOCS` code blocks are mined for examples.

## Code Style and Patterns
- Adhere to the existing pure Python, zero-LLM architecture.
- Keep the code clean, preserving existing helper functions and patterns.

## Testing Strategy
- Run the full pytest suite (`.venv/Scripts/python.exe -m pytest`) to verify no regressions or missing example logic in other test suites.
- Perform a manual build/compile of the `gitscape.ai` repository and verify that `test_sanitize.py` is no longer referenced or extracted in the examples.

## Boundaries
- **Always**: Keep classification of `FileKind.TEST` intact as it is used elsewhere (e.g. for listing test locations in conventions).
- **Never**: Extract examples from test directories or files, regardless of their size.
- **Never**: Compromise the detection of prompt injection or obfuscation on production source code or user documentation.
