// Author: Joao Machete
// Description: Public Agent Skill Registry index page — Aurora design. A full-page
// certification-ledger layout: hero with registry pulse stats, grade filters,
// grid/list toggle, and seal cards that navigate to per-repo security reports.
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  gradeInfo,
  statusColor,
  fmtK,
  glassStyle,
  Eyebrow,
  RepoMark,
  GradeSeal,
  GradeChip,
} from "./registryTheme";

interface RegistrySkill {
  repo_url: string;
  name: string;
  owner: string;
  repo: string;
  description: string;
  primary_languages: string[];
  files_analyzed: number;
  grade: string;
  status: string;
  risk_score: number;
  findings_count: number;
  freshness?: string;
  scanned_at?: string;
  stars?: number;
  // NVIDIA taxonomy (optional — present only for NVIDIA-sourced skills)
  nvidia_domain?: string[];
  nvidia_audience?: string[];
  nvidia_skill_name?: string;
  nvidia_skill_url?: string;
  nvidia_subdomain?: string;
  source?: "nvidia" | "community" | "static";
}

type GradeFilter = "ALL" | "A" | "B" | "C" | "F";
type SortKey = "risk" | "stars" | "name" | "scanned";
type Layout = "grid" | "list";

const RISK_BAR_MAX = 60; // visual full-scale for the risk micro-bar

const getApiUrl = (routePath: string) => {
  const base = (import.meta as any).env?.VITE_API_URL || "";
  return `${base}/api${routePath}`;
};

const parseGithubUrl = (raw: string): { owner: string; repo: string } | null => {
  const m = raw.trim().match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
};

const RiskBar: React.FC<{ risk: number; grade: string }> = ({ risk, grade }) => (
  <span
    className="inline-flex items-center gap-2 font-mono text-[10.5px] text-slate-400 tabular-nums"
    title="Weighted risk score"
  >
    <span className="inline-block w-[52px] h-1 rounded-sm overflow-hidden" style={{ background: "rgba(30,41,59,0.9)" }}>
      <i
        className="block h-full rounded-sm"
        style={{ width: `${Math.min(100, (risk / RISK_BAR_MAX) * 100)}%`, background: gradeInfo(grade).hex }}
      />
    </span>
    risk {risk}
  </span>
);




