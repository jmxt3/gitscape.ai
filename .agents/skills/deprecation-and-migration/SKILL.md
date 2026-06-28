---
name: deprecation-and-migration
description: Manages deprecation and migration. Use when removing old systems, APIs, or features. Use when migrating users from one implementation to another. Use when deciding whether to maintain or sunset existing code.
---

# Deprecation and Migration

## Overview

Code is a liability, not an asset. Every line maintained is a line that can break. Deprecation is the practice of systematically retiring code, APIs, or features that are no longer earning their maintenance cost. Do it deliberately, not by abandonment.

## When to Use

- Removing an old API endpoint that has been replaced
- Migrating from one library or pattern to another
- Sunsetting a feature that is no longer used or supported
- Cleaning up dead code identified during a refactor

## The Deprecation Mindset

**Compulsory vs. Advisory Deprecation:**

| Type | Meaning | Example |
|---|---|---|
| **Compulsory** | Will be removed on a specific date — users must migrate | Old `/v1/skills` endpoint being replaced by `/v2/skills` |
| **Advisory** | Discouraged but not being removed yet | A config option that has a better alternative |

Always be explicit about which type you are doing.

## The Deprecation Process

### Step 1: Document Before Removing

Before removing anything, document:
- What is being deprecated
- Why (the reason, not just "it's old")
- What the replacement is
- When removal will happen (for compulsory deprecation)

```python
# api/app/routes/skills_v1.py

import warnings

@router.get("/v1/skills/{repo}")
async def get_skill_v1(repo: str):
    """
    DEPRECATED: Use /v2/skills/{repo} instead.
    This endpoint will be removed on 2026-09-01.
    Migration guide: docs/migration/v1-to-v2.md
    """
    warnings.warn(
        "GET /v1/skills is deprecated. Use /v2/skills. Removal: 2026-09-01.",
        DeprecationWarning,
        stacklevel=2,
    )
    # Delegate to v2 during transition period
    return await get_skill_v2(repo)
```

### Step 2: Add Deprecation Signals

Make deprecation visible to consumers:

**For HTTP APIs:**
```python
# Add Deprecation and Sunset headers per RFC 8594
response.headers["Deprecation"] = "true"
response.headers["Sunset"] = "Tue, 01 Sep 2026 00:00:00 GMT"
response.headers["Link"] = '</v2/skills>; rel="successor-version"'
```

**For Python functions:**
```python
import warnings

def generate_skill_v1(repo: str) -> str:
    warnings.warn(
        "generate_skill_v1() is deprecated. Use generate_skill() instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    return generate_skill(repo)
```

**For TypeScript/React:**
```typescript
/** @deprecated Use SkillExportV2 instead. Will be removed in v2.0. */
export function SkillExport({ repo }: Props) {
  console.warn("SkillExport is deprecated. Use SkillExportV2.");
  return <SkillExportV2 repo={repo} />;
}
```

### Step 3: Migrate Callers First

Before removing the deprecated thing:
- Find all callers: `grep -r "generate_skill_v1" api/ web/`
- Migrate each one to the replacement
- Verify no callers remain: the grep should return nothing
- Remove the deprecated code

### Step 4: Remove Clean

When removing deprecated code:
- Delete the entire file or function — don't leave it commented out
- Remove associated tests for the removed code
- Update any documentation that referenced the removed thing
- Update the CHANGELOG or ADR

### Step 5: Remove Dead Code

Dead code is worse than no code — it confuses future engineers and agents:

```python
# BAD: Commented-out code left "just in case"
# def old_generate_skill(repo):
#     # This was the old way, keeping for reference
#     ...

# GOOD: Delete it. Git history is the reference.
```

**Finding dead code:**
```bash
# Python: find unreferenced functions
grep -r "def generate_skill_v1" api/ | wc -l  # should be 1 (the definition)
grep -r "generate_skill_v1" api/ | grep -v "def "  # should be 0 callers

# TypeScript: find unused exports
npx ts-prune --project web/tsconfig.json
```

## GitScape-Specific Migration Patterns

### Migrating a Cloud Run Environment Variable

When renaming or removing a secret in GCP Secret Manager:

1. Add the new secret: `gcloud secrets create NEW_SECRET_NAME`
2. Update `cloudbuild.yaml` to inject both old and new: test that it works with new
3. Update all code to use the new name
4. Verify no code references the old name
5. Remove old secret from `cloudbuild.yaml`
6. Delete the old secret: `gcloud secrets delete OLD_SECRET_NAME`

Never delete a secret before confirming no live Cloud Run revision references it.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We might need it later" | Git history exists. Dead code is not a backup strategy. |
| "Let's just leave the old endpoint — it's not hurting anyone" | It is. It's surface area to maintain, test, and secure. |
| "We'll migrate it when we have more time" | Migrations get harder over time, not easier. Callers accumulate. |
| "The deprecated code still works" | Working is not the bar. Maintained, understood, and secure is the bar. |

## Red Flags

- Commented-out code with "keeping for reference"
- Functions with `_old`, `_v1`, or `_deprecated` in the name that are still called
- Deprecated APIs with no removal date
- Code that can't be removed because "we don't know who uses it"

## Verification

After completing a deprecation or migration:

- [ ] Zero callers of the removed API/function (verified via grep)
- [ ] No commented-out old code left behind
- [ ] Deprecation notices were in place for the required notice period (if applicable)
- [ ] Documentation updated to reference the new approach
- [ ] Associated tests for removed code are deleted
- [ ] CHANGELOG or ADR records the removal
