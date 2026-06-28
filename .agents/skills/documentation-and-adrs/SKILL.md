---
name: documentation-and-adrs
description: Records decisions and documentation. Use when making architectural decisions, changing public APIs, shipping features, or when you need to record context that future engineers and agents will need to understand the codebase.
---

# Documentation and Architecture Decision Records

## Overview

Document the **why**, not the **what**. Code explains what it does. Documentation explains why it does it that way, what alternatives were rejected, and what constraints apply. Architecture Decision Records (ADRs) are the canonical tool for capturing decisions that would be painful to reverse.

## When to Use

- Making an architectural decision (choosing a library, pattern, or approach)
- Changing a public-facing API
- Adding a new feature that introduces a non-obvious constraint
- Resolving a significant technical debate
- Any decision that future agents or engineers would otherwise re-litigate

## Architecture Decision Records (ADRs)

An ADR is a short document that records a single decision. It is immutable — once made, an ADR is never edited. Superseding decisions get a new ADR.

### ADR Location

```
.agents/decisions/
  ADR-001-skill-assembly-approach.md
  ADR-002-secret-management-gcp.md
  ADR-003-file-preview-truncation.md
```

### ADR Template

```markdown
# ADR-[NNN]: [Short descriptive title]

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded by ADR-[NNN]  
**Deciders:** [Who was involved]

## Context

What situation or problem prompted this decision? Include constraints,
requirements, and any relevant background. Keep this to 1-3 paragraphs.

## Decision

The decision that was made. State it clearly and directly:
"We will use X because Y."

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Option A | Reason it was ruled out |
| Option B | Reason it was ruled out |

## Consequences

**Positive:**
- What becomes easier or possible

**Negative / Trade-offs:**
- What becomes harder or is given up

## See Also
- Link to related ADRs, docs, or issues
```

### ADR Examples for GitScape

```markdown
# ADR-001: Use Cloud Run for API Hosting

**Date:** 2026-06-01
**Status:** Accepted

## Context
GitScape's API is stateless — no database, no persistent file storage.
Requests process a GitHub repository and return a generated skill zip.

## Decision
Host the API on Cloud Run (fully managed) rather than GKE or GCE.

## Alternatives Considered
| Alternative | Why Rejected |
|---|---|
| GKE | Requires cluster management; no benefit for a stateless service |
| GCE | Requires OS management; too much operational overhead |
| App Engine | Less flexible for Python async workloads; Cloud Run preferred |

## Consequences
**Positive:** Zero cluster management, scales to zero, pay-per-use.
**Negative:** Cold start latency (~1-2s) on first request after idle.
```

## Inline Code Documentation

### When to Write Comments

```python
# GOOD: Explains WHY, not WHAT
# GitHub's API rate-limits to 5000 requests/hour for authenticated users.
# We batch file fetches to minimize API calls during skill generation.
async def fetch_repo_files_batched(repo: str) -> list[File]:
    ...

# BAD: Explains WHAT (the code already does this)
# Loop through files and add to list
for f in files:
    result.append(f)
```

### Docstrings

Write docstrings for all public functions in the API:

```python
async def generate_skill(repo: str, tier: str = "standard") -> SkillBundle:
    """Generate a skill bundle from a GitHub repository.

    Args:
        repo: GitHub repository in "owner/repo" format.
        tier: Skill tier. "standard" uses the base model;
              "hd" uses the enhanced model (requires HD_TIER env var).

    Returns:
        SkillBundle containing the assembled SKILL.md and supporting files.

    Raises:
        RepoNotFoundError: If the repository does not exist or is private.
        RateLimitError: If the GitHub API rate limit is exceeded.
    """
```

## README Updates

When shipping a feature, update the README if it changes:
- How to run the project locally
- A new environment variable that is required
- A new endpoint or behavior that users interact with

Do not update the README to describe implementation details — only what operators and users need to know.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The code is self-documenting" | Code explains what. Documentation explains why. Both are needed. |
| "We'll document it later" | There is no later. The decision context is freshest right now. |
| "ADRs are too formal for a small project" | The size of the project doesn't change the cost of re-litigating a decision 6 months later. |
| "I'll remember why we did this" | You won't. Future-you and future-agents will thank present-you for writing it down. |

## Red Flags

- Architectural decisions with no record of why alternatives were rejected
- "Obvious" design choices that turn out to be load-bearing constraints
- New environment variables with no documentation
- Code comments that say "don't change this" without explaining why

## Verification

After making a significant decision or shipping a feature:

- [ ] ADR created for any architectural decision that took more than 5 minutes to make
- [ ] ADR is in `.agents/decisions/` with sequential numbering
- [ ] Inline comments explain *why*, not *what*
- [ ] Public API functions have docstrings
- [ ] README updated if user-visible behavior changed
- [ ] New environment variables are documented in `.env.example`
