# Definition of Done

A standing, project-wide bar that every change must clear before it counts as done. Unlike acceptance criteria (which vary per task), the Definition of Done is the same every time and answers: **"Is this finished to our standard?"**

## The Standing Checklist

Apply this to every change before declaring it done.

### Correctness
- [ ] All acceptance criteria for the task are met
- [ ] Code runs and behaves as intended — verified at runtime, not just compiled
- [ ] New behavior is covered by tests that fail without the change and pass with it
- [ ] Existing tests still pass; no regressions introduced
- [ ] Edge cases and error paths are handled

### Quality
- [ ] Code reveals intent through naming and structure
- [ ] No duplicated business logic
- [ ] No dead code, debug output, or commented-out blocks
- [ ] Changes are scoped to the task; no unrelated refactors
- [ ] Linting passes: `ruff check api/`

### Integration
- [ ] Change works with the rest of the system, not just in isolation
- [ ] Environment variables updated in GCP Secret Manager (if applicable)
- [ ] Feature flags accounted for (if applicable)

### Documentation
- [ ] Public API functions have docstrings
- [ ] New environment variables documented in `.env.example`
- [ ] ADR created if an architectural decision was made
- [ ] README updated if user-visible behavior changed

### Ship-Readiness
- [ ] Security implications reviewed (secrets safe, input validated)
- [ ] Observability in place for new critical paths (structured logging)
- [ ] Rollback path known for any risky change
- [ ] Human has reviewed and approved before merge or deploy

## Red Flags

- "It's done, I just haven't run it yet" — unverified work is not done
- "Tests pass" while docs and runtime verification are skipped
- A different bar applied depending on deadline pressure
- "Done" declared before human review on changes that need it
