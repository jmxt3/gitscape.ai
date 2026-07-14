import React, { useState } from "react";
import { CodeSnippet } from "./CodeSnippet";
import { CheckRow } from "./LandingSections";

/**
 * Developer tools section — CLI & MCP server showcase.
 * Web = try it now, CLI = adopt it in your repo, MCP = agent-native.
 */

const MCP_URL = "https://gitscape.ai/api/mcp";

// ─── IDE configuration map ────────────────────────────────────────────────────
// Each IDE uses a slightly different JSON key for a remote MCP URL.
// "url"       → Claude Desktop, Claude Code, Cursor, VS Code (Continue), IntelliJ, Zed
// "serverUrl" → Windsurf, Antigravity (Gemini IDE)

type IDEKey = "claude" | "cursor" | "windsurf" | "antigravity" | "vscode" | "intellij";

interface IDEConfig {
  label: string;
  urlKey: "url" | "serverUrl";
  configFile: string;
  configFileNote?: string;
}

const IDE_CONFIGS: Record<IDEKey, IDEConfig> = {
  claude: {
    label: "Claude",
    urlKey: "url",
    configFile: ".mcp.json",
    configFileNote: "Place in your project root (Claude Code) or ~/Library/Application Support/Claude/claude_desktop_config.json (Claude Desktop)",
  },
  cursor: {
    label: "Cursor",
    urlKey: "url",
    configFile: ".cursor/mcp.json",
    configFileNote: "Place in your project root",
  },
  windsurf: {
    label: "Windsurf",
    urlKey: "serverUrl",
    configFile: "~/.codeium/windsurf/mcp_config.json",
    configFileNote: "Global config — applies to all Windsurf projects",
  },
  antigravity: {
    label: "Antigravity",
    urlKey: "serverUrl",
    configFile: "~/.gemini/config/mcp_config.json",
    configFileNote: "Global config — applies to all Antigravity (Gemini IDE) projects",
  },
  vscode: {
    label: "VS Code",
    urlKey: "url",
    configFile: ".continue/config.json",
    configFileNote: "Requires the Continue extension. Place in your project root.",
  },
  intellij: {
    label: "IntelliJ",
    urlKey: "url",
    configFile: ".mcp.json",
    configFileNote: "Place in your project root. Requires IntelliJ AI Assistant with MCP support.",
  },
};

const IDE_ORDER: IDEKey[] = ["claude", "cursor", "windsurf", "antigravity", "vscode", "intellij"];

function buildMcpSnippet(ideKey: IDEKey): string {
  const { urlKey } = IDE_CONFIGS[ideKey];
  return JSON.stringify(
    {
      mcpServers: {
        gitscape: {
          [urlKey]: MCP_URL,
        },
      },
    },
    null,
    2
  );
}

// ─── Surface tabs ─────────────────────────────────────────────────────────────

type SurfaceKey = "cli" | "mcp" | "web";

const SURFACES: { key: SurfaceKey; label: string; activeColor: string; underline: string }[] = [
  { key: "cli", label: "CLI", activeColor: "#c4b5fd", underline: "#7c3aed" },
  { key: "mcp", label: "MCP", activeColor: "#6ee7b7", underline: "#10b981" },
  { key: "web", label: "Web", activeColor: "#fcd34d", underline: "#f59e0b" },
];

