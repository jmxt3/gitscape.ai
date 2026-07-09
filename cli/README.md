# GitScape CLI

<p align="center">
  <img src="https://raw.githubusercontent.com/jmxt3/GitScape-AI/main/assets/gitscape_readme_banner.png" alt="GitScape Logo" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/v/gitscape.svg?style=flat-square" alt="NPM Version"/></a>
  <a href="https://www.npmjs.com/package/gitscape"><img src="https://img.shields.io/npm/dm/gitscape.svg?style=flat-square" alt="NPM Downloads"/></a>
  <a href="https://github.com/jmxt3/GitScape-AI/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/gitscape.svg?style=flat-square" alt="License"/></a>
  <a href="https://github.com/jmxt3/GitScape-AI"><img src="https://img.shields.io/github/stars/jmxt3/GitScape-AI.svg?style=flat-square&color=blue" alt="GitHub Stars"/></a>
</p>

---

## What is GitScape?

**GitScape** compiles any GitHub repository into an AI-ready **Agent Skill** in seconds. 

The GitScape CLI is a zero-dependency, lightweight Node.js utility. It communicates with the GitScape backend service, runs code analysis (using tree-sitter) and security scans, downloads the compiled Agent Skill package (`SKILL.md` and supplementary `references/` files), and integrates them directly into your project's local workspace.

Once compiled, AI coding agents (such as Claude Code, Cursor, Windsurf, or Gemini CLI) can immediately read these skills to gain deep, instant context of the target repository without needing to read the entire codebase.

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

### 3. Local Development Link
If you are developing or contributing to the CLI:
```bash
cd cli
npm link
```
This maps the global `gitscape` terminal command to your local workspace code.

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
* `--type <type>`: Skill type: `code` or `framework` (default: `code`).

---

### 2. Initialize Workspace MCP
```bash
npx gitscape init
```
Creates a local `.mcp.json` file inside your current working directory to register the GitScape Model Context Protocol (MCP) server.

**Example:**
```bash
npx gitscape init
```

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
GitScape is built with security first:
* **Token Protection:** Your GitHub access tokens are passed directly to the compiler service in the request payload and are never logged or stored.
* **Deterministic Sandboxing:** The backend analyzes files in a stateless environment.
* **ScapeGuard Analysis:** Every compiled skill is scanned for prompt injection, data exfiltration scripts, and hidden text, outputting a clear security grade before writing files.

---

## 🧑‍💻 Maintainer: Publishing Updates

To publish updates to the npm registry:

1. **Verify login status**:
   ```bash
   npm whoami
   # Should print 'gitscape'
   ```
   *If not logged in, run `npm login` first.*

2. **Bump the package version**:
   Update the `"version"` field in `cli/package.json` (e.g., from `0.2.0` to `0.2.1`).

3. **Publish to npm**:
   ```bash
   cd cli
   npm publish --access public
   ```
   *Provide the 6-digit One-Time Password (OTP) from your authenticator app when prompted.*

---

## 📄 License
This project is licensed under the MIT License.

