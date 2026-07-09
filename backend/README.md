# Git Scape AI — Backend API

**The FastAPI backend for [Git Scape AI](https://gitscape.ai/).**

![Python](https://img.shields.io/badge/Python-3776AB.svg?style=for-the-badge&logo=Python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?style=for-the-badge&logo=FastAPI&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-4285F4.svg?style=for-the-badge&logo=Google-Cloud&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED.svg?style=for-the-badge&logo=Docker&logoColor=white)

> Part of the [GitScape monorepo](../README.md). See also: [`frontend/`](../frontend/README.md).

---

## 🚀 Overview

The `backend/` workspace is the backend service that powers Git Scape AI. It clones any public or private GitHub repository, analyzes its structure, streams a Markdown digest back to the client, and packages the repo into a downloadable **Agent Skill** via the **SkillForge** pipeline.

### Key Features

- **REST endpoint** — HTTP digest generation that also returns the skill preview (`GET /converter`).
- **WebSocket endpoint** — Real-time streaming with live progress (`WS /ws/converter`).
- **MCP Server Endpoints** — Exposes `/mcp/tools` and `/mcp/call` supporting the `install_skill` tool for agent integrations.
- **SkillForge** — Deterministic Agent Skill generation (tree-sitter), with an optional Gemini "HD" prose tier.
- **Freshness Stamping** — Injects git HEAD SHA (`source_git_head`) and creation timestamps (`built_at`) into manifest metadata to allow automatic drift detection.
- **Security scanner** — Pure-Python, zero-LLM gate over every generated skill (prompt injection, exfiltration, hidden text). `FAIL` blocks export.
- **Rate limiting** — Per-IP throttling via SlowAPI to protect the service.
- **Request timing** — `X-Process-Time-Sec` header on every response for observability.
- **Cloud Run ready** — Listens on the `PORT` env variable, defaults to `8081`.

---

## 🏗️ Architecture

```
backend/
├── main.py               # FastAPI entrypoint: middleware, rate limiter, router mounting
├── app/
│   ├── api.py            # App factory (CORS), all HTTP, WebSocket and MCP routes
│   ├── mcp.py            # MCP server tool definitions and call handlers
│   ├── converter.py      # Core logic: clone → analyze → build digest
│   ├── config.py         # Pydantic Settings (env-based configuration)
│   ├── skill_builder.py  # Shared helpers: language detection, skill naming
│   └── skillforge/       # Agent Skill pipeline
│       ├── parse.py      #   digest/clone → ContentUnit[]
│       ├── classify.py   #   docs | source | config | test | other
│       ├── extract/      #   tree-sitter symbols, import graph, setup, examples
│       ├── assemble.py   #   token-budgeted SKILL.md + references/
│       ├── scan.py       #   deterministic security gate (PASS/WARN/FAIL)
│       ├── hd.py         #   optional Gemini Flash prose
│       ├── exporters.py  #   Google ADK + Agno wrappers
│       └── package.py    #   zip the package, enforce the gate
├── tests/                # pytest suite (parser, extractor, scanner, API, MCP)
├── pyproject.toml        # Project metadata & dependencies managed by uv
├── uv.lock               # Fast, locked dependencies file
├── Dockerfile            # Production container (Python + uvicorn)
└── .env.example          # Environment variable template
```

### Request Flow

```
Client / CLI / MCP Client
  │
  ├─ GET /converter?repo_url=...
  │      └─ converter.py → digest  ┐
  │         skillforge.build_skill ┴→ digest + skill_md + references + scan_report + manifest
  │
  ├─ WS /ws/converter?repo_url=...
  │      └─ converter.py → streaming progress + final digest
  │
  ├─ POST /skill-zip          → cached/rebuilt skill .zip  (422 + report if scan FAILs)
  ├─ POST /skill/hd-prose     → skill rebuilt with Gemini prose (503 if no key)
  ├─ GET  /export/{framework} → ADK / Agno wrapper (.py)
  │
  ├─ GET  /mcp/tools          → lists install_skill tool definition
  └─ POST /mcp/call           → executes install_skill (clones, scans, returns file payload JSON)
```

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| Language | Python 3.10 |
| Package Manager | [`uv`](https://github.com/astral-sh/uv) |
| ASGI Server | Uvicorn |
| Code parsing | tree-sitter (Python, TS/TSX, JS/JSX, Go) |
| HD prose (optional) | Gemini Flash via REST (server-side key) |
| Rate Limiting | SlowAPI |
| Deployment | Docker → Google Cloud Run |

---

## 🏁 Quick Start

### Prerequisites

- Python 3.10+
- [`uv`](https://github.com/astral-sh/uv) — fast Python package manager

**Install `uv`:**
```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
irm https://astral.sh/uv/install.ps1 | iex

# Or via pip
pip install uv
```

### 1. Create Environment & Install Dependencies

```bash
cd backend
uv venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
uv sync
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env as needed
```

`.env.example` template:
```env
ENVIRONMENT=development
APP_NAME="GitScape API"
APP_DESCRIPTION="The official API for GitScape, a tool for generating digests from any git repositories."
APP_VERSION="0.1.0"

# HD skill prose (optional). Server-side Gemini key — never exposed to the browser.
# Leave blank to disable HD mode; the deterministic Standard tier needs no key.
GEMINI_API_KEY=""
HD_MODEL="gemini-3.1-flash-lite"
```

### 3. Run the API

```bash
# Development (with hot reload enabled)
uv run uvicorn main:app --host 127.0.0.1 --port 8081 --reload

# Production
uv run uvicorn main:app --host 0.0.0.0 --port 8081 --workers 4
```

> The local backend runs on port **8081** so that the frontend's Vite proxy (`localhost:5173`) maps correctly.

### 4. Explore the Docs

| Interface | URL |
|---|---|
| Swagger UI | http://localhost:8081/docs |
| ReDoc | http://localhost:8081/redoc |

---

## 🧪 Testing

The backend is backed by an extensive pytest suite. Always run tests using the `uv` toolchain:

```bash
# Activate virtual environment
source .venv/bin/activate    # Windows: .venv\Scripts\activate

# Run tests silently
uv run pytest -q

# Run verbose with coverage
uv run pytest -v
```

Testing coverage details:
- **Parser & Extractor**: `test_parse.py`, `test_extract.py`, `test_assemble.py`.
- **Security Scanner**: `test_scan_obfuscation.py`, `test_scan_secrets.py`, `test_scan_supply_chain.py`.
- **MCP routes**: `test_mcp.py` mocks repository cloning and asserts the tool structure response.

---

## 📡 API Reference

### Standard Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check — returns service name & status |
| `GET` | `/converter` | Clone a repo → digest **+** skill preview (`skill_md`, `references`, `scan_report`, `manifest`) |
| `WS` | `/ws/converter` | Real-time streaming digest with live progress events |
| `POST` | `/skill-zip` | Build/return the skill `.zip` from a digest. **`422` + scan report if the scan FAILs** |
| `POST` | `/skill/hd-prose` | Rebuild the skill with Gemini-written prose. `503` if no server key |
| `GET` | `/export/{framework}` | Download an `adk` or `agno` framework wrapper (`.py`) |

### MCP Server Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/mcp/tools` | List all available MCP tools (including `install_skill`) |
| `POST` | `/mcp/call` | Invoke an MCP tool with name and arguments |

---

## 🧠 SkillForge — Agent Skill generation

SkillForge (`app/skillforge/`) converts a repository into a progressively-disclosed
[Agent Skill](https://agentskills.io).

```
ingest → parse → classify → extract → sanitize → assemble → scan (GATE) → package
```

- **Metadata tracking**: Automatically extracts `git_sha` from sparse-clones to map the `source_git_head` in the manifest.
- **scan** (`scan.py`): Pure-Python, deterministic, **no LLM**. Scans `SKILL.md` + `references/*.md` (+ any shipped script) and detects prompt injection, exfiltration patterns, hidden/invisible unicode, and high-entropy blobs.
- **package** (`package.py`): Zips `SKILL.md` + `references/` + ADK/Agno `exporters/` + a provenance-stamped `manifest.json`.

---

## 🐳 Docker

```bash
# Build
docker build -t git_scape_api .

# Run locally
docker run -d -p 8081:8081 --name git_scape_api_local git_scape_api
# → http://localhost:8081/docs
```

### Deploy to Google Cloud Run

```bash
# 1. Enable required APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 2. Build & push via Cloud Build
gcloud beta builds submit \
  --tag REGION-docker.pkg.dev/PROJECT_ID/REPO/git_scape_api:latest .

# 3. Deploy
gcloud run deploy git-scape-api \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPO/git_scape_api:latest \
  --platform managed \
  --region REGION \
  --allow-unauthenticated \
  --project PROJECT_ID
```

---

## 🧑‍💻 Contributing

1. Fork the repo and create a feature branch.
2. Make your changes inside `backend/`.
3. Ensure code is formatted (`black` or `ruff`) and pytest passes.
4. Open a Pull Request.

**Code style:** PEP8, black formatting, type hints + docstrings on all public functions.

---

## 📚 Resources

- [Git Scape AI Website](https://gitscape.ai/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [uv Docs](https://docs.astral.sh/uv/)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Git Scape Web (Frontend)](../frontend/README.md)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).
