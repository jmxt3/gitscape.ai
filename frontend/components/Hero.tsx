import React from "react";

/**
 * Aurora hero — replaces the old centered h1/p block in App.tsx.
 * Static/presentational. Blobs + grid use existing classes from index.css.
 */
export const Hero: React.FC = () => (
  <div className="px-6 pt-20 pb-4 text-center">
    <div className="relative flex flex-col items-center gap-5 max-w-6xl mx-auto">
      <div
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.08em]"
        style={{
          border: "1px solid rgba(139,92,246,0.35)",
          background: "rgba(139,92,246,0.08)",
          color: "#a78bfa",
        }}
      >
        OPEN SOURCE · MIT · NO SIGNUP
      </div>

      <h1 className="m-0 text-5xl sm:text-6xl lg:text-[62px] font-extrabold tracking-[-0.035em] leading-[1.04] text-slate-100 lg:whitespace-nowrap">
        Turn any repo into an{" "}
        <span className="text-gradient">AI Skill.</span>
      </h1>

      <p className="m-0 text-lg sm:text-[19px] leading-relaxed text-slate-400 max-w-4xl">
        Paste a GitHub URL. GitScape reads the codebase, maps its
        architecture, and forges a ready-to-load{" "}
        <code className="font-mono text-[0.85em] text-violet-300">
          SKILL.md
        </code>{" "}
        — so your agents act like they wrote it.
      </p>

      <a
        href="#security"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors duration-200 hover:-translate-y-0.5"
        style={{
          border: "1px solid rgba(16,185,129,0.35)",
          background: "rgba(16,185,129,0.08)",
          color: "#34d399",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        Every skill scanned by ScapeGuard
      </a>
    </div>
  </div>
);
