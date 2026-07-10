---
name: nvidia-skillspector
description: "Guides agents through working with the NVIDIA/SkillSpector codebase (Python, TypeScript, Shell). Use when extending, debugging, or navigating SkillSpector, or when the user mentions 'SkillSpector', 'NVIDIA/SkillSpector', or asks about its architecture, modules, or public API. Not for general Python, TypeScript, Shell questions unrelated to SkillSpector."
---

# Skillspector Code Skill

## Overview

**Security scanner for AI agent skills.** Detect vulnerabilities, malicious patterns, and security risks before installing agent skills.

Top-level areas: `.github/`, `contrib/`, `docs/`, `extensions/`, `src/`, `tests/`.

Primary languages: Python, TypeScript, Shell. The codebase contains 282 public symbols across 69 source files.

**Key symbols:**

- `is_language_compatible` `def is_language_compatible(rule_id: str, detected_language: str) -> bool` — Return ``True`` when *rule_id* is reliable for *detected_language*.
- `annotate_findings` `def annotate_findings( issues: list[dict[str, object]], detected_language: str, ) -> list[dict[str, object]]` — Add a ``language_compatible`` field to each issue dict.
- `ApiKey` `class ApiKey` — A single API key with concurrency and rate-limit metadata.
- `ApiKey.available` `def available(self) -> bool` — ``True`` when this key can accept at least one more caller.
- `ApiKeyPool` `class ApiKeyPool` — Thread-safe pool of API keys with per-key concurrency slots.
- `ApiKeyPool.__init__` `def __init__(self, keys: list[ApiKey]) -> None`
- `ApiKeyPool.acquire` `def acquire(self, timeout: float | None = None) -> ApiKey` — Acquire a slot on the least-loaded available key.
- `ApiKeyPool.try_acquire` `def try_acquire(self) -> ApiKey | None` — Non-blocking acquire — returns a key immediately or ``None``.
- `ApiKeyPool.release` `def release(self, key: ApiKey, *, success: bool = True) -> None` — Release a slot on *key* back to the pool.
- `ApiKeyPool.record_retry_success` `def record_retry_success(self) -> None` — Increment the retry-success counter for reporting.
- `ApiKeyPool.rate_limits_hit` `def rate_limits_hit(self) -> int` — Total number of 429 responses encountered across all keys.
- `ApiKeyPool.retry_successes` `def retry_successes(self) -> int` — Total number of successful retries after a key switch.
- `ApiKeyPool.keys_configured` `def keys_configured(self) -> int` — Total number of keys in the pool.
- `ApiKeyPool.total_capacity` `def total_capacity(self) -> int` — Sum of ``max_concurrent`` across all keys.
- `ApiKeyPool.active_requests` `def active_requests(self) -> int` — Total active requests across all keys.
- `ApiKeyPool.snapshot` `def snapshot(self) -> dict[str, object]` — Return a snapshot dict suitable for report metadata.
- `PooledChatModel` `class PooledChatModel` — LangChain-compatible chat model wrapper with transparent key switching.
- `PooledChatModel.__init__` `def __init__( self, pool: ApiKeyPool, *, max_tokens: int = 4096, timeout: float = 30.0, max_retries: int = _MAX_RATE_LIMIT_RETRIES, ) -> None`
- `PooledChatModel.invoke` `def invoke(self, prompt: str) -> object` — Synchronous invoke with automatic key switching on rate-limit.
- `PooledChatModel.ainvoke` `def ainvoke(self, prompt: str) -> object` — Async invoke with automatic key switching on rate-limit.

*…and 262 more — see `references/api.md`.*

## When to Use

- Understanding the architecture and module layout of SkillSpector
- Extending or modifying SkillSpector consistent with its existing patterns
- Debugging issues by tracing through SkillSpector's modules and dependencies
- Setting up, running, or configuring SkillSpector
- Calling functions, classes, or methods in SkillSpector's public API

**When NOT to use:** General Python, TypeScript, Shell questions, tutorials, or tasks unrelated to the SkillSpector codebase.

**Related:** For general Python, TypeScript, Shell guidance, use language-specific skills instead.

## Core Process

### Step 1: Understand the Architecture

Read the existing code in SkillSpector before making changes. Check `references/architecture.md` to understand the module layout, dependency graph, and internal import structure. The goal is to extend existing patterns, not invent new ones.

### Step 2: Locate Relevant Modules

Use `references/api.md` to find the public symbols, functions, and classes relevant to the task. Trace the call chain through SkillSpector's internal imports to understand how the pieces connect.

### Step 3: Make Changes Following Existing Patterns

Implement the change consistent with SkillSpector's established conventions: naming patterns, error handling style, module organization, and test structure. Consistency matters more than personal preference.

### Step 4: Verify the Change

Run the project's test suite and confirm all tests pass. If no tests exist for the changed behavior, write them first. Check that no regressions were introduced in adjacent modules.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know SkillSpector well enough to skip reading the existing code" | Every session starts with stale context. Re-read the architecture reference before assuming you know the current state. |
| "This change is too small to need tests" | Small changes in unfamiliar codebases cause the most subtle regressions. A test that fails without the fix and passes with it is the minimum bar. |
| "I'll follow the patterns later, let me just get it working first" | Pattern violations compound. Code that works but violates the repository's conventions creates maintenance debt for every future contributor. |

## Red Flags

- Making changes to SkillSpector without reading `references/architecture.md` first
- Inventing new patterns instead of extending existing ones
- Skipping the test suite before declaring the task complete
- Modifying code outside the scope of the current task

## Verification

Before declaring this workflow complete, confirm each item with evidence:

- [ ] Changes follow SkillSpector's existing patterns — evidence: diff review against `references/architecture.md`
- [ ] All tests pass — evidence: test runner output
- [ ] No regressions introduced in adjacent modules — evidence: full test suite output
- [ ] Code is consistent with the repository's naming and style conventions — evidence: code review

## References

- [Full API reference](references/api.md)
- [Architecture & dependencies](references/architecture.md)
- [Usage examples](references/examples.md)
- [Setup & commands](references/setup.md)
- [Configuration](references/config.md)
- [Full Code Digest](references/nvidia_skillspector_digest.txt)
