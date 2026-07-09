import React, { useEffect, useState } from "react";

/**
 * Aurora landing sections — How it works, Security, Open source.
 * Static/presentational marketing content shown on the home (no-results) state.
 */

const REPO_API_URL = "https://api.github.com/repos/jmxt3/Git-Scape-Web";
const REPO_URL = "https://github.com/jmxt3/Git-Scape-Web";

export const CheckRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    <div
      className="flex items-center justify-center shrink-0 rounded-md"
      style={{ width: 22, height: 22, background: "rgba(16,185,129,0.15)" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
    <span className="text-sm text-slate-300">{children}</span>
  </div>
);

const STEPS = [
  {
    n: 1,
    title: "Ingest",
    desc: "Sparse-clones the repo, filters noise, and distills every file into one structured digest.",
    border: "#7c3aed",
    color: "#a78bfa",
    titleColor: "#c4b5fd",
    glow: "0 0 20px rgba(124,58,237,0.35)",
  },
  {
    n: 2,
    title: "Map",
    desc: "Builds an interactive architecture diagram from the file tree — every branch, literally.",
    border: "#10b981",
    color: "#34d399",
    titleColor: "#6ee7b7",
    glow: "0 0 20px rgba(16,185,129,0.3)",
  },
  {
    n: 3,
    title: "Forge",
    desc: "Compiles digest + map into a scanned, packaged SKILL.md your agents load in one line.",
    border: "#f59e0b",
    color: "#fbbf24",
    titleColor: "#fcd34d",
    glow: "0 0 20px rgba(245,158,11,0.3)",
  },
];

export const HowItWorks: React.FC = () => (
  <section
    id="how-it-works"
    className="px-6 sm:px-10 py-16 sm:py-[72px]"
    style={{ borderTop: "1px solid rgba(71,85,105,0.25)", background: "rgba(15,23,42,0.35)" }}
  >
    <div className="max-w-[1100px] mx-auto flex flex-col gap-12">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">HOW IT WORKS</span>
        <h2 className="m-0 text-3xl sm:text-[38px] font-extrabold tracking-[-0.025em] text-slate-100">
          One URL in. Three artifacts out.
        </h2>
        <p className="m-0 text-[15px] text-slate-400">
          About a minute, start to finish. The progress bar only lies a little.
        </p>
      </div>
      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
        <div
          className="hidden sm:block absolute"
          style={{
            top: 24,
            left: "15%",
            right: "15%",
            height: 2,
            background: "linear-gradient(90deg,#7c3aed,#10b981,#f59e0b)",
            opacity: 0.45,
          }}
        />
        {STEPS.map((s) => (
          <div key={s.n} className="relative flex flex-col items-center gap-3.5 text-center">
            <div
              className="flex items-center justify-center rounded-full text-[15px] font-extrabold"
              style={{
                width: 48,
                height: 48,
                background: "#0f172a",
                border: `2px solid ${s.border}`,
                color: s.color,
                boxShadow: s.glow,
              }}
            >
              {s.n}
            </div>
            <div className="text-[17px] font-bold" style={{ color: s.titleColor }}>{s.title}</div>
            <div className="text-[13.5px] leading-relaxed text-slate-400 max-w-[280px]">{s.desc}</div>
          </div>
        ))}
      </div>
      <p className="m-0 text-center text-[13px] text-slate-500">
        The same pipeline runs behind the{" "}
        <a href="#developer-tools" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
          CLI and the MCP server
        </a>
        .
      </p>
    </div>
  </section>
);

const ScanRow: React.FC<{ label: string; value: string; tone?: "ok" | "warn" | "muted" }> = ({ label, value, tone = "muted" }) => {
  const color = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-slate-200";
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
};

export const Security: React.FC = () => (
  <section
    id="security"
    className="px-6 sm:px-10 py-16 sm:py-[72px]"
    style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
  >
    <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      <div className="flex flex-col gap-4.5">
        <span className="text-[11px] font-bold tracking-[0.1em] text-emerald-400">SECURITY · SCAPEGUARD</span>
        <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-100 leading-tight">
          Every skill is scanned by our own engine.
        </h2>
        <p className="m-0 text-[15px] leading-relaxed text-slate-400">
          A skill is code your agent trusts. So GitScape runs each one through <span className="text-slate-200 font-semibold">ScapeGuard</span> —
          our deterministic scanner with 45+ rules across 9 threat categories — before it ever
          leaves the page. Live credentials and remote-code-execution payloads never ship.
        </p>
        <div className="flex flex-col gap-3 mt-1">
          <CheckRow>Secrets &amp; credentials detected — AWS, GitHub, OpenAI, Stripe keys, private keys</CheckRow>
          <CheckRow>Prompt injection &amp; hidden-Unicode smuggling caught before it reaches your agent</CheckRow>
          <CheckRow>Malicious execution, exfiltration &amp; supply-chain risks flagged in scripts and docs</CheckRow>
          <CheckRow>Every finding mapped to the OWASP Agentic Skills &amp; LLM Top 10</CheckRow>
          <CheckRow>License detected and carried into the manifest</CheckRow>
          <CheckRow>Every download ships its own scan-report.json + SARIF audit</CheckRow>
          <CheckRow>Your GitHub token stays in your browser — never on our servers</CheckRow>
        </div>
      </div>
      <div
        className="rounded-[14px] overflow-hidden font-mono"
        style={{ background: "#0b1220", border: "1px solid rgba(71,85,105,0.5)" }}
      >
        <div
          className="flex items-center justify-between px-4.5 py-3"
          style={{ borderBottom: "1px solid rgba(71,85,105,0.4)", background: "rgba(15,23,42,0.8)" }}
        >
          <span className="text-xs text-slate-400">scan-report.json</span>
          <span
            className="text-[10px] font-bold px-2.5 py-[3px] rounded-full tracking-[0.06em]"
            style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}
          >
            PASS
          </span>
        </div>
        <div className="p-4.5 flex flex-col gap-2.5 text-[12.5px]">
          <ScanRow label="engine" value='"scapeguard/2.0.0"' />
          <ScanRow label="secrets" value="PASS" tone="ok" />
          <ScanRow label="prompt_injection" value="PASS" tone="ok" />
          <ScanRow label="malicious_execution" value="PASS" tone="ok" />
          <ScanRow label="supply_chain" value="PASS" tone="ok" />
          <ScanRow label="license" value='"MIT"' />
          <ScanRow label="files_scanned" value="14" />
          <ScanRow label="skill_hash" value="sha256:9f2c…e41a" tone="muted" />
        </div>
      </div>
    </div>
  </section>
);

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.22.7.83.57A12 12 0 0 0 12 .3z" />
  </svg>
);

