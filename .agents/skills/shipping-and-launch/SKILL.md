---
name: shipping-and-launch
description: Prepares production launches. Use when preparing to deploy to production. Use when you need a pre-launch checklist, when setting up monitoring, when planning a staged rollout, or when you need a rollback strategy.
---

# Shipping and Launch

## Overview

Every production deploy is a risk management exercise. Move fast by being deliberate: know what you're deploying, have a rollback plan, verify the system is healthy after deploy, and keep the blast radius small. The fastest way to ship is to have a clean rollback when things go wrong — not to avoid deploying.

## When to Use

- Before any deployment to the Cloud Run production environment
- When deploying a feature that changes user-facing behavior
- When updating environment variables or secrets in GCP
- When rolling out a new API endpoint or removing an old one

## Pre-Deploy Checklist

Run this before triggering any Cloud Build deploy:

### Code Quality
- [ ] All tests pass locally: `pytest tests/ -v`
- [ ] No linting errors: `ruff check api/`
- [ ] TypeScript compiles: `npx tsc --noEmit` (in `web/`)
- [ ] No `TODO: before deploy` comments remaining

### Security
- [ ] No secrets committed to git: `git log --oneline -5` — check commit messages
- [ ] New environment variables are in GCP Secret Manager, not in `cloudbuild.yaml` as plaintext
- [ ] `.env.example` updated if new variables are required

### Observability
- [ ] New endpoints have structured logging (start/complete/error)
- [ ] New endpoints log request_id for correlation

### Documentation
- [ ] `README.md` updated if user-visible behavior changed
- [ ] New environment variables documented in `.env.example`
- [ ] ADR created if an architectural decision was made

### Rollback Readiness
- [ ] Know the previous working Cloud Run revision: `gcloud run revisions list`
- [ ] Know the rollback command (see below)

## Rollback Procedure

GitScape deploys to Cloud Run. Rolling back is instant:

```bash
# List revisions (most recent first)
gcloud run revisions list \
  --service=gitscape-api \
  --region=us-central1 \
  --format="table(name,status.conditions[0].status,spec.containerConcurrency,metadata.creationTimestamp)"

# Rollback: send 100% traffic to the previous revision
gcloud run services update-traffic gitscape-api \
  --to-revisions=PREVIOUS_REVISION_NAME=100 \
  --region=us-central1
```

**When to roll back:**
- Error rate rises above 1% after deploy
- p95 latency exceeds 5 seconds
- Any Critical or High security finding is confirmed in production
- User-reported regressions in core functionality

## Feature Flag Lifecycle

For high-risk features, deploy behind a feature flag:

```python
# 1. Deploy with flag disabled (safe default)
FF_SKILL_HD_TIER = os.getenv("FF_SKILL_HD_TIER", "false").lower() == "true"

# 2. Enable in Cloud Run after confirming deploy is healthy
# gcloud run services update gitscape-api \
#   --update-env-vars FF_SKILL_HD_TIER=true \
#   --region=us-central1

# 3. Monitor for 30 minutes post-enable
# 4. Remove the flag once stable (no surprises for 7+ days)
```

**Flag cleanup:** Remove the flag code (and the env var) once the feature has been stable for at least 7 days.

## Staged Rollout

For high-confidence changes, deploy to all traffic immediately. For risky changes, use Cloud Run traffic splitting:

```bash
# Send 10% of traffic to new revision
gcloud run services update-traffic gitscape-api \
  --to-revisions=NEW_REVISION=10,CURRENT_REVISION=90 \
  --region=us-central1

# Promote to 100% after monitoring
gcloud run services update-traffic gitscape-api \
  --to-latest \
  --region=us-central1
```

## Post-Deploy Verification

After every deploy, verify within 10 minutes:

```bash
# 1. Check that the new revision is serving
gcloud run revisions describe $(gcloud run revisions list \
  --service=gitscape-api --region=us-central1 \
  --format="value(name)" --limit=1) \
  --region=us-central1

# 2. Health check
curl https://api.gitscape.app/health

# 3. Smoke test: verify core functionality
curl -X POST https://api.gitscape.app/api/skills \
  -H "Content-Type: application/json" \
  -d '{"repo": "addyosmani/agent-skills"}'

# 4. Check Cloud Logging for errors
gcloud logging read \
  'resource.type="cloud_run_revision" AND severity>=ERROR' \
  --freshness=10m \
  --limit=20
```

**Green signals:**
- Health check returns 200
- Smoke test returns a skill bundle
- No ERROR-level log lines in the 10 minutes post-deploy

**Red signals (trigger rollback immediately):**
- Health check fails
- Smoke test returns 5xx
- Error rate visible in Cloud Logging

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll skip the checklist this once — it's a small change" | The small change you skip the checklist for is the one that goes wrong. |
| "I don't need a rollback plan — I'm confident in the change" | Confidence is not a rollback plan. |
| "We can fix it forward if something goes wrong" | Fixing forward takes longer than rolling back. Have the rollback ready. |

## Red Flags

- Deploying without running tests
- No knowledge of the previous working revision
- Secrets visible as plaintext in `cloudbuild.yaml`
- No post-deploy verification
- Feature flag deployed but never cleaned up

## Verification

Before declaring a deploy successful:

- [ ] Pre-deploy checklist completed
- [ ] Cloud Build succeeded: no red steps
- [ ] Health check passes post-deploy
- [ ] Smoke test passes post-deploy
- [ ] No ERROR-level logs in the first 10 minutes
- [ ] Rollback command is known and tested (or not needed)
