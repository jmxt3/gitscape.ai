---
name: source-driven-development
description: Grounds every implementation decision in official documentation. Use when you want authoritative, source-cited code free from outdated patterns. Use when building with any framework or library where correctness matters.
---

# Source-Driven Development

## Overview

Every framework decision and library usage should be grounded in official documentation. AI agents have training cutoffs and can produce outdated, deprecated, or hallucinated API patterns. Source-driven development means: **verify before you code, cite what you verified, and flag what you couldn't confirm.**

## When to Use

- Using any external library or framework
- Implementing a pattern that isn't already established in the codebase
- Unsure whether an API or approach is current
- Seeing a pattern that looks right but isn't confirmed in the existing codebase

## The Process

### Step 1: Identify What Needs Verification

Before writing any code that uses an external library:

1. List the specific APIs, functions, or patterns you plan to use
2. Note the version you're targeting (check `requirements.txt`, `package.json`, or `pyproject.toml`)
3. Flag anything you're not 100% confident is current

### Step 2: Verify in Official Sources

**Priority order for sources:**
1. **Official docs** — the library's own documentation site
2. **Official GitHub** — the library's `README.md`, `CHANGELOG.md`, or `examples/`
3. **Release notes** — for the specific version in use
4. **Existing codebase** — how the library is already used in this project

**Never use as authoritative sources:**
- Stack Overflow answers (can be outdated)
- Blog posts (may target a different version)
- Your own training knowledge without verification
- ChatGPT or other AI outputs as a source of truth

### Step 3: Cite Your Sources

When writing code that uses verified patterns, leave a reference comment for future maintainers:

```python
# FastAPI dependency injection pattern
# Source: https://fastapi.tiangolo.com/tutorial/dependencies/
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

```typescript
// React Query v5 data fetching
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/queries
const { data, isLoading } = useQuery({
  queryKey: ['skills', repoId],
  queryFn: () => fetchSkills(repoId),
});
```

### Step 4: Flag What You Couldn't Verify

If you're using a pattern you cannot confirm is current, say so explicitly:

```python
# NOTE: Verify this middleware pattern against the current FastAPI docs.
# Used based on prior codebase patterns — may have changed in recent versions.
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

And note it in the PR description or task update.

## GitScape-Specific Sources

For the GitScape stack, always verify against:

| Technology | Official Source |
|---|---|
| FastAPI | https://fastapi.tiangolo.com/ |
| Google Gen AI SDK (Python) | https://googleapis.github.io/python-genai/ |
| Google Cloud Run | https://cloud.google.com/run/docs |
| GitHub API (PyGithub) | https://pygithub.readthedocs.io/ |
| React / TypeScript | https://react.dev/ |
| Vite | https://vitejs.dev/ |
| Cloud Build | https://cloud.google.com/build/docs |

Check the version in `api/requirements.txt` and `web/package.json` before citing docs for a specific version.

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails |
|---|---|
| Using an API without checking the version | Libraries break across major versions |
| Copying a pattern from memory | Training data may lag 12-24 months behind current releases |
| "This looks right" as verification | Looks right ≠ is right |
| Citing an AI as a source | AI outputs require human-verified sources, not circular citation |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know this library well" | APIs change. Verify. The minute spent checking prevents the hour debugging. |
| "I'll verify later" | You won't. And by then the wrong pattern is baked in. |
| "The existing code uses this pattern" | Great — that's evidence. Check if the existing usage is from a current dependency version. |

## Red Flags

- Library usage with no reference to a source
- Patterns that differ from every other usage in the codebase without explanation
- Using a deprecated API (check for deprecation warnings in docs)
- Citing a blog post or Stack Overflow answer as the source

## Verification

After writing code that uses external libraries:

- [ ] Every external API usage is confirmed in official docs or the existing codebase
- [ ] The docs version matches the version in `requirements.txt` / `package.json`
- [ ] Unverified patterns are explicitly flagged with a `# NOTE: verify` comment
- [ ] No deprecated APIs are used (or if used, the deprecation is documented)