export const CliPanel: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-xl sm:text-2xl font-bold tracking-[-0.015em] text-slate-100">
          One command. No install, no signup.
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/25 shrink-0 ml-2">
          Pairs with npx skills
        </span>
      </div>
      <p className="m-0 text-[14.5px] leading-relaxed text-slate-400">
        Point the CLI at any GitHub repository to compile and install on-the-fly, or scan an existing pre-authored skill before it touches your project.
      </p>
      <div className="flex flex-col gap-3 mt-1">
        <CheckRow>Writes SKILL.md, manifest.json and references/ into <code className="font-mono text-[0.9em] text-slate-200">.agents/skills/&lt;owner-repo&gt;/</code></CheckRow>
        <CheckRow>Auto-registers the skill in your AGENTS.md and CLAUDE.md</CheckRow>
        <CheckRow><code className="font-mono text-[0.9em] text-slate-200">--token</code> for private repos · <code className="font-mono text-[0.9em] text-slate-200">--type framework</code> for engineering conventions</CheckRow>
        <CheckRow>Zero dependencies · Node 18+ · MIT</CheckRow>
      </div>
      <a
        href="https://www.npmjs.com/package/gitscape"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
      >
        npm install -g gitscape if you'd rather keep it around →
      </a>
    </div>
    <div className="flex flex-col gap-3">
      <CodeSnippet
        title="scan a skill before install"
        accent="violet"
        prompt
        code="npx gitscape scan https://github.com/google/adk-python"
      />
      <CodeSnippet
        title="compile & install a skill"
        accent="violet"
        prompt
        code="npx gitscape https://github.com/google/adk-python"
      />
      <CodeSnippet
        title="uninstall"
        accent="violet"
        prompt
        code="npx gitscape remove adk-python"
      />
    </div>
  </div>
);

export const McpPanel: React.FC = () => {
  const [activeIDE, setActiveIDE] = useState<IDEKey>("claude");
  const ide = IDE_CONFIGS[activeIDE];
  const snippet = buildMcpSnippet(activeIDE);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
      <div className="flex flex-col gap-4">
        <h3 className="m-0 text-xl sm:text-2xl font-bold tracking-[-0.015em] text-slate-100">
          Let your agent install skills for itself.
        </h3>
        <p className="m-0 text-[14.5px] leading-relaxed text-slate-400">
          GitScape ships a hosted MCP server. Connect once, and your agent can compile
          and install any repository as a skill — mid-conversation, no tab-switching.
        </p>
        <div className="flex flex-col gap-3 mt-1">
          <CheckRow>One MCP tool — <code className="font-mono text-[0.9em] text-slate-200">install_skill</code> — compiles, scans and writes the skill into your workspace</CheckRow>
          <CheckRow>Works in Claude, Cursor, Windsurf, Antigravity, VS Code and IntelliJ</CheckRow>
          <CheckRow>Every skill passes ScapeGuard before it touches your repo</CheckRow>
          <CheckRow>No API key needed — open to everyone</CheckRow>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <CodeSnippet
          title="1 · point your agent at GitScape"
          accent="emerald"
          prompt
          code="npx gitscape init"
        />

        {/* IDE selector */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              Your IDE
            </span>
            <select
              value={activeIDE}
              onChange={(e) => setActiveIDE(e.target.value as IDEKey)}
              className="text-[12px] font-semibold rounded-md px-2 py-1 transition-colors"
              style={{
                background: "rgba(30,41,59,0.9)",
                border: "1px solid rgba(71,85,105,0.6)",
                color: "#6ee7b7",
                outline: "none",
                cursor: "pointer",
              }}
              aria-label="Select your IDE"
            >
              {IDE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {IDE_CONFIGS[key].label}
                </option>
              ))}
            </select>
          </div>
          <CodeSnippet title={ide.configFile} accent="emerald" code={snippet} />
          {ide.configFileNote && (
            <p className="m-0 text-[11.5px] leading-relaxed text-slate-500 pl-1">
              {ide.configFileNote}
            </p>
          )}
        </div>

        <CodeSnippet
          title="2 · then just ask"
          accent="emerald"
          code="Compile and install https://github.com/google/adk-python as an agent skill"
        />
      </div>
    </div>
  );
};


const WebPanel: React.FC = () => (
  <div className="flex flex-col items-center gap-5 text-center py-4">
    <h3 className="m-0 text-xl sm:text-2xl font-bold tracking-[-0.015em] text-slate-100">
      Or stay right here.
    </h3>
    <p className="m-0 text-[14.5px] leading-relaxed text-slate-400 max-w-[560px]">
      Paste a GitHub URL above, watch the digest, map and skill compile in about a
      minute, and download the scanned .zip. Same pipeline, zero setup.
    </p>
    <a
      href="#digest-generator-input"
      className="btn-shimmer inline-flex items-center px-6 py-3 rounded-[10px] text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: "#f59e0b", color: "#0f172a" }}
    >
      Generate a skill now
    </a>
  </div>
);

