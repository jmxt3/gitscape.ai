# Orchestration Patterns

Reference for how agent personas, skills, and slash commands compose in GitScape.

## Core Rule: Personas Do Not Invoke Personas

The only multi-persona pattern endorsed here is **parallel fan-out with a merge step**. A persona may invoke skills, but never another persona. Orchestration belongs to slash commands and intent mapping — not to personas.

## Pattern: Parallel Fan-Out (Pre-Ship Review)

Before a significant deploy, invoke three specialist reviews concurrently:

```
Main Agent
  ├── code-reviewer    (five-axis review)
  ├── security-auditor (OWASP + GitScape threat model)
  └── test-engineer    (coverage gap analysis)
         ↓
Main Agent merges reports → GO / NO-GO decision
```

**When to use:** Any change that is not trivial (> 2 files, or touches auth/secrets/Gemini/GitHub API).

**When to skip:** The diff is ≤ 2 files, ≤ 50 lines, and touches no auth, secrets, or external services.

## Pattern: Sequential Lifecycle

For feature work, follow the development lifecycle in order:

```
DEFINE   → spec-driven-development
PLAN     → planning-and-task-breakdown
BUILD    → incremental-implementation + test-driven-development
VERIFY   → debugging-and-error-recovery (if tests fail)
REVIEW   → code-review-and-quality
SHIP     → shipping-and-launch
```

Do not skip steps. Do not start BUILD without a reviewed spec.

## Pattern: Single-Persona Direct Review

When the user asks for a focused review of a specific concern:

- Security review → invoke `security-auditor` directly
- Test coverage → invoke `test-engineer` directly
- Code quality → invoke `code-reviewer` directly

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| `security-auditor` delegating to `code-reviewer` | Personas don't orchestrate personas — this creates loops |
| Invoking all personas for every change | Small changes don't need fan-out; save it for significant deploys |
| Skipping the spec and going straight to BUILD | Missing spec means requirements are implicit — expect rework |
| Invoking the same skill twice for the same task | Re-running without new information is not useful |
