---
name: incremental-implementation
description: Delivers changes incrementally. Use when implementing any feature or change that touches more than one file. Use when you're about to write a large amount of code at once, or when a task feels too big to land in one step.
---

# Incremental Implementation

## Overview

Ship thin vertical slices: implement, test, verify, commit — one task at a time. Never write a large batch of changes all at once. Each increment should leave the system in a working, deployable state. This protects against regressions, makes reviews easier, and provides clean rollback points.

## When to Use

- Any change touching more than one file
- Implementing a task from an existing plan
- When you're tempted to "just write it all out first and then test"
- Any feature that takes more than one focused session to implement

**When NOT to use:** Single-line typo fixes or isolated config changes with no behavior impact.

## The Increment Loop

For every task, follow this exact loop:

### 1. Read Before Writing

- Read the task's acceptance criteria
- Load the relevant existing code (the files this task touches)
- Identify the pattern being extended, not invented
- Confirm the approach matches the spec

**Stop if:** The approach differs significantly from the spec. Update the spec or plan first.

### 2. Write a Failing Test (RED)

Write a test that describes the expected behavior. The test **must fail** before you write any implementation code.

```python
# Example for a FastAPI endpoint
def test_export_skill_returns_zip():
    """Skill export endpoint should return a valid zip file."""
    response = client.post("/api/skills/export", json={"repo": "owner/repo"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
```

If the test passes before you write the implementation, the test is wrong. Fix it.

### 3. Implement the Minimum (GREEN)

Write only the code needed to make the test pass. No more, no less.

- Follow existing patterns in the codebase
- No premature abstractions
- No "while I'm here" refactors
- No adding features that aren't in the acceptance criteria

### 4. Run All Tests

```bash
pytest tests/ -v              # full suite
pytest tests/ -k "test_name"  # targeted run for the new test
```

All existing tests must pass. If they don't, fix the regression before proceeding.

### 5. Build Check

Ensure the project builds/compiles cleanly:
```bash
# Python: check imports resolve
python -c "from api.app import create_app"
# TypeScript/JS: type check
npx tsc --noEmit
```

### 6. Commit

One commit per task. Stage only the files that task touched:

```bash
git add api/app/path/to/changed_file.py tests/test_changed.py
git commit -m "feat(skills): add zip export endpoint for skill download

- POST /api/skills/export accepts {repo: string}
- Returns application/zip with SKILL.md and supporting files
- Validates repo exists before building archive

Closes #42"
```

**Never `git add -A` blindly** — it absorbs unrelated local work and breaks clean rollback.

### 7. Mark the Task Complete and Stop

Update the task list and stop. Do not immediately start the next task. Present the result for human review if the task was Medium or larger.

## Feature Flags

For high-risk changes that must be deployed before they are activated:

```python
# api/app/config.py
FEATURE_FLAGS = {
    "skill_hd_tier": os.getenv("FF_SKILL_HD_TIER", "false").lower() == "true",
}

# Usage
if settings.FEATURE_FLAGS["skill_hd_tier"]:
    return generate_hd_skill(repo)
else:
    return generate_standard_skill(repo)
```

Deploy with `FF_SKILL_HD_TIER=false`, enable via env var when ready.

## Safe Defaults

When adding new behavior, default to the current behavior and opt into new behavior:

```python
# BAD: new behavior is default, breaks existing users
def generate_skill(repo, format="enhanced"):
    ...

# GOOD: existing behavior is default
def generate_skill(repo, format="standard"):
    if format == "enhanced" and feature_flags.hd_tier:
        return _generate_enhanced(repo)
    return _generate_standard(repo)
```

## Rollback-Friendly Changes

Every commit should be revertable with `git revert` without taking down the system:

- Never combine schema changes with behavior changes in one commit
- Never remove a field that other services still read — add the replacement first, migrate, then remove
- Database migrations go in their own commit, run before the code that depends on them

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll test at the end when it's all done" | By then, failures are hard to localize. Test each slice so failures are obvious. |
| "The test is trivial for this part" | Write it anyway. Trivial tests catch trivial regressions. |
| "I can see how it fits together — just let me write it all" | You'll produce a 400-line diff that no one can review, with a bug buried on line 312. |
| "Refactoring this first will make the feature easier" | Refactor in a separate commit before the feature. Never mix. |

## Red Flags

- A commit with more than ~200 lines changed (sign of too-big slices)
- A commit message with "WIP", "stuff", or "various changes"
- Implementation written before the test
- Committing `git add -A` without reviewing what's staged
- "It works on my machine" as the only verification

## Verification

After each increment:

- [ ] A failing test was written first
- [ ] The test now passes
- [ ] The full test suite passes (no regressions)
- [ ] The build is clean
- [ ] The commit is atomic (only files from this task)
- [ ] The commit message describes what and why
- [ ] The system is in a deployable state at this commit
