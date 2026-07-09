# GitScape CLI

**Compile any GitHub repository into a local Agent Skill in one command.**

The GitScape CLI is a zero-dependency, lightweight Node.js utility that connects to the GitScape API, runs code analysis (via tree-sitter) and security scans (via ScapeGuard), downloads the compiled Agent Skill files, and integrates them directly into your project's workspace.

---

## 🚀 Installation

### 1. On-Demand (Recommended)
You do not need to install the CLI to use it. Run it instantly using `npx`:
```bash
npx gitscape <command> [options]
```

### 2. Global Installation
If you use the command frequently, install it globally on your machine:
```bash
npm install -g gitscape
```

### 3. Local Development Link
If you are contributing to this codebase, link the CLI locally:
```bash
cd cli
npm link
```
This maps the global `gitscape` terminal command directly to your local workspace code.

---

## 💻 Commands

### 1. Initialize Workspace
```bash
npx gitscape init [options]
```
Creates a local `.mcp.json` file inside your current working directory to register the GitScape Model Context Protocol (MCP) server. 

**Options:**
* `--server <url>`: Specify a custom server (e.g., `npx gitscape init --server http://localhost:8081` during local backend development).

---

### 2. Compile and Install a Skill
```bash
npx gitscape <repository_url> [options]
```
Clones the repository, runs safety checks, generates the `SKILL.md` + `references/` files, writes them to `.agents/skills/<repo-name>/`, and registers the skill in `AGENTS.md` (and `CLAUDE.md`) idempotently.

**Example:**
```bash
npx gitscape https://github.com/upstash/context7
```

**Options:**
* `--token <pat>`: GitHub Personal Access Token (required to parse private repositories).
* `--type <type>`: Skill type: `code` or `framework` (default: `code`).
* `--server <url>`: Point to a custom backend compiler instance instead of the production API.

---

### 3. Remove/Uninstall a Skill
```bash
npx gitscape remove <skill_name_or_url>
# OR
npx gitscape uninstall <skill_name_or_url>
```
Surgically deletes the skill folder under `.agents/skills/<name>/` and cleans up all registration lines inside your workspace files (`AGENTS.md`, `CLAUDE.md`, `.gemini/config/AGENTS.md`).

**Example:**
```bash
npx gitscape remove upstash-context7
```

---

## 🔄 Updating the CLI

### For `npx` users (On-demand)
`npx` caches command downloads. To bypass the cache and run the absolute latest version:
```bash
npx gitscape@latest <command>
```
To clear your `npx` cache entirely:
```bash
npm cache clean --force
```

### For global installations
```bash
npm install -g gitscape@latest
```

---

## 🧑‍💻 Maintainer: Publishing Updates

To publish updates to the npm registry:

1. **Verify your login**:
   ```bash
   npm whoami
   # Should print 'gitscape'
   ```
   *If not logged in, run `npm login` first.*

2. **Bump the version**:
   Open `cli/package.json` and update the `"version"` field (e.g., from `0.2.0` to `0.2.1`).

3. **Publish to npm**:
   ```bash
   cd cli
   npm publish --access public
   ```
   *Provide the 6-digit One-Time Password (OTP) from your authenticator app when prompted.*