export const RegistryView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [skills, setSkills] = useState<RegistrySkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<GradeFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("risk");
  const [layout, setLayout] = useState<Layout>("grid");
  const [sortOpen, setSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "risk", label: "Sort · risk ↑" },
    { value: "stars", label: "Sort · stars ↓" },
    { value: "name", label: "Sort · name A–Z" },
    { value: "scanned", label: "Sort · newest scan" },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch(getApiUrl("/registry/search"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch registry list", e))
      .finally(() => setLoading(false));
  }, []);

  const githubTarget = parseGithubUrl(query);

  const isIndexed = useMemo(() => {
    if (!githubTarget) return false;
    return skills.some(
      (s) =>
        s.owner.toLowerCase() === githubTarget.owner.toLowerCase() &&
        s.repo.toLowerCase() === githubTarget.repo.toLowerCase()
    );
  }, [skills, githubTarget]);

  const goToReport = (owner: string, repo: string) => onNavigate(`/registry/${owner}/${repo}`);

  const clearAllFilters = () => {
    setGrade("ALL");
  };

  const activeFilterCount = grade !== "ALL" ? 1 : 0;

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: skills.length, A: 0, B: 0, C: 0, F: 0 };
    skills.forEach((s) => {
      if (c[s.grade] !== undefined) c[s.grade]++;
    });
    return c;
  }, [skills]);

  const pulse = useMemo(() => {
    const passN = skills.filter((s) => s.status === "PASS").length;
    const risks = skills.map((s) => s.risk_score).sort((a, b) => a - b);
    const median = risks.length ? risks[Math.floor(risks.length / 2)] : 0;
    const findings = skills.reduce((n, s) => n + (s.findings_count || 0), 0);
    const langs = new Set(skills.flatMap((s) => s.primary_languages || [])).size;
    return { passN, median, findings, langs };
  }, [skills]);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = skills.filter((s) => {
      if (grade !== "ALL" && s.grade !== grade) return false;
      // Text search
      if (!q) return true;
      return (
        `${s.owner}/${s.repo}`.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.primary_languages || []).join(" ").toLowerCase().includes(q)
      );
    });
    const cmp: Record<SortKey, (a: RegistrySkill, b: RegistrySkill) => number> = {
      risk: (a, b) => a.risk_score - b.risk_score || `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`),
      stars: (a, b) => (b.stars || 0) - (a.stars || 0),
      name: (a, b) => `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`),
      scanned: (a, b) => (b.scanned_at || "").localeCompare(a.scanned_at || ""),
    };
    return [...filtered].sort(cmp[sort]);
  }, [skills, query, grade, sort]);

  const cardMeta = (s: RegistrySkill) => {
    const bits: string[] = [];
    if (s.stars) bits.push(`★ ${fmtK(s.stars)}`);
    else bits.push(`${(s.files_analyzed || 0).toLocaleString()} files`);
    if (s.scanned_at) bits.push(`scanned ${s.scanned_at.slice(5, 10)}`);
    else if (s.freshness) bits.push(s.freshness);
    return bits.join(" · ");
  };

  return (
    <div className="min-h-screen" style={{ background: "#0b1120" }}>
      {/* ── Hero band ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.05) 100%)",
          borderBottom: "1px solid rgba(71,85,105,0.2)",
        }}
      >
        <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: 80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-[1180px] mx-auto px-4 sm:px-7 pt-11 pb-2 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-9 items-end">
            <div>
              <Eyebrow>ScapeGuard · security-audited skills</Eyebrow>
              <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-100 mt-2.5 mb-2.5" style={{ letterSpacing: "-1px", lineHeight: 1.12 }}>
                Public Agent Skill Registry
              </h1>
              <p className="text-[14.5px] text-slate-400 max-w-[56ch] mb-6">
                Every skill audited, every grade earned. Search indexed skills, or type any GitHub URL to compile
                and scan it on the fly with ScapeGuard's five gate categories.
              </p>
              <form
                className="flex gap-2.5 max-w-[640px] mb-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (githubTarget) {
                    if (isIndexed) {
                      goToReport(githubTarget.owner, githubTarget.repo);
                    } else {
                      const fullUrl = `https://github.com/${githubTarget.owner}/${githubTarget.repo}`;
                      onNavigate(`/?repo_url=${encodeURIComponent(fullUrl)}&autostart=true`);
                    }
                  }
                }}
              >
                <label
                  className="flex-1 flex items-center gap-2.5 rounded-lg px-3.5 transition-colors focus-within:border-cyan-500"
                  style={{ background: "rgba(2,6,23,0.8)", border: "1px solid #1e293b" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50 flex-shrink-0">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search skills — or paste any GitHub URL..."
                    aria-label="Search the registry"
                    className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-xs h-[42px] min-w-0 placeholder:text-slate-600"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!githubTarget}
                  className="inline-flex items-center rounded-lg text-xs font-semibold px-4 h-[42px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "rgba(8,51,68,0.8)", border: "1px solid #155e75", color: "#22d3ee" }}
                >
                  Compile &amp; Scan
                </button>
              </form>
            </div>

            {/* Registry pulse */}
            <div className="min-w-0 lg:min-w-[340px] mb-8 lg:mb-9">
              <div className="rounded-2xl overflow-hidden" style={glassStyle} role="group" aria-label="Registry summary">
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  {[
                    { l: "Skills indexed", v: String(skills.length), s: `across ${pulse.langs} languages` },
                    { l: "Gate pass rate", v: skills.length ? `${Math.round((pulse.passN / skills.length) * 100)}%` : "—", s: `${pulse.passN} of ${skills.length} pass` },
                    { l: "Median risk", v: String(pulse.median), s: "weighted score" },
                    { l: "Open findings", v: String(pulse.findings), s: "across all scans" },
                  ].map((t, i) => (
                    <div key={t.l} className="px-4 py-3.5" style={{ borderLeft: i > 0 ? "1px solid rgba(71,85,105,0.2)" : "none" }}>
                      <Eyebrow>{t.l}</Eyebrow>
                      <div className="font-mono tabular-nums text-[22px] font-semibold text-slate-100 mt-1 leading-tight">{t.v}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{t.s}</div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid rgba(71,85,105,0.2)" }}>
                  <div className="flex gap-0.5 h-1.5 rounded-sm overflow-hidden" title="Grade distribution">
                    {(["A", "B", "C", "F"] as const).map(
                      (g) =>
                        counts[g] > 0 && <span key={g} style={{ flex: counts[g], background: gradeInfo(g).hex, display: "block" }} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {(["A", "B", "C", "F"] as const).map((g) => (
                      <span key={g} className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.06em] text-slate-400 tabular-nums">
                        <i style={{ width: 7, height: 7, borderRadius: 2, background: gradeInfo(g).hex, display: "inline-block" }} />
                        {g} {counts[g]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + results ──────────────────────────────────── */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-7">

        {/* Mobile clear all button if grade filter is active */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-3 pt-4 pb-2 lg:hidden">
            <button onClick={clearAllFilters} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              Clear all filters
            </button>
          </div>
        )}

        <div className="flex gap-6 pt-2 pb-14 items-start">



          {/* ── Results column ─────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* ── Toolbar ─────────────────────────────── */}
            <div className="flex items-center gap-3.5 py-4 flex-wrap">
              {/* Active filter chips */}
              {grade !== "ALL" && (
                <div className="flex flex-wrap gap-1.5 mr-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-mono" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#67e8f9" }}>
                    Grade {grade}
                    <button onClick={() => setGrade("ALL")} className="opacity-70 hover:opacity-100 leading-none">×</button>
                  </span>
                </div>
              )}
              <span className="font-mono text-[11px] tracking-[0.06em] text-slate-500 mr-auto">
                {list.length} skill{list.length === 1 ? "" : "s"} · sorted by {sort}
              </span>
              <div className="flex gap-1.5" role="group" aria-label="Filter by grade">
                {(["ALL", "A", "B", "C", "F"] as GradeFilter[]).map((g) => {
                  const on = grade === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      className="font-mono text-[11px] tracking-[0.04em] rounded-full px-3 py-1 transition-colors"
                      style={
                        on
                          ? { background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.5)", color: "#67e8f9" }
                          : { background: "rgba(30,41,59,0.4)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }
                      }
                    >
                      {g === "ALL" ? "All" : `Grade ${g}`}
                      <span className="ml-1.5" style={{ color: on ? "rgba(103,232,249,0.75)" : "#64748b" }}>{counts[g]}</span>
                    </button>
                  );
                })}
              </div>
              <div ref={sortDropdownRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  className="font-mono text-[11px] rounded-md px-3 py-1.5 text-slate-400 flex items-center gap-1.5 transition-colors duration-150 hover:text-slate-200"
                  style={{
                    background: "rgba(30,41,59,0.5)",
                    border: "1px solid rgba(71,85,105,0.35)",
                    cursor: "pointer"
                  }}
                >
                  {sortOptions.find(o => o.value === sort)?.label}
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: sortOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s" }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {sortOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 mt-1.5 w-[160px] rounded-lg overflow-hidden z-50 shadow-2xl flex flex-col p-1 gap-0.5"
                    style={{
                      background: "rgba(15,23,42,0.92)",
                      border: "1px solid rgba(71,85,105,0.3)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)"
                    }}
                  >
                    {sortOptions.map((o) => {
                      const active = o.value === sort;
                      return (
                        <button
                          key={o.value}
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setSort(o.value);
                            setSortOpen(false);
                          }}
                          className={`font-mono text-[11px] text-left px-2.5 py-1.5 rounded transition-colors duration-150 ${
                            active
                              ? "bg-cyan-500/15 text-cyan-400 font-semibold"
                              : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                          }`}
                          style={{
                            cursor: "pointer",
                            ...(active ? { border: "1px solid rgba(6,182,212,0.2)" } : {})
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid rgba(71,85,105,0.35)" }} role="group" aria-label="Layout">
                {(
                  [
                    ["grid", <svg key="g" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>],
                    ["list", <svg key="l" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>],
                  ] as [Layout, React.ReactNode][]
                ).map(([mode, icon]) => (
                  <button
                    key={mode}
                    onClick={() => setLayout(mode)}
                    aria-label={`${mode} view`}
                    title={`${mode} view`}
                    className="flex px-2.5 py-[7px] transition-colors"
                    style={layout === mode ? { background: "rgba(30,41,59,0.9)", color: "#22d3ee" } : { background: "none", color: "#64748b" }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-14">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-2xl p-5 animate-pulse h-[180px]" style={glassStyle} />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="rounded-2xl text-center px-5 py-14 mb-14" style={glassStyle}>
                <p className="font-semibold text-slate-200 mb-1.5">No indexed skill matches &ldquo;{query || "applied filters"}&rdquo;</p>
                <p className="text-xs text-slate-500 mb-4">
                  {activeFilterCount > 0
                    ? "Try clearing some filters, or paste a GitHub URL to scan a new repo."
                    : "Paste a GitHub URL above and ScapeGuard will compile and scan it on the fly."
                  }
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center rounded-lg text-xs font-semibold px-4 py-2.5 mr-3"
                    style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.4)", color: "#94a3b8" }}
                  >
                    Clear all filters
                  </button>
                )}
                {githubTarget && (
                  <button
                    onClick={() => {
                      if (isIndexed) {
                        goToReport(githubTarget.owner, githubTarget.repo);
                      } else {
                        const fullUrl = `https://github.com/${githubTarget.owner}/${githubTarget.repo}`;
                        onNavigate(`/?repo_url=${encodeURIComponent(fullUrl)}&autostart=true`);
                      }
                    }}
                    className="inline-flex items-center rounded-lg text-xs font-semibold px-4 py-2.5"
                    style={{ background: "rgba(8,51,68,0.8)", border: "1px solid #155e75", color: "#22d3ee" }}
                  >
                    Compile this repository now
                  </button>
                )}
              </div>
            ) : layout === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-14">
                {list.map((s) => (
                  <a
                    key={s.repo_url}
                    href={`/registry/${s.owner}/${s.repo}`}
                    onClick={(e) => {
                      e.preventDefault();
                      goToReport(s.owner, s.repo);
                    }}
                    aria-label={`Open security report for ${s.owner}/${s.repo}`}
                    className="flex flex-col gap-3 rounded-2xl p-[18px] pb-[15px] transition-all duration-150 hover:-translate-y-0.5"
                    style={glassStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)";
                      e.currentTarget.style.boxShadow = "0 0 12px rgba(6,182,212,0.06), 0 12px 32px -18px rgba(0,0,0,0.9)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(71,85,105,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <RepoMark owner={s.owner} repo={s.repo} grade={s.grade} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[14.5px] text-slate-200 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className="text-slate-500 font-normal">{s.owner} /</span> {s.repo}
                        </span>
                        <span className="block font-mono text-[10.5px] text-slate-500 mt-1 tracking-[0.03em]">
                          {(s.primary_languages || []).join(" · ")} · {(s.files_analyzed || 0).toLocaleString()} files
                        </span>
                      </span>
                      <GradeSeal grade={s.grade} size={40} />
                    </div>
                    <p className="text-xs text-slate-400 leading-normal m-0 line-clamp-2 min-h-[2.9em]">{s.description}</p>
                    {/* NVIDIA domain + audience chips */}
                    {s.source === "nvidia" && s.nvidia_domain && s.nvidia_domain.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.nvidia_domain.slice(0, 2).map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-mono"
                            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", color: "#c4b5fd" }}
                          >
                            {d}
                          </span>
                        ))}
                        {s.nvidia_audience && s.nvidia_audience[0] && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-mono"
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7" }}
                          >
                            {s.nvidia_audience[0]}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2" title={`Gate verdict: ${s.status} · ${s.findings_count} findings`}>
                      <i style={{ width: 7, height: 7, borderRadius: 2, background: statusColor(s.status), display: "inline-block" }} />
                      <span className="font-mono text-[10px] tracking-[0.05em]" style={{ color: statusColor(s.status) }}>
                        {s.status}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 tracking-[0.05em]">
                        · {s.findings_count} finding{s.findings_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid rgba(71,85,105,0.2)" }}>
                      <span className="font-mono text-[10.5px] text-slate-500 tabular-nums">{cardMeta(s)}</span>
                      <RiskBar risk={s.risk_score} grade={s.grade} />
                    </div>
                  </a>
                ))}
              </div>
        ) : (
          <div className="rounded-2xl overflow-hidden mb-14" style={glassStyle}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[560px]" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "rgba(30,41,59,0.5)", borderBottom: "1px solid rgba(71,85,105,0.35)" }}>
                    <th className="w-[34px] px-3.5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">#</th>
                    <th className="px-3.5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">Skill</th>
                    <th className="w-[110px] px-3.5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">Language</th>
                    <th className="w-[110px] px-3.5 py-3 text-right font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">Risk</th>
                    <th className="w-[130px] px-3.5 py-3 text-right font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => (
                    <tr
                      key={s.repo_url}
                      onClick={() => goToReport(s.owner, s.repo)}
                      onKeyDown={(e) => e.key === "Enter" && goToReport(s.owner, s.repo)}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open report for ${s.owner}/${s.repo}`}
                      className="cursor-pointer transition-colors hover:bg-slate-800/40"
                      style={{ borderBottom: i < list.length - 1 ? "1px solid rgba(71,85,105,0.2)" : "none" }}
                    >
                      <td className="px-3.5 py-3 font-mono text-[10.5px] text-slate-500 tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-3.5 py-3">
                        <span className="flex items-center gap-3 min-w-0">
                          <RepoMark owner={s.owner} repo={s.repo} grade={s.grade} size={30} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-[12.5px] text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis">
                              <span className="text-slate-500 font-normal">{s.owner} /</span> {s.repo}
                            </span>
                            <span className="block text-[11.5px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis mt-px">
                              {s.description}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {(s.primary_languages || [])[0] || "—"}
                        {(s.primary_languages || []).length > 1 ? ` +${s.primary_languages.length - 1}` : ""}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <RiskBar risk={s.risk_score} grade={s.grade} />
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <GradeChip grade={s.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            )}
          </div> {/* end results column */}
        </div> {/* end body flex row */}
      </div> {/* end max-w container */}
    </div>
  );
};
