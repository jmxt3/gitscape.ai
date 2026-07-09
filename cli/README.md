# GitScape CLI

<p align="center">
  <img src="https://raw.githubusercontent.com/jmxt3/GitScape-AI/main/assets/gitscape_readme_banner.png" alt="GitScape Logo" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/v/gitscape.svg?style=flat-square" alt="NPM Version"/></a>
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/dm/gitscape.svg?style=flat-square" alt="NPM Downloads"/></a>
  <a href="https://github.com/jmxt3/GitScape-AI/blob/main/LICENSE"><img src="https://img.shields.io/github/license/jmxt3/GitScape-AI.svg?style=flat-square" alt="License"/></a>
  <a href="https://github.com/jmxt3/GitScape-AI"><img src="https://img.shields.io/github/stars/jmxt3/GitScape-AI.svg?style=flat-square&color=blue" alt="GitHub Stars"/></a>
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
Clones the repository, analyzes its structure, runs security checks, generates a progressively-disclosed skill package, saves it to `.agents/skills/<repo-name>/`, and registers it inside your workspace config files (`AGENTS.md`, `CLAUDE.md`, etc.).

**Example:**
```bash
npx gitscape https://github.com/google/adk-python
```

**Options:**
* `--token <pat>`: Optional GitHub Personal Access Token (PAT) for compiling private repositories.

---

### 2. Initialize Workspace MCP
```bash
npx gitscape init
```
Creates a local `.mcp.json` file inside your current working directory to register the GitScape Model Context Protocol (MCP) server.

---

### 3. Remove/Uninstall a Skill
```bash
npx gitscape remove <skill_name>
# OR
npx gitscape uninstall <skill_name>
```
Deletes the skill folder under `.agents/skills/<name>/` and cleanly removes all references and listings from your workspace files (`AGENTS.md`, `CLAUDE.md`, `.gemini/config/AGENTS.md`).

**Example:**
```bash
npx gitscape remove adk-python
```

---

### 4. Update an Already-Installed Skill
```bash
npx gitscape <repository_url>
```
Running the install command again on the same repository is all you need to do — **there is no separate `update` command**. GitScape follows the same pattern as `npm install`: the install is the update.

Before writing the new files the CLI will automatically delete the previous skill directory (`delete_directory_if_exists`), so stale reference files that were renamed or removed upstream never linger. Your `AGENTS.md` / `CLAUDE.md` registration is preserved (it is idempotent).

**Example — re-compile a skill after the upstream repo has changed:**
```bash
npx gitscape https://github.com/google/adk-python
# Output:
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

A skill is code your agent trusts. GitScape runs every compiled skill through **ScapeGuard** — our deterministic scanner with 45+ rules across 9 threat categories — before it ever leaves the server. Live credentials and remote-code-execution payloads never ship:

* **Secrets & Credentials:** Detects AWS, GitHub, OpenAI, Stripe keys, and private keys.
* **Injection Protection:** Catches prompt injection and hidden-Unicode smuggling before it reaches your agent.
* **Malicious Code Detection:** Flags malicious execution, exfiltration, and supply-chain risks in scripts and documentation.
* **OWASP Alignment:** Maps every finding to the OWASP Agentic Skills & LLM Top 10.
* **License Detection:** Identifies the license and automatically carries it into the manifest.
* **Audit Reports:** Every download ships its own `scan-report.json` + SARIF audit.
* **Token Protection:** Your GitHub access tokens are passed directly to the compiler service in the request payload and are never logged or stored on our servers.
* **Deterministic Sandboxing:** The backend analyzes files in a completely stateless environment.

---

## 📄 License
This project is licensed under the Apache License 2.0. See the [LICENSE](https://github.com/jmxt3/GitScape-AI/blob/main/LICENSE) file for details.