interface RepoStats {
  stars: number | null;
  forks: number | null;
  license: string;
}

export const OpenSource: React.FC = () => {
  const [stats, setStats] = useState<RepoStats>({ stars: null, forks: null, license: "MIT" });

  useEffect(() => {
    let cancelled = false;
    fetch(REPO_API_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStats({
          stars: data.stargazers_count ?? null,
          forks: data.forks_count ?? null,
          license: data.license?.spdx_id || "MIT",
        });
      })
      .catch(() => { /* stats stay as placeholders */ });
    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString());

  return (
    <section
      id="open-source"
      className="px-6 sm:px-10 py-16 sm:py-[72px]"
      style={{ borderTop: "1px solid rgba(71,85,105,0.25)", background: "rgba(15,23,42,0.35)" }}
    >
      <div className="max-w-[800px] mx-auto flex flex-col items-center gap-6 text-center">
        <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">OPEN SOURCE</span>
        <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-slate-100">
          Built in the open. Steered by its users.
        </h2>
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-slate-100">{fmt(stats.stars)}</span>
            <span className="text-xs font-semibold tracking-[0.06em] text-slate-500">STARS</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-slate-100">{fmt(stats.forks)}</span>
            <span className="text-xs font-semibold tracking-[0.06em] text-slate-500">FORKS</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-slate-100">{stats.license}</span>
            <span className="text-xs font-semibold tracking-[0.06em] text-slate-500">LICENSE</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "#f1f5f9", color: "#0f172a" }}
          >
            <GithubIcon />
            Star on GitHub
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-6 py-3 rounded-[10px] text-sm font-bold text-violet-400 transition-colors duration-200 hover:text-violet-300"
            style={{ border: "1px solid rgba(139,92,246,0.4)" }}
          >
            Read the code
          </a>
        </div>
      </div>
    </section>
  );
};

