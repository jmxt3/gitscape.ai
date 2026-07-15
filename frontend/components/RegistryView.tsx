// Author: Joao Machete
// Description: Public Agent Skill Registry index page — Aurora design. A full-page
// certification-ledger layout: hero with registry pulse stats, grade filters,
// grid/list toggle, and seal cards that navigate to per-repo security reports.
import React, { useState, useEffect, useMemo } from "react";
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

  useEffect(() => {
    fetch(getApiUrl("/registry/search"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch registry list", e))
      .finally(() => setLoading(false));
  }, []);

  const githubTarget = parseGithubUrl(query);

  const goToReport = (owner: string, repo: string) => onNavigate(`/registry/${owner}/${repo}`);

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
                  if (githubTarget) goToReport(githubTarget.owner, githubTarget.repo);
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

      {/* ── Toolbar + results ─────────────────────────────────────── */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-7">
        <div className="flex items-center gap-3.5 py-4 flex-wrap">
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
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort order"
            className="font-mono text-[11px] rounded-md px-2 py-1.5 text-slate-400"
            style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(71,85,105,0.35)" }}
          >
            <option value="risk">Sort · risk ↑</option>
            <option value="stars">Sort · stars ↓</option>
            <option value="name">Sort · name A–Z</option>
            <option value="scanned">Sort · newest scan</option>
          </select>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-14">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl p-5 animate-pulse h-[180px]" style={glassStyle} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl text-center px-5 py-14 mb-14" style={glassStyle}>
            <p className="font-semibold text-slate-200 mb-1.5">No indexed skill matches “{query}”</p>
            <p className="text-xs text-slate-500 mb-4">
              Paste a GitHub URL above and ScapeGuard will compile and scan it on the fly.
            </p>
            {githubTarget && (
              <button
                onClick={() => goToReport(githubTarget.owner, githubTarget.repo)}
                className="inline-flex items-center rounded-lg text-xs font-semibold px-4 py-2.5"
                style={{ background: "rgba(8,51,68,0.8)", border: "1px solid #155e75", color: "#22d3ee" }}
              >
                Compile this repository now
              </button>
            )}
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-14">
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
      </div>
    </div>
  );
};
