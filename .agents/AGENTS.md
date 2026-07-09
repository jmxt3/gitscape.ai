# AGENTS.md — GitScape

This file governs how AI coding agents (Antigravity, Gemini CLI, etc.) work in this repository.

## Project Overview

GitScape is a stateless FastAPI service (Python 3.10) deployed on Cloud Run that generates AI coding agent skills from GitHub repositories using the Gemini API. The frontend is React + TypeScript (Vite). There is no database — all state lives in the request lifecycle.

**Stack:** FastAPI · Python 3.10 · Google Gemini API · GitHub API (PyGithub) · React · TypeScript · Vite · Cloud Run · Cloud Build · GCP Secret Manager

## Intent → Skill Mapping

The agent must automatically map user intent to skills before implementing:

| User Intent | Skill to Invoke |
|---|---|
| New feature, new project, new change | `spec-driven-development` → `planning-and-task-breakdown` |
| Planning, breaking down work | `planning-and-task-breakdown` |
| Implementation, writing code | `incremental-implementation` + `test-driven-development` |
| Bug, failure, unexpected behavior | `debugging-and-error-recovery` |
| Code review | `code-review-and-quality` |
| Refactoring, simplification | `code-simplification` |
| API or endpoint design | `api-and-interface-design` |
| UI, frontend, React component | `frontend-ui-engineering` |
| Security concern | `security-and-hardening` |
| Performance issue | `performance-optimization` |
| Deployment, Cloud Run | `shipping-and-launch` + `ci-cd-and-automation` |
| Removing old code or APIs | `deprecation-and-migration` |
| Adding logs, metrics | `observability-and-instrumentation` |
| Architectural decision | `documentation-and-adrs` |

## Development Lifecycle

Follow this order. Do not skip steps:

```
DEFINE  → spec-driven-development
PLAN    → planning-and-task-breakdown
BUILD   → incremental-implementation + test-driven-development
VERIFY  → debugging-and-error-recovery (if tests fail)
REVIEW  → code-review-and-quality
SHIP    → shipping-and-launch
```

## Rules (Always)

- **Spec before code.** No implementation without a written, reviewed spec.
- **Test before shipping.** Every behavioral change has a test that fails without it.
- **Secrets in Secret Manager only.** No secrets in code, `cloudbuild.yaml`, or logs.
- **Treat Gemini output as untrusted.** Validate before writing to SKILL.md.
- **Structured logging only.** No `print()` in production code — use `structlog`.
- **Truncate file previews.** `MAX_PREVIEW_CHARS = 10_000` — never render full large files in the browser.
- **Stateless Cloud Run model.** Never add persistent state (no DB, no disk writes that cross requests).

## Rules (Never)

- Never commit secrets or API keys
- Never store `alloydb-basics`, `cloud-sql-basics`, or `gke-basics` skills — GitScape has no DB or K8s
- Never add `print()` statements in production code
- Never expose internal error details (stack traces) to API consumers
- Never skip the spec and plan phases to "save time"
- Never use `git add -A` blindly — stage only files touched by the current task

## Rules (Ask First)

- Changing authentication or authorization logic
- Adding new external service dependencies
- Changing the Cloud Build pipeline
- Removing or renaming a GCP Secret Manager secret
- Any database or persistent storage decision

## GCP-Specific Skills (Active)

These skills are relevant to the GitScape infrastructure:

- `cloud-run-basics` — deploying and managing the API service
- `ci-cd-and-automation` — Cloud Build pipeline
- `gemini-api` — using the Gemini API with the Gen AI SDK
- `google-cloud-recipe-auth` — GCP authentication patterns
- `google-cloud-waf-security` — security posture on GCP

## Agent Personas

Specialist personas live in `.agents/agents/`:

- `code-reviewer` — Five-axis code review before merge
- `security-auditor` — Security review with GitScape threat model
- `test-engineer` — Test coverage analysis (pytest + FastAPI TestClient)

## References

Quick-reference checklists in `.agents/references/`:

- `definition-of-done.md` — Standing bar every change must clear
- `testing-patterns.md` — pytest patterns for FastAPI
- `security-checklist.md` — Pre-commit security gates
- `performance-checklist.md` — Performance targets and profiling commands
- `observability-checklist.md` — Logging and alerting standards
- `accessibility-checklist.md` — WCAG 2.1 AA for the React frontend
- `orchestration-patterns.md` — How personas and skills compose

## GitScape Skills
- [addyosmani-agent-skills](.agents/skills/addyosmani-agent-skills/SKILL.md)