interface DevToolsProps {
  onSelectTab?: (tab: "web" | "cli" | "mcp") => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ onSelectTab }) => {
  return (
    <section
      id="developer-tools"
      className="px-6 sm:px-10 py-16 sm:py-[72px]"
      style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col gap-12">
        {/* Header Block */}
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">DEVELOPER TOOLS</span>
          <h2 className="m-0 text-3xl sm:text-[38px] font-extrabold tracking-[-0.025em] text-slate-100">
            CLI &amp; MCP Server
          </h2>
          <p className="m-0 text-[15px] text-slate-400 max-w-[640px]">
            Bring GitScape directly into your local development environment. Run it in your terminal, or connect it as an agent-native server.
          </p>
        </div>

        {/* Side-by-side grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left Column: CLI */}
          <div
            className="rounded-2xl p-6 sm:p-8 flex flex-col gap-5"
            style={{
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(124,58,237,0.25)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">LOCAL COMPILER</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/25">
                Pairs with npx skills
              </span>
            </div>
            <h3 className="m-0 text-2xl font-bold tracking-[-0.015em] text-slate-100">
              GitScape CLI
            </h3>
            <p className="m-0 text-[14.5px] leading-relaxed text-slate-400">
              Compile skills straight from your terminal or scan pre-authored ones. Point the CLI at any repository (public or private) to check safety grades before installation and output the SKILL.md and manifest files.
            </p>
            <div className="flex flex-col gap-3 mt-1">
              <CheckRow>Zero install, runs via <code className="font-mono text-[0.85em] text-slate-200">npx gitscape</code></CheckRow>
              <CheckRow>Auto-registers skills in your rules registry files</CheckRow>
              <CheckRow>Scan-only mode — <code className="font-mono text-[0.85em] text-slate-200">gitscape scan</code> audits any skill pre-install</CheckRow>
              <CheckRow>Supports private repositories using your custom PAT token</CheckRow>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <CodeSnippet title="scan a skill before install" accent="violet" prompt code="npx gitscape scan https://github.com/owner/repo" />
              <CodeSnippet title="install a skill" accent="violet" prompt code="npx gitscape https://github.com/owner/repo" />
            </div>
            <div className="flex justify-start mt-1 pl-1">
              <button
                onClick={() => onSelectTab?.("cli")}
                className="text-[13px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer flex items-center gap-1 focus:outline-none"
              >
                Know More →
              </button>
            </div>
          </div>

          {/* Right Column: MCP */}
          <div
            className="rounded-2xl p-6 sm:p-8 flex flex-col gap-5"
            style={{
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(16,185,129,0.25)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <span className="text-[11px] font-bold tracking-[0.1em] text-emerald-400">AGENT-NATIVE</span>
            <h3 className="m-0 text-2xl font-bold tracking-[-0.015em] text-slate-100">
              Hosted MCP Server
            </h3>
            <p className="m-0 text-[14.5px] leading-relaxed text-slate-400">
              Let your agent manage its own skill dependencies. Integrate GitScape into Cursor, Windsurf, or Claude Desktop. Your agent can call `install_skill` to compile, audit, and install skills on-the-fly mid-conversation.
            </p>
            <div className="flex flex-col gap-3 mt-1">
              <CheckRow>Allows agents to download repositories on demand</CheckRow>
              <CheckRow>Supports Claude, Cursor, Windsurf, Antigravity, and VS Code</CheckRow>
              <CheckRow>Deterministic safety scanner checks code before writing</CheckRow>
              <CheckRow>No API keys required, open to everyone</CheckRow>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <CodeSnippet title="initialize mcp server" accent="emerald" prompt code="npx gitscape init" />
            </div>
            <div className="flex justify-start mt-1 pl-1">
              <button
                onClick={() => onSelectTab?.("mcp")}
                className="text-[13px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1 focus:outline-none"
              >
                Know More →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
