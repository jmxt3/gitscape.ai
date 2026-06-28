# Git Scape AI

**Understand any GitHub repository in seconds.**

![React](https://img.shields.io/badge/React-61DAFB.svg?style=for-the-badge&logo=React&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?style=for-the-badge&logo=FastAPI&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-4285F4.svg?style=for-the-badge&logo=Google-Cloud&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2.svg?style=for-the-badge&logo=Google-Gemini&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED.svg?style=for-the-badge&logo=Docker&logoColor=white)

---

## 🚀 Overview

Git Scape AI is an open-source platform that instantly generates AI-ready text digests of GitHub codebases, visualizes repository structures with interactive diagrams, and packages any repo into a downloadable **Agent Skill** for Claude, Google ADK, Agno, and other agent frameworks. It supports both public and private repositories.

- **Code Digests:** Generate a complete, AI-ready text digest of any GitHub repo.
- **Interactive Visualizations:** Explore your codebase structure with beautiful, interactive diagrams.
- **Agent Skills (SkillForge):** Turn a repo into a progressively-disclosed `SKILL.md` + `references/` package, built **deterministically** (tree-sitter) with an optional LLM "HD" mode.
- **Security Scanner:** Every generated skill is scanned for prompt injection, exfiltration, and hidden text — export is gated behind a visible **PASS / WARN / FAIL** report.
- **Privacy First:** GitHub tokens stay in your browser; the HD model key stays server-side.
- **Real-Time Streaming:** WebSocket-powered digest generation with live progress updates.

> **What changed recently:** the old in-browser WebLLM skill writer was replaced by **SkillForge** — a deterministic, server-side pipeline that does ~90% of the work with zero LLM calls, gated by a security scanner. See [Agent Skills (SkillForge)](#-agent-skills-skillforge) below.

---

## 🏗️ Architecture

This is a monorepo containing two independently deployable workspaces:

```
GitScape/
├── web/      # React 19 + TypeScript frontend (Vite, Tailwind CSS, D3)
└── api/      # FastAPI backend (Python, Docker, Google Cloud Run)
```

### How they fit together

```
┌──────────────────────────────────────┐
│              Browser                 │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │   web/  (React 19 + Vite)       │ │
│  │                                 │ │
│  │  • Digest viewer (Markdown)     │ │
│  │  • Interactive D3 diagram       │ │
│  │  • Agent Skill export + badge   │ │
│  │  • URL → GitHub repo resolver   │ │
│  └──────────┬──────────────────────┘ │
│             │ HTTP / WebSocket        │
└─────────────┼────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│   api/  (FastAPI on Cloud Run)       │
│                                      │
│  GET  /converter      → digest+skill │
│  WS   /ws/converter   → streaming    │
│  POST /skill-zip      → .zip (gated) │
│  POST /skill/hd-prose → HD prose     │
│  GET  /export/{fw}    → ADK / Agno   │
│                                      │
│  • Clones & analyzes git repos       │
│  • SkillForge skill pipeline         │
│  • Deterministic security scanner    │
│  • Rate limiting (SlowAPI)           │
└──────────────────────────────────────┘
```

### `web/` — Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 4 |
| Diagrams | D3.js 7 |
| Deployment | Docker + Nginx → Cloud Run |

Key components: `App.tsx` (orchestrator), `Diagram` (interactive D3 tree), `DigestOutput` (Markdown render), `SkillExport` (Agent Skill preview, scan badge, Standard/HD toggle), `RepoInput` (URL → repo resolver).

### `api/` — Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| Runtime | Python 3.10 (managed via `uv`) |
| Code parsing | tree-sitter (Python, TS/TSX, JS/JSX, Go) |
| HD prose (optional) | Gemini Flash (server-side key) |
| Rate Limiting | SlowAPI |
| Deployment | Docker → Google Cloud Run |

Key modules: `main.py` (entrypoint + middleware), `app/api.py` (router + CORS), `app/converter.py` (clone & digest logic), `app/config.py` (settings), `app/skillforge/` (the Agent Skill pipeline — see below).

---

## 🧠 Agent Skills (SkillForge)

SkillForge turns a repository digest into a high-quality, progressively-disclosed
[Agent Skill](https://agentskills.io). The guiding principle is **invert the labor**:
do ~90% of the work deterministically from the code's structure, and use an LLM only
for short natural-language glue.

**Pipeline** (`api/app/skillforge/`):

```
ingest → parse → classify → extract → sanitize → assemble → scan (GATE) → package
```

- **parse** — split the digest by its `FILE:` markers (or read the live clone) into typed `ContentUnit`s.
- **extract** — the quality lever, fully deterministic via **tree-sitter**: a public API/symbol index (signatures + one-line purpose), an import/dependency graph, mined setup commands, and deduped code examples.
- **assemble** — a slim, token-budgeted `SKILL.md` plus a `references/` folder (`api.md`, `architecture.md`, `examples.md`, `setup.md`, `config.md`), every chunk stamped with its source path.
- **scan** — a deterministic, zero-LLM security gate (see below).

**Output package:**

```
<owner-repo>/
├── SKILL.md            # slim entry point (token-budgeted, links into references/)
├── references/*.md     # api, architecture, examples, setup, config (provenance-stamped)
├── exporters/*.py      # Google ADK + Agno wrappers
└── manifest.json       # digest hash + per-chunk provenance + scan status
```

### Two tiers

| Tier | What it does | Needs a key? |
|---|---|---|
| **Standard** (default) | Complete, valid skill built **deterministically** — instant, no model | No |
| **HD** | Adds LLM-written prose (the "what / when / description") via Gemini Flash | Server-side `GEMINI_API_KEY` |

### 🛡️ Security scanner (the trust layer)

The digest is repo-derived and untrusted, so an injection planted in a README or
docstring could flow into `SKILL.md` and then into your agent's context. Every
generated skill is scanned (pure Python, no LLM) for **prompt injection**,
**exfiltration**, **hidden/invisible text**, and high-entropy blobs. The result is a
visible badge:

- **PASS** → export allowed.
- **WARN** → requires explicit "I accept the warnings".
- **FAIL** → export **blocked** (`POST /skill-zip` returns `422` with the report, naming the originating file).

---

## 🏁 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (for `web/`)
- [Python 3.10+](https://python.org/) + [`uv`](https://github.com/astral-sh/uv) (for `api/`)
- [Docker](https://www.docker.com/) (optional, for containerized runs)

### Run the Frontend

```bash
cd web
npm install
npm run dev
# → http://localhost:5173
```

By default the frontend talks to the **production** API (`api.gitscape.ai`). To run
end-to-end against your **local** backend (required to use the new skill endpoints),
point it at your local API in `web/.env.local`:

```env
VITE_API_HOST=localhost:8080
```

> No client-side Gemini key is needed — HD prose is generated server-side by the API.

### Run the Backend

```bash
cd api
uv venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
uv sync
cp .env.example .env
# (optional) set GEMINI_API_KEY in .env to enable HD mode
uvicorn main:app --reload --port 8080
# → http://localhost:8080/docs
```

---

## 🐳 Docker

Both services ship with a `Dockerfile`. Run them independently:

```bash
# Frontend
cd web && docker build -t git_scape_web . && docker run -p 8080:8080 git_scape_web

# Backend
cd api && docker build -t git_scape_api . && docker run -p 8080:8080 git_scape_api
```

For full deployment instructions on **Google Cloud Run**, see the README inside each workspace:
- [`web/README.md`](web/README.md)
- [`api/README.md`](api/README.md)

---

## 🧑‍💻 Contributing

We welcome contributions of all kinds!

1. **Fork** the repository and create your branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Work inside the relevant workspace (`web/` or `api/`).
3. **Test locally** before opening a PR.
4. **Open a Pull Request** with a clear description of the change.

### Code Style

- **Frontend**: TypeScript + React, Tailwind CSS, ESLint conventions.
- **Backend**: PEP8, [black](https://black.readthedocs.io/) formatting, type hints on all public functions.

---

## 📚 Resources

- [Git Scape AI Website](https://gitscape.ai/)
- [Gemini API Key Docs](https://ai.google.dev/gemini-api/docs/api-key)
- [GitHub PAT Docs](https://github.com/settings/tokens/new?scopes=repo&description=GitRepoDigestAI)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

Created by [João Machete](https://github.com/jmxt3) and contributors.

If you like this project, please ⭐️ the repo and share your feedback!
