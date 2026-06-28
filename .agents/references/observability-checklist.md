# Observability Checklist

Quick reference for instrumenting GitScape in production. Use alongside the `observability-and-instrumentation` skill.

## Pre-Launch Gate

Before shipping any new endpoint, confirm all of the following:

- [ ] Request start/complete/error logged with structured fields
- [ ] `request_id` on every log line in the request context
- [ ] External calls (GitHub, Gemini) log `endpoint`, `status_code`, `latency_ms`
- [ ] No secrets or tokens in any log line
- [ ] Log output spot-checked in Cloud Logging: valid JSON, fields are queryable

## Structured Log Fields

Every business-significant log line should include:

| Field | Example | Required? |
|-------|---------|-----------|
| `event` | `"skill_generation_started"` | Yes |
| `request_id` | `"abc-123-def"` | Yes |
| `repo` | `"owner/repo"` | When applicable |
| `tier` | `"standard"` | When applicable |
| `duration_ms` | `1250` | On completion |
| `error` | `"Rate limit exceeded"` | On errors |
| `status_code` | `200` | For external calls |

## Log Level Guide

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Invariant broken; someone may need to act | GitHub API returned unexpected 500 |
| `warn` | Degraded but handled | Retrying after rate limit, falling back to standard tier |
| `info` | Significant business event | Skill generated, export downloaded |
| `debug` | Off in production; verbose tracing | Individual file fetched from GitHub |

## Cloud Logging Queries

```
# Recent errors
resource.type="cloud_run_revision"
resource.labels.service_name="gitscape-api"
severity>=ERROR
timestamp>="2026-06-28T00:00:00Z"

# Slow skill generations (duration_ms > 30000)
resource.type="cloud_run_revision"
jsonPayload.event="skill_generation_completed"
jsonPayload.duration_ms>30000

# GitHub API errors
resource.type="cloud_run_revision"
jsonPayload.event="github_api_error"
```

## Alerting Policy

Configure these alerts in Cloud Monitoring:

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | Error rate > 1% for 5 min | Page |
| Slow responses | p95 latency > 60s for 5 min | Page |
| No traffic | Request rate = 0 for 10 min | Warn (could be legitimate) |
