# Spec: Mitigate ScapeGuard False Positives for GS-AGY-002 ("Do not ask")

## Objective
Refine the ScapeGuard `GS-AGY-002` rule regex to prevent false positives like "Do not ask multiple subagents..." or general "Do not ask questions...", while ensuring actual safety-bypass instructions (e.g. bypassing host agent permissions, bypassing user confirmation) remain correctly flagged.

## Commands / User Flows
- A user scans a repository (e.g., `pydantic-ai`) containing instructions like "Do not ask multiple subagents to answer the same question."
- The scan completes successfully (or fails for other genuine reasons) without flagging `GS-AGY-002` on those procedural lines.
- If a skill contains actual bypass instructions like "do not ask for permission", "do not ask the user for confirmation", "do not ask before executing", or "do not ask the user", it is correctly flagged under `GS-AGY-002`.

## Project Structure
- [backend/app/skillforge/scan/rules/agency.py](file:///c:/Users/jmach/dev/GitScape/backend/app/skillforge/scan/rules/agency.py): Modify the pattern regex for `GS-AGY-002` to use a refined regex pattern.
- [backend/tests/test_scan_execution.py](file:///c:/Users/jmach/dev/GitScape/backend/tests/test_scan_execution.py): Add unit tests validating the fix (positive cases that should trigger the flag, and negative cases that should not).

## Code Style and Patterns
- Use Python's `re.compile` standard library patterns.
- Follow existing patterns in the codebase for rule definitions.
- Write tests matching the pytest structure used in `test_scan_execution.py`.

## Testing Strategy
- Run `pytest backend/tests/test_scan_execution.py` to verify that both the existing and the newly added cases pass.
- Run the full test suite `.\.venv\Scripts\python.exe -m pytest` inside the backend directory to ensure no regressions.

## Boundaries
- **Always**: Ensure that genuine safety bypasses (like `do not ask for permission`, `do not ask before running`) are flagged.
- **Never**: Skip writing tests for the refined regex pattern.
