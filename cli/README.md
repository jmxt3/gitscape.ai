# GitScape CLI

<p align="center">
  <img src="https://raw.githubusercontent.com/jmxt3/GitScape-AI/main/assets/gitscape_readme_banner.png" alt="GitScape Logo" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/v/gitscape.svg?style=flat-square" alt="NPM Version"/></a>
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/dm/gitscape.svg?style=flat-square" alt="NPM Downloads"/></a>
  <a href="https://github.com/jmxt3/gitscape.ai/blob/main/LICENSE"><img src="https://img.shields.io/github/license/jmxt3/GitScape-AI.svg?style=flat-square" alt="License"/></a>
  <a href="https://github.com/jmxt3/gitscape.ai"><img src="https://img.shields.io/github/stars/jmxt3/GitScape-AI.svg?style=flat-square&color=blue" alt="GitHub Stars"/></a>
</p>

---

## What is GitScape?

**GitScape** compiles any GitHub repository into an AI-ready **Agent Skill** in seconds. 

The GitScape CLI is a zero-dependency, lightweight Node.js utility. It communicates with the GitScape backend service, runs code analysis (using tree-sitter) and security scans, downloads the compiled Agent Skill package (`SKILL.md` and supplementary `references/` files), and integrates them directly into your project's local workspace.

Once compiled, AI coding agents (such as Claude Code, Cursor, Windsurf, or Gemini CLI) can immediately read these skills to gain deep, instant context of the target repository without needing to read the entire codebase.

### How It Works: CLI vs. MCP

Both workflows call the same backend compiler service to generate skills, but trigger the process differently:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                             LOCAL WORKSPACE                             │
│                                                                         │
│  ┌───────────────────┐  npx gitscape <url>   ┌───────────────────────┐  │
│  │   User Terminal   ├─────────────────────► │  GitScape Cloud API   │  │
│  └───────────────────┘                       │                       │  │
│                                              │  • Clones repo        │  │
│  ┌───────────────────┐  npx gitscape init    │  • Tree-sitter scan   │  │
│  │     IDE Agent     ├─────────────────────► │  • ScapeGuard audit   │  │
│  │ (Cursor/Claude)   │  (via .mcp.json)      │  • Generates skills   │  │
│  └─────────┬─────────┘                       └───────────┬───────────┘  │
│            │                                             │              │
│            ▼                                             ▼              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Writes to: .agents/skills/ & registers in AGENTS.md / CLAUDE.md  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation

You can run GitScape CLI on-demand without installing it, or install it globally/locally depending on your workflow.

### 1. On-Demand (Recommended)
Run it instantly using `npx`:
```bash
npx gitscape <command> [options]
```

### 2. Global Installation
If you use GitScape frequently, install it globally:
```bash
npm install -g gitscape
```

---

## 💻 Commands

### 1. Compile & Install a Skill
```bash
npx gitscape <repository_url> [options]
```
Clones the repository, analyzes its structure, runs the ScapeGuard security scan, generates a progressively-disclosed skill package, saves it to `.agents/skills/<repo-name>/`, and registers it inside your workspace config files (`AGENTS.md`, `CLAUDE.md`, etc.).

Each compile prints the skill's **ScapeGuard security grade** (`A`–`F`); the full report ships alongside the skill as `scan-report.json` and `scan-report.sarif`.

> **Security gate:** if the scan **fails** (grade `F`), the CLI does **not** write any files. Review the findings with `npx gitscape scan <url>`, or re-run with `--accept-risk` to install anyway.

**Example:**
```bash
npx gitscape https://github.com/google/adk-python
# ✓ Skill compiled successfully (Scan Grade: A, PASS)
#   write .agents/skills/google-adk-python/SKILL.md
#   ...
#   ✓ Skill google-adk-python installed to .agents/skills/google-adk-python
```

**Options:**
* `--token <pat>`: Optional GitHub Personal Access Token (PAT) for compiling private repositories.
* `--accept-risk`: Install the skill even if the security scan fails (grade `F`). Off by default.

---

### 2. Scan a Repo (Without Installing)
```bash
npx gitscape scan <repository_url>
```
Runs ScapeGuard against a repository and prints the security verdict **without building or installing a skill** — nothing is written to disk. Use it to vet a repo before installing, or as a **CI gate** (the command exits non-zero when the scan fails).

**Example:**
```bash
npx gitscape scan https://github.com/google/adk-python
#   ScapeGuard: grade A · PASS · risk 0 · 0 findings
#
# ✓ Safe to install (grade A). Nothing was written.
```

