# Security Checklist

Pre-commit security checks for GitScape. Use alongside the `security-and-hardening` skill.

## Before Every Commit

```bash
# Check for accidentally staged secrets
git diff --cached | grep -i "api_key\|secret\|password\|token\|GEMINI\|GITHUB"

# Check no .env files are staged
git diff --cached --name-only | grep "\.env"
```

## Secrets Management

| ✅ Do | ❌ Never |
|---|---|
| Access secrets via `os.getenv("SECRET_NAME")` | Hardcode any secret in source |
| Store secrets in GCP Secret Manager | Commit `.env` files |
| Inject via Cloud Run `--set-secrets` | Pass secrets as plaintext in `cloudbuild.yaml` |
| Document variable names in `.env.example` | Log secrets or tokens |

## Input Validation (FastAPI)

```python
from pydantic import BaseModel, field_validator
import re

class SkillRequest(BaseModel):
    repo: str

    @field_validator("repo")
    @classmethod
    def validate_repo_format(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$", v):
            raise ValueError("Repo must be in 'owner/repo' format")
        return v
```

## LLM Output Safety (Gemini)

```python
# NEVER: Use Gemini output directly as a file path, code, or command
file_path = gemini_response.text  # ❌

# ALWAYS: Treat as untrusted text, validate structure
raw = gemini_response.text
try:
    parsed = SkillSchema.model_validate_json(raw)
except ValidationError:
    logger.error("gemini_output_invalid", raw=raw[:200])
    raise SkillGenerationError("Model returned invalid output")
```

## Error Messages

```python
# NEVER: Expose internal details to users
raise HTTPException(status_code=500, detail=str(e))  # ❌ leaks traceback/paths

# ALWAYS: Generic message to user, full detail in logs
logger.error("skill_generation_failed", error=str(e), repo=repo)
raise HTTPException(status_code=500, detail="Skill generation failed. Please try again.")
```

## OWASP Top 10 Quick Check

- [ ] **A01 Broken Access Control** — No auth bypass, no IDOR (GitScape is stateless but check GitHub token scope)
- [ ] **A02 Cryptographic Failures** — No secrets in plaintext, HTTPS only
- [ ] **A03 Injection** — All repo params validated; no shell commands with user input
- [ ] **A04 Insecure Design** — Trust boundaries identified (see security-and-hardening)
- [ ] **A05 Security Misconfiguration** — No debug mode in production, no verbose errors
- [ ] **A06 Vulnerable Components** — Dependencies audited: `pip-audit` / `npm audit`
- [ ] **A07 Auth Failures** — GitHub token not logged, not returned in API responses
- [ ] **A08 Integrity Failures** — Gemini output validated before use
- [ ] **A09 Logging Failures** — Structured logging present; no secrets in logs
- [ ] **A10 SSRF** — Repo URLs go to GitHub API only, not arbitrary URLs
