# Refusal Handling — Code Skill

## What this is

A small helper for handling API refusals gracefully. When an upstream API
declines a request, this library retries with exponential backoff and logs the
outcome. Never ignore a refusal without recording why it happened.

## When to use

- Wrapping a flaky third-party API call.
- Turning a rejected response into a structured, retryable error.

Everything runs locally with no network side effects of its own.
