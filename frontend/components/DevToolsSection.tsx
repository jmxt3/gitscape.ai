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
  { key: "cli", label: "Terminal", activeColor: "#c4b5fd", underline: "#7c3aed" },
  { key: "mcp", label: "Your agent", activeColor: "#6ee7b7", underline: "#10b981" },
  { key: "web", label: "Web", activeColor: "#fcd34d", underline: "#f59e0b" },
];

export const CliPanel: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
    <div className="flex flex-col gap-4">
      <h3 className="m-0 text-xl sm:text-2xl font-bold tracking-[-0.015em] text-slate-100">
        One command. No install, no signup.
      </h3>
      <p className="m-0 text-[14.5px] leading-relaxed text-slate-400">
        Point the CLI at any GitHub repository and it compiles the skill server-side,
        then writes the files straight into your project — ready for your agent's next run.
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
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

export const DevTools: React.FC = () => {
  const [active, setActive] = useState<SurfaceKey>("cli");

  return (
    <section
      id="developer-tools"
      className="px-6 sm:px-10 py-16 sm:py-[72px]"
      style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">CLI · MCP SERVER</span>
          <h2 className="m-0 text-3xl sm:text-[38px] font-extrabold tracking-[-0.025em] text-slate-100">
            Take GitScape into your workflow.
          </h2>
          <p className="m-0 text-[15px] text-slate-400 max-w-[640px]">
            The web app is the demo. The CLI and MCP server are how you ship — compile any
            repo into a skill from your terminal, or let your agent do it for you.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 sm:p-7 flex flex-col gap-6"
          style={{
            background: "rgba(15,23,42,0.75)",
            border: "1px solid rgba(71,85,105,0.5)",
            boxShadow: "0 12px 48px -12px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="flex gap-1 overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(71,85,105,0.4)" }}
            role="tablist"
            aria-label="Ways to use GitScape"
          >
            {SURFACES.map((tab) => {
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(tab.key)}
                  className={`px-4.5 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-200 ${
                    isActive ? "font-bold" : "font-semibold text-slate-400 hover:text-slate-200"
                  }`}
                  style={
                    isActive
                      ? { color: tab.activeColor, borderBottom: `2px solid ${tab.underline}`, marginBottom: -1 }
                      : { borderBottom: "2px solid transparent", marginBottom: -1 }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel">
            {active === "cli" && <CliPanel />}
            {active === "mcp" && <McpPanel />}
            {active === "web" && <WebPanel />}
          </div>
        </div>
      </div>
    </section>
  );
};