A failing scan prints each finding and exits with code `1`:
```bash
npx gitscape scan https://github.com/acme/suspicious-repo
#   ScapeGuard: grade F · FAIL · risk 100 · 1 finding
#     [CRITICAL] GS-INJ-001 — SKILL.md:3
#            Prompt-injection: attempt to override prior instructions.
#
# ✗ FAIL (grade F): this repo's skill would not pass the security gate.
```

**Options:**
* `--token <pat>`: Optional GitHub Personal Access Token (PAT) for scanning private repositories.

> **Tip:** Run `npx gitscape` with **no arguments** in a terminal for an interactive menu that lets you choose between compiling and scanning.

---

### 3. Initialize Workspace MCP
```bash
npx gitscape init
```
Creates a local `.mcp.json` file inside your current working directory to register the GitScape Model Context Protocol (MCP) server.

---

### 4. Remove/Uninstall a Skill
```bash
npx gitscape remove <skill_name>
# OR
npx gitscape uninstall <skill_name>
```
Deletes the skill folder under `.agents/skills/<name>/` and cleanly removes all references and listings from your workspace files (`AGENTS.md`, `CLAUDE.md`, `.gemini/config/AGENTS.md`).

---

### 5. Update an Already-Installed Skill
```bash
npx gitscape <repository_url>
```
Running the install command again on the same repository is all you need to do — **there is no separate `update` command**. GitScape follows the same pattern as `npm install`: the install is the update.

Before writing the new files the CLI will automatically delete the previous skill directory (`delete_directory_if_exists`), so stale reference files that were renamed or removed upstream never linger. Your `AGENTS.md` / `CLAUDE.md` registration is preserved (it is idempotent).

**Example — re-compile a skill after the upstream repo has changed:**
```bash
npx gitscape https://github.com/google/adk-python
# Output:
#   ✓ Skill compiled successfully (Scan Grade: A)
#   clean .agents/skills/google-adk-python (previous version removed)
#   write .agents/skills/google-adk-python/SKILL.md
#   write .agents/skills/google-adk-python/references/api.md
#   ...
#   ✓ Skill google-adk-python installed to .agents/skills/google-adk-python
```

> **Tip:** Pin to the latest CLI before updating to ensure you get any pipeline improvements:
> ```bash
> npx gitscape@latest https://github.com/owner/repo
> ```

---

## 🔄 Updating the CLI

### Bypass Cache (`npx`)
To ensure you are always running the latest version:
```bash
npx gitscape@latest <command>
```
To force-clear the `npx` cache:
```bash
npm cache clean --force
```

### Update Global Install
```bash
npm install -g gitscape@latest
```

---

## 🔒 Security & Privacy (ScapeGuard)

A skill is code your agent trusts. GitScape runs every compiled skill through **ScapeGuard** — our deterministic scanner with 55+ rules across 9 threat categories — before it ever leaves the server. Every skill earns an **A–F security grade** (backed by a 0–100 risk score), and live credentials and remote-code-execution payloads never ship:

* **Security Grade:** Each compile returns an `A`–`F` grade and `risk_score`, printed by the CLI and recorded in `manifest.json`.
* **Secrets & Credentials:** Detects AWS, GitHub, OpenAI, Stripe keys, and private keys.
* **Injection Protection:** Catches prompt injection, jailbreak/anti-refusal framing, and hidden-Unicode smuggling before it reaches your agent.
* **Malicious Code Detection:** Flags malicious execution, exfiltration, SSRF, and supply-chain risks in scripts and documentation.
* **Dependency Scanning:** Checks pinned dependencies against **OSV.dev** for known vulnerabilities and known-malicious packages.
* **OWASP Alignment:** Maps every finding to the OWASP Agentic Skills & LLM Top 10.
* **License Detection:** Identifies the license and automatically carries it into the manifest.
* **Audit Reports:** Every download ships its own `scan-report.json` + SARIF audit.
* **Token Protection:** Your GitHub access tokens are passed directly to the compiler service in the request payload and are never logged or stored on our servers.
* **Deterministic Sandboxing:** The backend analyzes files in a completely stateless environment.
* **Network Transparency:** The CLI only requests outbound network access to communicate with the GitScape compiler API (`https://gitscape.ai`) to generate skills. It has zero external package dependencies and performs no tracking, analytics, or background data collection.

---

## 📄 License
This project is licensed under the Apache License 2.0. See the [LICENSE](https://github.com/jmxt3/gitscape.ai/blob/main/LICENSE) file for details.

