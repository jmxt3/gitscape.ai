import React, { useEffect, useState } from "react";

/**
 * Aurora landing sections — How it works, Security, Open source.
 * Static/presentational marketing content shown on the home (no-results) state.
 */

const REPO_API_URL = "https://api.github.com/repos/jmxt3/gitscape.ai";
const REPO_URL = "https://github.com/jmxt3/gitscape.ai";

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
    title: "Scan",
    desc: "ScapeGuard audits the codebase for secrets, prompt injection, and exfiltration.",
    border: "#10b981",
    color: "#34d399",
    titleColor: "#6ee7b7",
    glow: "0 0 20px rgba(16,185,129,0.3)",
  },
  {
    n: 3,
    title: "Forge",
    desc: "Packages the audited code digest and rules into a structured SKILL.md skill.",
    border: "#f59e0b",
    color: "#fbbf24",
    titleColor: "#fcd34d",
    glow: "0 0 20px rgba(245,158,11,0.3)",
  },
];

export const SearchOrCompileExplainer: React.FC = () => (
  <div className="mt-14 p-6 sm:p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 max-w-4xl mx-auto">
    <div className="flex flex-col items-center gap-2 text-center mb-8">
      <span className="text-[10px] font-bold tracking-[0.1em] text-violet-400 uppercase">Search-or-Compile Wedge</span>
      <h3 className="m-0 text-xl sm:text-2xl font-extrabold text-slate-100">
        How GitScape Secures the Skill Ecosystem
      </h3>
      <p className="m-0 text-xs sm:text-sm text-slate-400 max-w-lg">
        Whether a repository has an owner-authored skill or not, ScapeGuard is the constant safety gate.
      </p>
    </div>

    {/* Diagram Flow container */}
    <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 relative">
      {/* Step 1: Input */}
      <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-950/85 border border-slate-850 text-center flex-1 z-10">
        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 border border-violet-500/20 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </div>
        <span className="text-[13px] font-bold text-slate-200">GitHub Repository</span>
        <span className="text-[11px] text-slate-500 mt-1">Target repo URL input</span>
      </div>

      {/* Connection arrow 1 */}
      <div className="hidden md:flex flex-col justify-center items-center text-slate-700 select-none">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      {/* Branches Container */}
      <div className="flex flex-col gap-4.5 flex-[2]">
        {/* Branch A: Pre-Authored */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 p-4 rounded-xl bg-emerald-950/10 border border-emerald-500/20 text-center sm:text-left">
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-extrabold text-xs shrink-0">A</div>
          <div>
            <span className="text-[12.5px] font-bold text-emerald-300 block">Owner-Authored Skill Found</span>
            <span className="text-[11.5px] text-slate-400 block mt-0.5">Detects <code>skills/**/SKILL.md</code>. Skips compilation to respect owner's conventions.</span>
          </div>
        </div>

        {/* Branch B: Un-authored */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 p-4 rounded-xl bg-violet-950/10 border border-violet-500/20 text-center sm:text-left">
          <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center text-violet-400 font-extrabold text-xs shrink-0">B</div>
          <div>
            <span className="text-[12.5px] font-bold text-violet-300 block">No Pre-Authored Skill Found</span>
            <span className="text-[11.5px] text-slate-400 block mt-0.5">GitScape Compiler automatically ingests codebase & builds custom conventions.</span>
          </div>
        </div>
      </div>

      {/* Connection arrow 2 */}
      <div className="hidden md:flex flex-col justify-center items-center text-slate-700 select-none">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      {/* Unified Security Check */}
      <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/35 text-center flex-1 z-10">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/30 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <span className="text-[13px] font-bold text-emerald-300">ScapeGuard Scan</span>
        <span className="text-[11px] text-slate-400 mt-1">Deterministic AST, Secrets &amp; OSV audit</span>
      </div>
    </div>
  </div>
);

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
          One URL in. A secure agent skill out.
        </h2>
        <p className="m-0 text-[15px] text-slate-400">
          Three automated steps to compile, verify, and package any repository into a ready-to-use coding agent skill.
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

      <SearchOrCompileExplainer />

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

const GRADE_TONES: Record<string, { chip: string; text: string; border: string }> = {
  emerald: { chip: "rgba(16,185,129,0.15)", text: "#34d399", border: "rgba(16,185,129,0.45)" },
  lime: { chip: "rgba(132,204,22,0.15)", text: "#a3e635", border: "rgba(132,204,22,0.45)" },
  amber: { chip: "rgba(245,158,11,0.15)", text: "#fbbf24", border: "rgba(245,158,11,0.45)" },
  red: { chip: "rgba(239,68,68,0.15)", text: "#f87171", border: "rgba(239,68,68,0.45)" },
};

const GradeKey: React.FC<{ letter: string; tone: keyof typeof GRADE_TONES; label: string }> = ({ letter, tone, label }) => {
  const t = GRADE_TONES[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded border text-[11px] font-bold font-mono"
        style={{ background: t.chip, color: t.text, borderColor: t.border }}
      >
        {letter}
      </span>
      <span className="text-slate-400">{label}</span>
    </span>
  );
};

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
          Every skill is scanned by <span className="text-emerald-400">ScapeGuard</span>.
        </h2>
        <p className="m-0 text-[15px] leading-relaxed text-slate-400">
          A skill is code your agent trusts. Whether a skill is pre-authored by the repository maintainer or compiled on-the-fly by GitScape, ScapeGuard deterministic-scans it across 55+ rules and 9 threat categories, assigning a verifiable <span className="text-slate-200 font-semibold">A–F grade</span> before it touches your project.
        </p>
        {/* Grade legend — teaches the A–F scale at a glance */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 text-[12px]">
          <GradeKey letter="A" tone="emerald" label="clean" />
          <GradeKey letter="B" tone="lime" label="minor" />
          <GradeKey letter="C" tone="amber" label="review advised" />
          <GradeKey letter="F" tone="red" label="blocked" />
        </div>
        <div className="flex flex-col gap-3 mt-2">
          <CheckRow>Secrets, prompt injection, and malicious code caught before they reach your agent</CheckRow>
          <CheckRow>Every finding mapped to the OWASP Agentic Skills &amp; LLM Top 10</CheckRow>
          <CheckRow>Each download ships its own scan-report.json and SARIF audit</CheckRow>
          <CheckRow>Live credentials and remote-code-execution payloads are blocked from export</CheckRow>
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
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold px-2 py-[2px] rounded border tracking-[0.04em]"
              style={{ background: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.4)", color: "#34d399" }}
            >
              A
            </span>
            <span
              className="text-[10px] font-bold px-2.5 py-[3px] rounded-full tracking-[0.06em]"
              style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}
            >
              PASS
            </span>
          </div>
        </div>
        <div className="p-4.5 flex flex-col gap-2.5 text-[12.5px]">
          <ScanRow label="engine" value='"scapeguard/2.1.0"' />
          <ScanRow label="grade" value='"A"' tone="ok" />
          <ScanRow label="risk_score" value="0" tone="ok" />
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
    q: "How does GitScape interoperate with Vercel's npx skills?",
    a: "GitScape's compiled skills are 100% compatible with the Vercel Labs npx skills format. They write to the same .agents/skills/ location and list name/description frontmatter correctly. GitScape acts as the compiler and trust gate: while npx skills installs maintainer-authored skills, GitScape lets you scan those skills before installation and compiles any missing repository on the fly."
  },
  {
    q: "What is the Search-or-Compile workflow?",
    a: "Search-or-Compile is GitScape's workflow to respect pre-authored repository conventions. When you target a repository, GitScape first searches for an existing owner-authored SKILL.md. If one exists, we run ScapeGuard security audits on it directly. If none exists, we automatically compile a new skill from the repository source code and audit that output. Either way, ScapeGuard assigns a safety grade before installation."
  },
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
    q: "Is the generated skill safe to install?",
    a: "Yes. Every skill is scanned by ScapeGuard — our deterministic scanner — before it can leave the page. It checks 9 threat categories, including prompt injection, hardcoded secrets, and remote-code execution, all mapped to the OWASP Agentic Skills & LLM Top 10. Live credentials and RCE payloads are hard-blocked and can never be exported."
  },
  {
    q: "What does the A–F security grade mean?",
    a: "Each scan gives the skill a letter grade from a 0–100 risk score: A is clean, B is minor, C means review advised, and F is blocked from export. The grade is shown on the page and saved in manifest.json, and every download ships its own scan-report.json and SARIF audit."
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
    a: "Yes. Run npx gitscape init to create a .mcp.json pointing at the GitScape MCP server, or add https://gitscape.ai/api/mcp to Claude Code, Cursor or Windsurf. Your agent can then call the install_skill tool to compile, scan and install any repository as a skill on its own."
  },
  {
    q: "How do I update an installed skill?",
    a: "Just run the same install command again — there is no separate update command. For example: npx gitscape https://github.com/google/adk-python. The CLI (and MCP tool) automatically removes the previous skill directory before writing the fresh files, so renamed or deleted references never accumulate. Your AGENTS.md registration is left untouched. Via MCP, simply tell your agent to re-install the skill with the same repository URL."
  },
  {
    q: "How do I uninstall a skill?",
    a: "Run npx gitscape remove <skill_name> from your terminal — it deletes .agents/skills/<name>/ and removes the skill reference from AGENTS.md and CLAUDE.md. Via MCP, tell your agent: 'Uninstall the <skill_name> skill' and it will call the uninstall_skill tool, which returns the exact paths to delete."
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

export const FeatureComparison: React.FC = () => (
  <section
    id="comparison"
    className="px-6 sm:px-10 py-16 sm:py-[72px]"
    style={{ borderTop: "1px solid rgba(71,85,105,0.25)" }}
  >
    <div className="max-w-[900px] mx-auto flex flex-col gap-10">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-[11px] font-bold tracking-[0.1em] text-violet-400">SIDE-BY-SIDE</span>
        <h2 className="m-0 text-3xl sm:text-[38px] font-extrabold tracking-[-0.025em] text-slate-100">
          GitScape vs. npx skills
        </h2>
        <p className="m-0 text-[15px] text-slate-400">
          Why GitScape is the safety gate and long-tail engine for your agent skills.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 font-semibold text-slate-300">
              <th className="p-4 sm:p-5">Capability</th>
              <th className="p-4 sm:p-5 text-slate-400">npx skills (Vercel Labs)</th>
              <th className="p-4 sm:p-5 text-violet-300 font-bold">GitScape</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-400">
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">Authored Skill Support</td>
              <td className="p-4 sm:p-5">✓ Symlinks pre-existing SKILL.md</td>
              <td className="p-4 sm:p-5 text-slate-100 font-semibold">✓ Detects, scans, and installs pre-existing files</td>
            </tr>
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">Long-tail Compilation</td>
              <td className="p-4 sm:p-5">✗ No (creates blank templates only)</td>
              <td className="p-4 sm:p-5 text-slate-100 font-semibold">✓ Generates custom skills for any repository on the fly</td>
            </tr>
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">Deterministic Security Scan</td>
              <td className="p-4 sm:p-5">✗ No (manual read warning only)</td>
              <td className="p-4 sm:p-5 text-emerald-400 font-bold">✓ ScapeGuard checks 55+ rules / 9 categories</td>
            </tr>
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">AST Behavioral Check</td>
              <td className="p-4 sm:p-5">✗ No</td>
              <td className="p-4 sm:p-5 text-slate-100 font-semibold">✓ tree-sitter AST audits on fenced code blocks</td>
            </tr>
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">Dependency Auditing</td>
              <td className="p-4 sm:p-5">✗ No</td>
              <td className="p-4 sm:p-5 text-slate-100 font-semibold">✓ Live OSV.dev database vulnerability checks</td>
            </tr>
            <tr>
              <td className="p-4 sm:p-5 font-semibold text-slate-200">Verifiable Provenance</td>
              <td className="p-4 sm:p-5">✗ No</td>
              <td className="p-4 sm:p-5 text-slate-100 font-semibold">✓ Complete <code>manifest.json</code> with digests and hashes</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

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
                    className={`text-slate-400 transition-transform duration-300 shrink-0 ml-4 ${isOpen ? "rotate-180 text-violet-400" : ""
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

