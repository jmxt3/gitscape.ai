import React, { useState } from "react";
import { CodeSnippet } from "./CodeSnippet";
import { CheckRow } from "./LandingSections";

/**
 * Developer tools section — CLI & MCP server showcase.
 * Web = try it now, CLI = adopt it in your repo, MCP = agent-native.
 */

const MCP_URL = "https://gitscape-143600285956.us-central1.run.app/api/mcp";

const MCP_JSON = `{
  "mcpServers": {
    "gitscape": {
      "url": "${MCP_URL}"
    }
  }
}`;

type SurfaceKey = "cli" | "mcp" | "web";

const SURFACES: { key: SurfaceKey; label: string; activeColor: string; underline: string }[] = [
  { key: "cli", label: "Terminal", activeColor: "#c4b5fd", underline: "#7c3aed" },
  { key: "mcp", label: "Your agent", activeColor: "#6ee7b7", underline: "#10b981" },
  { key: "web", label: "Web", activeColor: "#fcd34d", underline: "#f59e0b" },
];

const CliPanel: React.FC = () => (
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
        code="npx gitscape https://github.com/upstash/context7"
      />
      <CodeSnippet
        title="uninstall"
        accent="violet"
        prompt
        code="npx gitscape remove upstash-context7"
      />
    </div>
  </div>
);

const McpPanel: React.FC = () => (
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
        <CheckRow>Works in Claude Code, Cursor, Windsurf and Claude Desktop</CheckRow>
        <CheckRow>Every skill passes ScapeGuard before it touches your repo</CheckRow>
      </div>
    </div>
    <div className="flex flex-col gap-3">
      <CodeSnippet
        title="1 · point your agent at GitScape"
        accent="emerald"
        prompt
        code="npx gitscape init"
      />
      <CodeSnippet title=".mcp.json" accent="emerald" code={MCP_JSON} />
      <CodeSnippet
        title="2 · then just ask"
        accent="emerald"
        code="Compile and install https://github.com/upstash/context7 as an agent skill"
      />
    </div>
  </div>
);

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
