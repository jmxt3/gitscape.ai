// Author: Joao Machete
// Description: Shared visual language for the Public Skill Registry and per-repo
// security report pages — grade/severity/status palettes, the engraved grade seal,
// deterministic repo marks, and small chip components. Aurora registry design.
import React, { useEffect, useRef } from "react";

export interface GradeInfo {
  hex: string;
  label: string;
}

export const GRADE: Record<string, GradeInfo> = {
  A: { hex: "#10b981", label: "Excellent" },
  B: { hex: "#84cc16", label: "Good" },
  C: { hex: "#f59e0b", label: "Moderate" },
  F: { hex: "#ef4444", label: "High Risk" },
};

export const gradeInfo = (g?: string): GradeInfo =>
  GRADE[(g || "").toUpperCase()] ?? { hex: "#64748b", label: "Unknown" };

export const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export const sevColor = (s?: string): string =>
  ({
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#f59e0b",
    LOW: "#64748b",
    INFO: "#3b82f6",
  }[(s || "").toUpperCase()] ?? "#64748b");

export const statusColor = (st?: string): string =>
  ({ PASS: "#10b981", WARN: "#f59e0b", FAIL: "#ef4444" }[(st || "").toUpperCase()] ?? "#64748b");

export const CAT_LABEL: Record<string, string> = {
  secrets: "secrets",
  prompt_injection: "prompt injection",
  malicious_execution: "malicious execution",
  supply_chain: "supply chain",
  excessive_agency: "excessive agency",
};

export const DEFAULT_CATEGORIES = [
  "secrets",
  "prompt_injection",
  "malicious_execution",
  "supply_chain",
  "excessive_agency",
];

export const fmtK = (n: number): string =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

const hashStr = (s: string): number => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Glass panel treatment shared across both registry pages.
export const glassStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(71,85,105,0.2)",
};

export const codeSurfaceStyle: React.CSSProperties = {
  background: "rgba(8,13,20,0.8)",
  border: "1px solid rgba(71,85,105,0.2)",
};

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <span className={`font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-500 ${className}`}>
    {children}
  </span>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div>
    <h3 className="text-[13.5px] font-bold text-slate-200 flex items-center gap-2 m-0">
      <span
        style={{
          display: "inline-block",
          width: 3,
          height: 15,
          borderRadius: 2,
          background: "linear-gradient(#7c3aed, #22d3ee)",
          flexShrink: 0,
        }}
      />
      {children}
    </h3>
    {sub && <p className="text-[11.5px] text-slate-500 mt-1 mb-0">{sub}</p>}
  </div>
);

// Deterministic faceted seal tile — the repo's "icon" in grids and ledgers.
export const RepoMark: React.FC<{ owner: string; repo: string; grade?: string; size?: number }> = ({
  owner,
  repo,
  grade,
  size = 44,
}) => {
  const h = hashStr(`${owner}/${repo}`);
  const rot = h % 30;
  const rot2 = (h >> 4) % 45;
  const ini = ((owner[0] || "?") + (repo[0] || "?")).toUpperCase();
  const gc = gradeInfo(grade).hex;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label={`${owner}/${repo} mark`} style={{ flexShrink: 0 }}>
      <rect width="44" height="44" rx="9" fill="rgba(30,41,59,0.9)" />
      <g opacity=".5">
        <polygon
          points="22,4 40,22 22,40 4,22"
          fill="none"
          stroke={gc}
          strokeOpacity=".45"
          strokeWidth="1"
          transform={`rotate(${rot} 22 22)`}
        />
        <polygon
          points="22,9 35,22 22,35 9,22"
          fill={gc}
          fillOpacity=".08"
          stroke={gc}
          strokeOpacity=".3"
          strokeWidth="1"
          transform={`rotate(${rot2} 22 22)`}
        />
      </g>
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="700"
        fill="#e2e8f0"
        letterSpacing="0.5"
      >
        {ini}
      </text>
    </svg>
  );
};

