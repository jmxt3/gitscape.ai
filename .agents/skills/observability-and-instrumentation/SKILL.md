---
name: observability-and-instrumentation
description: Structured logging, RED metrics, and OpenTelemetry tracing. Use when adding telemetry, or shipping anything that runs in production. Instrument as you build — not after incidents.
---

# Observability and Instrumentation

## Overview

Instrument production code so that on-call engineers (including future AI agents) can answer: **Is it working? What's broken? Why?** Logs answer *why*. Metrics answer *that something is wrong*. Traces answer *where*. Build all three in as you go — retrofitting observability after an incident is painful and late.

## When to Use

- Adding a new API endpoint or background job
- Shipping a feature that touches external services (GitHub API, Gemini)
- Modifying error handling or retry logic
- Any change to Cloud Run that affects request processing

## The Three Pillars

### 1. Structured Logging

Every log line should be machine-parseable JSON, not a free-form string.

```python
import structlog

log = structlog.get_logger()

# GOOD: Structured, queryable
log.info(
    "skill_generation_started",
    repo=repo,
    tier=tier,
    request_id=request_id,
)

log.error(
    "github_api_error",
    repo=repo,
    status_code=e.status,
    error=str(e),
    request_id=request_id,
)

# BAD: Free-form string — unsearchable
print(f"Error fetching {repo}: {e}")
logger.info("Starting skill generation for " + repo)
```

**Log level conventions:**
- `error` — invariant broken, someone may need to act
- `warn` — degraded but handled (rate limit approaching, retrying)
- `info` — significant business event (skill generated, export downloaded)
- `debug` — off in production; verbose tracing for local debugging

**Never log:**
- Secrets, API keys, or tokens
- Full request/response bodies
- Unredacted PII or GitHub personal access tokens

### 2. RED Metrics for Every Endpoint

For every API endpoint, instrument:
- **Rate** — requests per second
- **Errors** — error rate (%)
- **Duration** — p50/p95/p99 latency (histogram, never average)

```python
from prometheus_client import Counter, Histogram

skill_generation_requests = Counter(
    "skill_generation_requests_total",
    "Total skill generation requests",
    ["tier", "status"]  # labels: tier=standard|hd, status=success|error
)

skill_generation_duration = Histogram(
    "skill_generation_duration_seconds",
    "Skill generation duration",
    ["tier"],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

# Usage
with skill_generation_duration.labels(tier=tier).time():
    try:
        result = await generate_skill(repo, tier)
        skill_generation_requests.labels(tier=tier, status="success").inc()
    except Exception as e:
        skill_generation_requests.labels(tier=tier, status="error").inc()
        raise
```

### 3. Correlation IDs

Every request should carry a correlation ID that propagates through all log lines and outbound calls:

```python
import uuid
from fastapi import Request

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    # Bind to structlog context so all logs in this request carry it
    with structlog.contextvars.bound_contextvars(request_id=request_id):
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

## Alerting Principles

**Alert on symptoms, not causes.** Users experience symptoms.

| Wrong (cause-based alert) | Right (symptom-based alert) |
|---|---|
| "CPU > 80%" | "Error rate > 1% for 5 minutes" |
| "GitHub API calls failing" | "Skill generation success rate < 95%" |
| "Memory usage high" | "p95 latency > 5s" |

**Actionable alerts only.** If an alert fires and you don't know what to do, the alert is not ready.

## Cloud Logging on Cloud Run

GitScape deploys to Cloud Run. Logs written to stdout/stderr are automatically captured by Cloud Logging:

```python
# structlog outputs JSON to stdout → Cloud Logging ingests automatically
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)
```

Query logs in Cloud Logging:
```
resource.type="cloud_run_revision"
resource.labels.service_name="gitscape-api"
jsonPayload.event="skill_generation_started"
```

## GitScape-Specific Instrumentation Checklist

For every new endpoint in `api/app/`:

- [ ] Log `skill_generation_started` (or equivalent) with `repo`, `tier`, `request_id`
- [ ] Log `skill_generation_completed` with `repo`, `tier`, `duration_ms`
- [ ] Log `skill_generation_failed` with `repo`, `tier`, `error`, `request_id`
- [ ] External API calls (GitHub, Gemini) logged with `endpoint`, `status_code`, `latency_ms`
- [ ] No secrets or tokens in any log line

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add logging later" | You'll add it at 2 AM during an incident. Add it now. |
| "It's obvious from the code what's happening" | It's not obvious from Cloud Logging at 2 AM when you have no context. |
| "Logs slow things down" | Async structured logging is negligible overhead. The absence of logs is never negligible during an outage. |

## Red Flags

- `print()` statements in production code
- Log lines that are free-form strings without structured fields
- External API calls with no logging of status or latency
- Missing correlation ID on requests
- No error logging in exception handlers

## Verification

Before shipping any new endpoint or feature:

- [ ] All request handlers log start/complete/error with structured fields
- [ ] External service calls (GitHub, Gemini) log status and latency
- [ ] Correlation ID is propagated through all log lines
- [ ] No secrets or tokens in any log line
- [ ] Log output spot-checked: valid JSON, structured fields visible in Cloud Logging
