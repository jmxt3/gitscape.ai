---
name: performance-optimization
description: Optimizes application performance. Use when performance requirements exist, when you suspect performance regressions, or when Core Web Vitals or load times need improvement. Use when profiling reveals bottlenecks that need fixing.
---

# Performance Optimization

## Overview

Measure first, then optimize. Never optimize without data. Performance problems have specific root causes — guessing wastes time and can introduce regressions. The goal is to identify the specific bottleneck, fix it, and measure the improvement.

## When to Use

- A specific performance regression has been reported or measured
- A feature has a performance requirement (e.g., "< 200ms API response time")
- Core Web Vitals are in the "Needs Improvement" or "Poor" range
- Bundle size has grown significantly

**When NOT to use:** "Let's make it faster" without a measured baseline. Profile first.

## The Measure-First Workflow

### Step 1: Establish a Baseline

Before changing anything, capture the current state:

```bash
# API response time (via curl)
curl -w "@curl-format.txt" -s -o /dev/null https://api.gitscape.app/api/skills

# Frontend bundle size
npx vite build --mode production 2>&1 | grep "dist/"

# Lighthouse audit (frontend)
npx lighthouse https://gitscape.app --output json --output-path ./baseline.json
```

Record the specific numbers. You need them to prove the optimization worked.

### Step 2: Profile to Find the Real Bottleneck

Don't guess. Use profiling tools:

**Backend (Python FastAPI):**
```python
import cProfile
import pstats

with cProfile.Profile() as pr:
    result = await generate_skill(repo)

stats = pstats.Stats(pr)
stats.sort_stats("cumulative")
stats.print_stats(20)  # Top 20 hotspots
```

**Frontend (React):**
- Chrome DevTools → Performance tab → Record → Replay user action
- React DevTools Profiler → Identify components that re-render unnecessarily

**Network:**
- Chrome DevTools → Network tab → Filter by type, check response sizes and waterfall

### Step 3: Fix Only the Measured Bottleneck

Fix the specific issue the profile reveals — not everything that could theoretically be faster.

### Step 4: Measure After

Compare against the baseline. If the improvement isn't measurable, the optimization wasn't worth it.

## Common Bottlenecks in GitScape

### Large File Previews Freezing the Browser

```tsx
// BAD: Rendering full file content for large files
function FilePreview({ content }: { content: string }) {
  return <pre>{content}</pre>;  // 10MB file = browser freeze
}

// GOOD: Truncate at a safe limit
const MAX_PREVIEW_CHARS = 10_000;

function FilePreview({ content }: { content: string }) {
  const truncated = content.length > MAX_PREVIEW_CHARS;
  return (
    <div>
      <pre>{truncated ? content.slice(0, MAX_PREVIEW_CHARS) : content}</pre>
      {truncated && <p>Preview truncated — full content exported.</p>}
    </div>
  );
}
```

### Slow GitHub API Calls (N+1 Pattern)

```python
# BAD: Separate API call per file (N+1)
async def get_file_contents(repo: str, paths: list[str]) -> dict:
    result = {}
    for path in paths:
        # One API call per file
        result[path] = await github.get_file(repo, path)
    return result

# GOOD: Batch or parallelize
async def get_file_contents(repo: str, paths: list[str]) -> dict:
    tasks = [github.get_file(repo, path) for path in paths]
    contents = await asyncio.gather(*tasks, return_exceptions=True)
    return {path: content for path, content in zip(paths, contents)
            if not isinstance(content, Exception)}
```

### Unnecessary React Re-renders

```tsx
// BAD: New object reference on every render
function SkillList({ skills }: Props) {
  return <SkillFilters options={{ sortBy: 'name' }} />;
}

// GOOD: Stable reference
const DEFAULT_FILTER_OPTIONS = { sortBy: 'name' } as const;
function SkillList({ skills }: Props) {
  return <SkillFilters options={DEFAULT_FILTER_OPTIONS} />;
}
```

### Large Bundle Size

```typescript
// GOOD: Dynamic import for heavy, rarely-used features
const MonacoEditor = lazy(() => import('./MonacoEditor'));

function App() {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <MonacoEditor />
    </Suspense>
  );
}
```

## Performance Budget

Track these targets and alert when exceeded:

```
API response time (p95): < 2000ms for skill generation
                          < 200ms for metadata endpoints
Frontend JS bundle:       < 200KB gzipped (initial load)
File preview rendering:   < 100ms for files < 10KB
Lighthouse Performance:   ≥ 80 (acceptable), ≥ 90 (target)
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | Performance debt compounds. Address measured regressions now. |
| "It's fast on my machine" | Your machine isn't the user's. Profile on representative hardware. |
| "This optimization is obvious" | If you didn't measure, you don't know. Profile first. |
| "The framework handles performance" | Frameworks prevent some issues but can't fix N+1 queries or unbounded previews. |

## Red Flags

- Optimization without profiling data
- N+1 API call patterns (loop of individual calls)
- Rendering full content of files without size limits
- Re-fetching data that hasn't changed
- `React.memo` and `useMemo` everywhere (overusing is as bad as underusing)
- Bundle size growing release-over-release without review

## Verification

After any performance change:

- [ ] Before and after measurements exist (specific numbers, not "feels faster")
- [ ] The specific bottleneck is identified and addressed
- [ ] Full test suite passes (optimization didn't break behavior)
- [ ] Bundle size hasn't increased on changes unrelated to bundling
- [ ] The performance budget still passes
