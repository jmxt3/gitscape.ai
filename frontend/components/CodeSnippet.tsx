import React, { useCallback, useState } from "react";

/**
 * CodeSnippet — copy-to-clipboard code block matching the Security section's
 * scan-report.json panel styling. Two variants: a full panel with an optional
 * header bar, and a `compact` single-row pill for inline CTAs.
 */

type Accent = "violet" | "emerald" | "amber";

const ACCENTS: Record<Accent, { border: string; text: string; bg: string }> = {
  violet: { border: "rgba(139,92,246,0.35)", text: "#c4b5fd", bg: "rgba(139,92,246,0.08)" },
  emerald: { border: "rgba(16,185,129,0.35)", text: "#6ee7b7", bg: "rgba(16,185,129,0.08)" },
  amber: { border: "rgba(245,158,11,0.35)", text: "#fcd34d", bg: "rgba(245,158,11,0.08)" },
};

interface CodeSnippetProps {
  /** Exact text written to the clipboard. */
  code: string;
  /** Optional header-bar label, e.g. ".mcp.json" or "terminal". */
  title?: string;
  /** Border tint + accent color. Defaults to neutral slate. */
  accent?: Accent;
  /** Render a non-copyable "$ " prefix for shell commands. */
  prompt?: boolean;
  /** Single-row pill variant for inline use (Hero, SkillExport upsell). */
  compact?: boolean;
  /** Optional syntax-tinted display override; falls back to plain {code}. */
  children?: React.ReactNode;
}

const CopyButton: React.FC<{ code: string; accent?: Accent }> = ({ code, accent }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* clipboard unavailable */ }
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      title={copied ? "Copied" : "Copy to clipboard"}
      className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors duration-150"
      style={copied
        ? { color: "#34d399", background: "rgba(16,185,129,0.12)" }
        : { color: accent ? ACCENTS[accent].text : "#94a3b8", background: "transparent" }}
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
};

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
  code,
  title,
  accent,
  prompt = false,
  compact = false,
  children,
}) => {
  const borderColor = accent ? ACCENTS[accent].border : "rgba(71,85,105,0.5)";

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-2 max-w-full rounded-lg pl-3 pr-1 py-1.5 font-mono text-[12.5px]"
        style={{ background: "#0b1220", border: `1px solid ${borderColor}` }}
      >
        <span className="overflow-x-auto whitespace-nowrap text-slate-200">
          {prompt && <span className="text-slate-500 select-none">$ </span>}
          {children ?? code}
        </span>
        <CopyButton code={code} accent={accent} />
      </div>
    );
  }

  return (
    <div
      className="rounded-[14px] overflow-hidden font-mono"
      style={{ background: "#0b1220", border: `1px solid ${borderColor}` }}
    >
      {title != null && (
        <div
          className="flex items-center justify-between gap-2 pl-4.5 pr-2 py-2"
          style={{ borderBottom: "1px solid rgba(71,85,105,0.4)", background: "rgba(15,23,42,0.8)" }}
        >
          <span className="text-xs text-slate-400">{title}</span>
          <CopyButton code={code} accent={accent} />
        </div>
      )}
      <div className="relative flex items-start gap-2 p-4.5">
        <pre className="flex-1 m-0 overflow-x-auto text-[12.5px] leading-relaxed text-slate-200">
          {prompt && <span className="text-slate-500 select-none">$ </span>}
          {children ?? code}
        </pre>
        {title == null && <CopyButton code={code} accent={accent} />}
      </div>
    </div>
  );
};
