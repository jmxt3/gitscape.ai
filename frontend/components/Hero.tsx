import React from "react";
import { CodeSnippet } from "./CodeSnippet";

/**
 * Aurora hero — replaces the old centered h1/p block in App.tsx.
 * Static/presentational. Blobs + grid use existing classes from index.css.
 */
interface HeroProps {
  onSelectMcp?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSelectMcp }) => (
  <div className="px-6 text-center">
    <div className="relative flex flex-col items-center gap-5 max-w-6xl mx-auto">
      <div
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.08em]"
        style={{
          border: "1px solid rgba(139,92,246,0.35)",
          background: "rgba(139,92,246,0.08)",
          color: "#a78bfa",
        }}
      >
        FREE · OPEN SOURCE · NO SIGNUP
      </div>

      <h1 className="m-0 text-5xl sm:text-6xl lg:text-[62px] font-extrabold tracking-[-0.035em] leading-[1.04] text-slate-100 lg:whitespace-nowrap">
        The Trust Layer for{" "}
        <span className="text-gradient">Agent Skills.</span>
      </h1>

      <p className="m-0 text-lg sm:text-[19px] leading-relaxed text-slate-400 max-w-4xl">
        Scan any agent skill — authored or compiled — for prompt injection, secrets,
        and malicious execution before it touches your agent. Or compile the long tail on the fly.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
        <CodeSnippet compact prompt accent="violet" code="npx gitscape <repo-url>" />
        <a
          href="#digest-generator-input"
          onClick={(e) => {
            e.preventDefault();
            if (onSelectMcp) {
              onSelectMcp();
            }
            const element = document.getElementById("digest-generator-input");
            if (element) {
              const yOffset = -200;
              const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
          className="text-[12.5px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          also an MCP server →
        </a>
      </div>
    </div>
  </div>
);
