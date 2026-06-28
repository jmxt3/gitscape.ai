---
name: code-simplification
description: Simplifies code for clarity. Use when refactoring code for clarity without changing behavior. Use when code works but is harder to read, maintain, or extend than it should be. Use when reviewing code that has accumulated unnecessary complexity.
---

# Code Simplification

## Overview

Reduce complexity while preserving exact behavior. The goal is code that a new engineer can read and understand without asking the author questions. Simplification is not optimization — do not change performance characteristics unless that is the explicit goal.

## When to Use

- Code works but is harder to read than it should be
- A function is doing more than one thing
- Nested conditionals make the control flow hard to follow
- Variable names are generic (`data`, `result`, `temp`)
- The same logic appears in multiple places
- A reviewer needed to ask what the code does

**When NOT to use:** Code that is intentionally complex for performance reasons (document with a comment instead of simplifying).

## The Chesterton's Fence Rule

> "Don't remove a fence you don't understand."

Before simplifying any code, answer: **why was it written this way?** If you can't answer that, you risk removing a safeguard. Read the git history, grep for related tests, and understand the intent before changing anything.

## The Simplification Process

### Step 1: Understand Before Touching

- Read the function end-to-end
- Read its callers — what do they expect?
- Read its tests — what behavior is verified?
- Check git history: `git log -p -- path/to/file.py`
- **Do not change anything yet**

### Step 2: Cover First

If the code lacks tests, add tests before simplifying. You need a safety net:

```python
def test_generate_skill_name_sanitizes_input():
    assert generate_skill_name("my repo") == "my-repo"
    assert generate_skill_name("My Repo!") == "my-repo"
    assert generate_skill_name("  spaces  ") == "spaces"
```

Run them, confirm they pass. Now you can simplify safely.

### Step 3: Apply Simplifications Incrementally

Apply one simplification at a time, running tests after each:

#### Deep Nesting → Guard Clauses

```python
# BAD: Pyramid of doom
def process_skill(skill):
    if skill is not None:
        if skill.get("name"):
            if len(skill["name"]) > 0:
                return skill["name"].lower()
        return None
    return None

# GOOD: Guard clauses
def process_skill(skill):
    if not skill:
        return None
    if not skill.get("name"):
        return None
    return skill["name"].lower()
```

#### Long Functions → Extracted Helpers

```python
# BAD: One function doing three jobs
def export_skill(repo: str) -> bytes:
    # Fetch files
    files = []
    for branch in ["main", "master"]:
        try:
            contents = github_client.get_contents(repo, branch)
            files = contents
            break
        except Exception:
            continue
    
    # Filter relevant files
    relevant = [f for f in files if f.path.endswith((".md", ".py", ".ts"))]
    
    # Build zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for f in relevant:
            zf.writestr(f.path, f.decoded_content)
    return buf.getvalue()

# GOOD: Each function does one thing
def export_skill(repo: str) -> bytes:
    files = fetch_repo_files(repo)
    relevant = filter_skill_files(files)
    return build_zip(relevant)

def fetch_repo_files(repo: str) -> list:
    for branch in ["main", "master"]:
        try:
            return github_client.get_contents(repo, branch)
        except Exception:
            continue
    return []

def filter_skill_files(files: list) -> list:
    return [f for f in files if f.path.endswith((".md", ".py", ".ts"))]

def build_zip(files: list) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for f in files:
            zf.writestr(f.path, f.decoded_content)
    return buf.getvalue()
```

#### Generic Names → Descriptive Names

```python
# BAD
def process(d, r):
    result = []
    for item in d:
        if item["type"] == r:
            result.append(item)
    return result

# GOOD
def filter_files_by_type(files: list[dict], file_type: str) -> list[dict]:
    return [f for f in files if f["type"] == file_type]
```

#### Duplicated Logic → Shared Functions

```python
# BAD: Same validation in three places
def create_skill(name: str):
    if not name or len(name) > 100:
        raise ValueError("Invalid name")
    ...

def update_skill(name: str):
    if not name or len(name) > 100:
        raise ValueError("Invalid name")
    ...

# GOOD
def validate_skill_name(name: str) -> None:
    if not name or len(name) > 100:
        raise ValueError("Skill name must be 1-100 characters")

def create_skill(name: str):
    validate_skill_name(name)
    ...
```

### Step 4: Verify Nothing Changed

Run the full test suite after each simplification:

```bash
pytest tests/ -v
```

If any test fails, revert that specific simplification and reconsider. Simplification must not change behavior.

### Step 5: Review the Result

After simplifying, ask:
- Can a new engineer read this function without asking questions?
- Is the control flow obvious?
- Does every name say what the thing is, not what it does mechanically?
- Are there any functions over 30 lines that could be split?

## The Rule of 500

A file over 500 lines is a sign it's doing too much. Consider splitting. For GitScape:
- `api/app/skill_builder.py` — if over 500 lines, split into `name_sanitizer.py`, `file_filter.py`, `assembler.py`
- `web/components/SkillExport.tsx` — if over 500 lines, split by concern

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I understand the code" | You wrote it. Someone else reads it cold at 11 PM during an incident. |
| "Extracting functions adds overhead" | Modern runtimes inline trivially. The overhead is unmeasurable. The clarity is immediate. |
| "The code is complex because the problem is complex" | Complex problems have simple solutions and complex solutions. Always look for the simpler one. |
| "I shouldn't touch it — it works" | Working code that no one understands becomes legacy code that no one can change safely. |

## Red Flags

- Functions over 30 lines
- Nesting deeper than 3 levels
- Variables named `data`, `result`, `temp`, `info`
- Comments that explain *what* the code does (rewrite instead)
- Duplicated logic (copy-paste is a red flag)
- Boolean parameters that change the function's behavior (`create_skill(name, dry_run=True)`)

## Verification

After simplification:

- [ ] All tests still pass (no behavior change)
- [ ] The diff is a net reduction in lines (usually)
- [ ] No function is over 30 lines
- [ ] No variable is named `data`, `result`, or `temp`
- [ ] Duplicated logic has been extracted to a shared function
- [ ] No comments that explain what the code does (only why)
