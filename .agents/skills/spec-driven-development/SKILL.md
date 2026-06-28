---
name: spec-driven-development
description: Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet. Use when requirements are unclear, ambiguous, or only exist as a vague idea.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing any code. A spec answers three questions: **what** are we building, **why** are we building it, and **how will we know it's done?** Every hour spent on a spec saves multiple hours of rework. Never start implementation without a written, reviewed spec.

## When to Use

- Starting a new project, feature, or significant change
- Requirements are unclear, ambiguous, or stated as a vague idea
- Multiple possible approaches exist and the tradeoffs need documenting
- The change touches more than two files or crosses a system boundary

**When NOT to use:** Trivial bug fixes with a clear, single-line root cause, or changes where the spec already exists and is current.

## The Spec Process

### Step 1: Interview First (If the Ask Is Vague)

Before writing the spec, gather enough context to write it well:

- What problem does this solve for the user?
- Who are the users, and what do they currently do instead?
- What does success look like? How will we measure it?
- Are there any hard constraints (perf, security, compatibility, deadline)?
- What's explicitly out of scope?

Do not write the spec until you can answer these with confidence.

### Step 2: Write the Spec

A spec has six sections:

```markdown
# Spec: [Feature Name]

## Objective
One paragraph: what problem this solves and for whom. Include the measurable
success condition (e.g., "users can reset their password without contacting support").

## Commands / User Flows
The primary interactions from the user's point of view. Use imperative language:
- User navigates to /reset-password
- User enters email address and submits
- User receives email with a time-limited link
- User sets a new password via the link

## Project Structure
Which files and modules will change or be created. Group by layer (API, frontend, DB).
Note any new dependencies.

## Code Style and Patterns
- Which existing patterns to follow (e.g., "use the existing AuthService pattern")
- Naming conventions for new symbols
- Error handling approach

## Testing Strategy
- What will be unit tested
- What requires integration tests
- Any E2E coverage needed
- Edge cases to cover explicitly

## Boundaries
- Always: [things the implementation must always do]
- Ask first: [decisions that require human sign-off before proceeding]
- Never: [things the implementation must never do]
```

### Step 3: Review Before Coding

Before writing any code:

- [ ] Spec covers all six sections
- [ ] Objective includes a measurable success condition
- [ ] Boundaries list at least one "Never"
- [ ] Human has reviewed and approved the spec
- [ ] Open questions are resolved or explicitly parked

A spec that is "good enough to review" is good enough to start coding. Perfection is not the goal — clarity is.

### Step 4: Save and Reference

Save the spec as `SPEC.md` in the project root (or `docs/SPEC.md` for multi-project repos). Reference it in commits and PRs. When requirements change, update the spec first — the spec is the source of truth, not the code.

## Spec Quality Bar

A good spec:
- **Defines done** — a reader can verify completion without asking the author
- **Surfaces trade-offs** — records the decisions made and why alternatives were rejected
- **Scopes explicitly** — what is out of scope is as important as what is in scope
- **Is short** — a one-page spec is better than a ten-page spec. If the spec is long, break the work into multiple specs.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know what to build, I don't need a spec" | The spec isn't for you — it's for the reviewer, the future maintainer, and your future self after a context switch. |
| "The requirements will change anyway" | A spec makes changes visible. Without one, scope creep is invisible until it's a problem. |
| "Writing a spec takes too long" | A vague spec takes 15 minutes. The rework it prevents takes hours. |
| "The ticket/issue is the spec" | Issue trackers capture requests, not decisions. A spec captures what was decided and why. |

## Red Flags

- Starting implementation without a written spec
- A spec with no measurable success condition
- A spec where "out of scope" is empty
- No human review before coding begins
- Spec is written after the code (post-hoc rationalization)

## Verification

Before writing code, confirm:

- [ ] Spec exists as a file (not just in your head)
- [ ] All six sections are present and non-empty
- [ ] The objective includes a measurable success condition
- [ ] At least one "Never" boundary is defined
- [ ] A human has read and approved the spec
- [ ] Open questions are explicitly tracked (not silently assumed)
