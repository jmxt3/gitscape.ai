# Performance Checklist

Quick reference for performance work in GitScape. Use alongside the `performance-optimization` skill.

## Baseline Before Optimizing

```bash
# API response time
curl -w "Time: %{time_total}s\n" -s -o /dev/null \
  -X POST https://api.gitscape.app/api/skills \
  -H "Content-Type: application/json" \
  -d '{"repo": "addyosmani/agent-skills"}'

# Frontend bundle size (after build)
npx vite build --mode production 2>&1 | grep "dist/"

# Lighthouse (frontend)
npx lighthouse https://gitscape.app --output json --output-path ./baseline.json
```

## Performance Targets

| Metric | Target | Alarm |
|--------|--------|-------|
| Skill generation (p95) | < 30s | > 60s |
| Metadata endpoints (p95) | < 200ms | > 1000ms |
| Frontend JS bundle | < 200KB gzipped | > 400KB |
| File preview render | < 100ms for < 10KB | Freeze |
| Lighthouse Performance | ≥ 80 | < 60 |

## Frontend Checklist

- [ ] File previews truncated at `MAX_PREVIEW_CHARS = 10_000`
- [ ] No `console.error` or `console.warn` during normal usage
- [ ] Heavy components use `React.lazy()` + `Suspense`
- [ ] Lists with > 50 items use virtualization or pagination
- [ ] No inline object/array props in JSX (creates new references every render)

## Backend Checklist

- [ ] GitHub API calls parallelized with `asyncio.gather()` where possible
- [ ] No sequential per-file API calls (N+1 pattern)
- [ ] Long-running operations logged with duration
- [ ] No blocking synchronous calls in async endpoints

## Core Web Vitals Targets

| Metric | Good | Needs Improvement |
|--------|------|------------------|
| LCP | < 2.5s | 2.5s – 4.0s |
| INP | < 200ms | 200ms – 500ms |
| CLS | < 0.1 | 0.1 – 0.25 |

## Profiling Commands

```bash
# Python: profile a slow function
python -m cProfile -o profile.out api/app/skillforge/assemble.py
python -c "import pstats; p = pstats.Stats('profile.out'); p.sort_stats('cumulative'); p.print_stats(20)"

# Bundle analysis
npx vite-bundle-visualizer   # visual treemap of bundle
```