const FAQ_ITEMS = [
  {
    q: "What is GitScape AI?",
    a: "GitScape AI is a free tool that converts any GitHub repository into AI-ready context — including a clean text code digest, an interactive file-tree diagram, and a structured SKILL.md file your AI agents can load and act on."
  },
  {
    q: "What is a Code Digest?",
    a: "A Code Digest is a clean, flat text representation of a GitHub repository's source code. It concatenates all relevant files into a single document optimized for LLM context windows, making it easy to feed any codebase into ChatGPT, Claude, Gemini, or any other AI model."
  },
  {
    q: "What is an Agent Skill?",
    a: "Agent Skill generates a SKILL.md file — a structured knowledge document that AI coding agents can load to instantly understand a repository's purpose, architecture, patterns, and conventions. It lets your AI agent act on the codebase without needing to re-read every file."
  },
  {
    q: "What is Code Visualization?",
    a: "Code Visualization renders an interactive, zoomable diagram of your repository's file and directory structure, making it easy to explore and understand the architecture of any codebase at a glance."
  },
  {
    q: "How do I use GitScape from the terminal?",
    a: "Run npx gitscape <repository_url> — no install or signup needed. The CLI compiles the repo, writes SKILL.md, manifest.json and references into .agents/skills/<owner-repo>/ in your project, and auto-registers the skill in your AGENTS.md and CLAUDE.md. Use --token for private repositories, and npx gitscape remove <name> to uninstall."
  },
  {
    q: "Does GitScape have an MCP server?",
    a: "Yes. Run npx gitscape init to create a .mcp.json pointing at the GitScape MCP server, or add https://gitscape-143600285956.us-central1.run.app/api/mcp to Claude Code, Cursor or Windsurf. Your agent can then call the install_skill tool to compile, scan and install any repository as a skill on its own."
  },
  {
    q: "Does GitScape AI support private repositories?",
    a: "Yes. You can add a GitHub Personal Access Token (PAT) via the token button in the top-right corner. This also raises your API rate limit from 60 to 5,000 requests per hour."
  },
  {
    q: "Is GitScape AI free to use?",
    a: "Yes, GitScape AI is completely free to use for public repositories. No account or sign-up is required."
  }
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section
      id="faq"
      className="px-6 sm:px-10 py-16 sm:py-[72px]"
      style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
    >
      <div className="max-w-[800px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">QUESTIONS &amp; ANSWERS</span>
          <h2 className="m-0 text-3xl sm:text-[38px] font-extrabold tracking-[-0.025em] text-slate-100">
            Frequently Asked Questions
          </h2>
          <p className="m-0 text-[15px] text-slate-400">
            Everything you need to know about GitScape.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  background: isOpen ? "rgba(15, 23, 42, 0.6)" : "rgba(15, 23, 42, 0.25)",
                  border: isOpen ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid rgba(71, 85, 105, 0.2)",
                  boxShadow: isOpen ? "0 4px 20px -2px rgba(139, 92, 246, 0.08)" : "none"
                }}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between text-left p-5 font-semibold text-slate-200 hover:text-slate-100 transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] sm:text-base">{item.q}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-slate-400 transition-transform duration-300 shrink-0 ml-4 ${
                      isOpen ? "rotate-180 text-violet-400" : ""
                    }`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? "500px" : "0px",
                    transition: "max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
                    opacity: isOpen ? 1 : 0,
                    overflow: "hidden"
                  }}
                >
                  <div className="px-5 pb-5 pt-0 text-[14px] sm:text-[14.5px] leading-relaxed text-slate-400 border-t border-slate-800/40">
                    <p className="m-0 mt-3">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