// Engraved grade seal with tick ring; the large variant animates its arc on mount.
export const GradeSeal: React.FC<{ grade: string; size?: number; animate?: boolean }> = ({
  grade,
  size = 40,
  animate = false,
}) => {
  const arcRef = useRef<SVGCircleElement>(null);
  const G = gradeInfo(grade);
  const R = size / 2;
  const ringR = R - 4;
  const tickR1 = R - 1;
  const tickR0 = R - 3.2;
  const tickN = size >= 100 ? 48 : 24;
  const scoreMap: Record<string, number> = { A: 0.97, B: 0.75, C: 0.52, F: 0.18 };
  const circ = 2 * Math.PI * ringR;
  const off = circ * (1 - (scoreMap[grade] ?? 0));
  const fs = Math.round(size * 0.33);

  useEffect(() => {
    if (!animate || !arcRef.current) return;
    const el = arcRef.current;
    el.style.transition = "none";
    el.style.strokeDashoffset = String(circ);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
        el.style.strokeDashoffset = String(off);
      });
    });
  }, [animate, grade, circ, off]);

  const ticks = [];
  for (let i = 0; i < tickN; i++) {
    const a = (i / tickN) * Math.PI * 2;
    ticks.push(
      <line
        key={i}
        x1={R + Math.cos(a) * tickR0}
        y1={R + Math.sin(a) * tickR0}
        x2={R + Math.cos(a) * tickR1}
        y2={R + Math.sin(a) * tickR1}
        stroke={G.hex}
        strokeOpacity=".5"
        strokeWidth="1"
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Grade ${grade}`} style={{ flexShrink: 0 }}>
      {animate && (
        <defs>
          <filter id="seal-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {ticks}
      <circle cx={R} cy={R} r={ringR} fill="none" stroke="rgba(71,85,105,.25)" strokeWidth="3" />
      <circle
        ref={arcRef}
        cx={R}
        cy={R}
        r={ringR}
        fill="none"
        stroke={G.hex}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={animate ? circ : off}
        transform={`rotate(-90 ${R} ${R})`}
        filter={animate ? "url(#seal-glow)" : undefined}
      />
      <circle cx={R} cy={R} r={ringR - 7} fill={G.hex} fillOpacity=".07" />
      <text
        x={R}
        y={R + fs * 0.36}
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={fs}
        fontWeight="800"
        fill={G.hex}
      >
        {grade}
      </text>
    </svg>
  );
};

export const GradeChip: React.FC<{ grade: string }> = ({ grade }) => {
  const G = gradeInfo(grade);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[0.08em] rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{ color: G.hex, border: `1px solid ${G.hex}55`, background: `${G.hex}14` }}
    >
      {grade} · {G.label.toUpperCase()}
    </span>
  );
};

export const StatusChip: React.FC<{ status: string; size?: number }> = ({ status, size = 10.5 }) => {
  const c = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono font-bold tracking-[0.12em] rounded-full px-3 py-1"
      style={{ color: c, border: `1px solid ${c}`, fontSize: size }}
    >
      <i style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />
      {(status || "").toUpperCase()}
    </span>
  );
};

export const SevPill: React.FC<{ severity: string }> = ({ severity }) => {
  const c = sevColor(severity);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-[0.1em] rounded px-1.5 py-0.5 whitespace-nowrap"
      style={{ color: c, border: `1px solid ${c}` }}
    >
      <i style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />
      {(severity || "").toUpperCase()}
    </span>
  );
};

// Copy-to-clipboard button with transient confirmation, used across both pages.
export const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — leave button state unchanged */
    }
  };
  return (
    <button
      onClick={copy}
      className={`flex-shrink-0 font-mono text-[10px] font-bold tracking-[0.08em] rounded px-2.5 py-1.5 transition-colors ${className}`}
      style={
        copied
          ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.45)", color: "#34d399" }
          : { background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.4)", color: "#67e8f9" }
      }
    >
      {copied ? "✓ COPIED" : "COPY"}
    </button>
  );
};
