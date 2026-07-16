// Author: Joao Machete
// Description: Per-repo security audit report — Aurora design. An audit-document
// layout: certificate of audit with animated grade seal, KPI instrument tiles,
// gate-category verdicts, severity profile, expandable findings ledger, and
// provenance/distribution (scan-report.json, README badge, install command).
import React, { useState, useEffect } from "react";
import { ScanFinding, CategoryResult } from "../types";
import {
  gradeInfo,
  sevColor,
  statusColor,
  SEV_ORDER,
  CAT_LABEL,
  DEFAULT_CATEGORIES,
  fmtK,
  glassStyle,
  codeSurfaceStyle,
  Eyebrow,
  SectionTitle,
  GradeSeal,
  GradeChip,
  StatusChip,
  SevPill,
  CopyButton,
} from "./registryTheme";

interface RepoReportData {
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
  findings: ScanFinding[];
  categories: CategoryResult[];
  skill_md?: string;
  scanned_at?: string;
  findings_count?: number;
  stars?: number;
  forks?: number;
  license?: string;
  open_issues?: number;
  watchers?: number;
  last_commit_at?: string;
  ai_summary?: string;
  last_git_sha?: string;
}

interface RepoReportPageProps {
  owner: string;
  repo: string;
  onNavigate: (path: string, hash?: string) => void;
}

type FindSort = "severity" | "rule" | "file";

const SEV_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

const SkeletonCard: React.FC<{ h?: number }> = ({ h = 120 }) => (
  <div className="rounded-2xl animate-pulse" style={{ ...glassStyle, height: h }} />
);

// Category verdicts fall back to grade-derived statuses when a cached report
// predates the categories field (mirrors the backend badge-page fallback).
const resolveCategories = (data: RepoReportData): CategoryResult[] => {
  if (data.categories && data.categories.length > 0) return data.categories;
  return DEFAULT_CATEGORIES.map((cat) => {
    let status: CategoryResult["status"] = "PASS";
    if (data.grade === "F" && (cat === "secrets" || cat === "prompt_injection")) status = "FAIL";
    else if (["B", "C"].includes(data.grade) && cat === "prompt_injection") status = "WARN";
    return { category: cat, status, findings: status === "PASS" ? 0 : 1 };
  });
};

export const RepoReportPage: React.FC<RepoReportPageProps> = ({ owner, repo, onNavigate }) => {
  const [data, setData] = useState<RepoReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [findSort, setFindSort] = useState<FindSort>("severity");
  const [expanded, setExpanded] = useState<number | null>(null);

  const repoUrl = `https://github.com/${owner}/${repo}`;
  const pageUrl = `https://gitscape.ai/registry/${owner}/${repo}`;

  const getApiUrl = (path: string) => {
    const base = (import.meta as any).env?.VITE_API_URL || "";
    return `${base}/api${path}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded(null);
    fetch(getApiUrl(`/registry/detail?repo_url=${encodeURIComponent(repoUrl)}`))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        const grade = d.grade || "?";
        const count = d.findings?.length ?? 0;
        const langs = (d.primary_languages || []).join(", ") || "Unknown";
        document.title = `${owner}/${repo} Security Audit — Grade ${grade} | GitScape AI`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute(
            "content",
            `${owner}/${repo} received Grade ${grade} in the GitScape ScapeGuard security audit — ${count} finding${count !== 1 ? "s" : ""} across ${d.files_analyzed} files. Languages: ${langs}.`
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {
      document.title = "GitScape AI – Turn GitHub Repos into AI Agent Skills";
    };
  }, [owner, repo]);

  const G = gradeInfo(data?.grade);
  const findings = data?.findings || [];
  const sevCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  findings.forEach((f) => {
    const s = (f.severity || "").toUpperCase();
    if (sevCounts[s] !== undefined) sevCounts[s]++;
  });
  const categories = data ? resolveCategories(data) : [];
  const gatesPassed = categories.filter((c) => c.status === "PASS").length;

  const sortedFindings = [...findings].sort((a, b) => {
    if (findSort === "severity")
      return (SEV_RANK[(a.severity || "").toUpperCase()] ?? 9) - (SEV_RANK[(b.severity || "").toUpperCase()] ?? 9);
    if (findSort === "rule") return (a.rule ?? "").localeCompare(b.rule ?? "");
    return (a.file ?? "").localeCompare(b.file ?? "");
  });

  const badgeMarkdown = data
    ? `[![Skill Verified · ${data.grade}](https://gitscape.ai/api/badge/${owner}/${repo})](${pageUrl})`
    : "";
  const installCmd = `npx gitscape ${repoUrl}`;
  const sha = data?.last_git_sha ? data.last_git_sha.slice(0, 12) : "—";

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

        <div className="max-w-[1180px] mx-auto px-4 sm:px-7 py-7 relative">
          <nav className="flex items-center gap-2 font-mono text-[11px] text-slate-500 mb-5" aria-label="Breadcrumb">
            <button onClick={() => onNavigate("/")} className="hover:text-cyan-300 transition-colors">gitscape.ai</button>
            <span>/</span>
            <button onClick={() => onNavigate("/registry")} className="hover:text-cyan-300 transition-colors">registry</button>
            <span>/</span>
            <span className="text-slate-400">{owner}/{repo}</span>
          </nav>

          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="h-9 w-72 rounded-lg animate-pulse" style={{ background: "rgba(71,85,105,0.3)" }} />
              <div className="h-4 w-96 max-w-full rounded animate-pulse" style={{ background: "rgba(71,85,105,0.2)" }} />
            </div>
          ) : data ? (
            <>
              <Eyebrow>Security audit report · {sha}</Eyebrow>
              <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 mb-2" style={{ letterSpacing: "-1px", lineHeight: 1.15, color: "#f1f5f9" }}>
                <span style={{ color: "#22d3ee" }}>{owner}</span>
                <span style={{ color: "#475569", fontWeight: 400 }}> / </span>
                {repo}
              </h1>
              <p className="text-[14.5px] text-slate-400 max-w-[62ch] mb-3.5">{data.description}</p>

              {data.ai_summary && (
                <div className="rounded-xl px-4 py-3.5 mb-4 max-w-3xl" style={{ background: "rgba(30,41,59,0.3)", border: "1px solid rgba(71,85,105,0.2)" }}>
                  <p className="text-[13px] italic text-slate-300 leading-relaxed m-0">🛡 &ldquo;{data.ai_summary}&rdquo;</p>
                  <span className="block font-mono not-italic text-[10px] tracking-[0.12em] uppercase text-slate-500 mt-2">
                    ScapeGuard analyst summary · generated from scan evidence
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {data.scanned_at && <span className="fact-pill">📅 Scanned {data.scanned_at.slice(0, 10)}</span>}
                <span className="fact-pill">📁 {data.files_analyzed.toLocaleString()} files</span>
                {!!data.stars && <span className="fact-pill">⭐ {fmtK(data.stars)} stars</span>}
                {!!data.forks && <span className="fact-pill">🍴 {fmtK(data.forks)} forks</span>}
                {data.license && <span className="fact-pill">⚖️ {data.license}</span>}
                {(data.primary_languages || []).map((l) => (
                  <span key={l} className="fact-pill">{l}</span>
                ))}
                <span className="fact-pill" style={{ color: G.hex, borderColor: `${G.hex}44`, background: `${G.hex}11` }}>
                  🛡 Grade {data.grade} · {G.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg text-xs font-semibold px-3.5 py-2"
                  style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.4)", color: "#94a3b8" }}
                >
                  View on GitHub ↗
                </a>
                <button
                  onClick={() => onNavigate("/registry")}
                  className="inline-flex items-center gap-2 rounded-lg text-xs font-semibold px-3.5 py-2"
                  style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(71,85,105,0.3)", color: "#64748b" }}
                >
                  ← Registry
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-7">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-3.5 py-5">
            <SkeletonCard h={420} />
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <SkeletonCard h={150} /><SkeletonCard h={150} /><SkeletonCard h={150} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <SkeletonCard h={240} /><SkeletonCard h={240} />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl p-8 text-center my-8" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="text-rose-400 font-semibold mb-1">Failed to load report</div>
            <p className="text-xs text-slate-500">{error}</p>
            <button onClick={() => onNavigate("/registry")} className="mt-4 text-xs text-cyan-400 hover:underline">
              ← Back to Registry
            </button>
          </div>
        ) : data ? (
          <>
            {/* ── Certificate + KPI instruments ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-3.5 pt-5 items-stretch">
              <div
                className="rounded-2xl flex flex-col items-center text-center relative overflow-hidden px-5 pt-6 pb-4"
                style={{ ...glassStyle, borderColor: `${G.hex}22`, boxShadow: `0 0 40px -8px ${G.hex}22` }}
              >
                <div className="absolute rounded-lg pointer-events-none" style={{ inset: 8, border: "1px solid rgba(71,85,105,0.2)" }} />
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-slate-500">
                  Certificate of audit · {sha}
                </span>
                <div className="mt-4">
                  <GradeSeal grade={data.grade} size={132} animate />
                </div>
                <div className="text-[12.5px] font-semibold mt-2.5" style={{ color: G.hex }}>{G.label}</div>
                <div className="mt-3.5 mb-1"><StatusChip status={data.status} size={12} /></div>
                <dl className="w-full grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-left mt-4 pt-3.5 m-0" style={{ borderTop: "1px solid rgba(71,85,105,0.2)" }}>
                  {(
                    [
                      ["Engine", "scapeguard/2.1.0"],
                      ["Commit", sha],
                      ["Gates", `${gatesPassed}/5 pass`],
                      ["Method", "deterministic gate"],
                      ["Next scan", "on new commit"],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <React.Fragment key={k}>
                      <dt className="font-mono text-[10px] tracking-[0.13em] uppercase text-slate-500 self-center">{k}</dt>
                      <dd className="m-0 font-mono text-[11px] text-slate-400 text-right tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">{v}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <div className="font-mono text-[9.5px] tracking-[0.1em] text-slate-500 mt-3">
                  GRADE BANDS · A ≤ 0 · B ≤ 20 · C ≤ 50 · F &gt; 50 OR GATE FAIL
                </div>
              </div>

              <div className="flex flex-col gap-3.5 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Risk score */}
                  <div className="rounded-2xl p-5" style={glassStyle}>
                    <Eyebrow>Risk score</Eyebrow>
                    <div className="font-mono tabular-nums text-3xl font-semibold mt-2 mb-0.5" style={{ color: G.hex, letterSpacing: "-0.02em" }}>
                      {data.risk_score}
                    </div>
                    <span className="text-[11.5px] text-slate-500">weighted severity, confidence-dampened</span>
                    <div className="relative h-1.5 rounded-sm mt-3.5" style={{ background: "rgba(30,41,59,0.9)" }} role="img" aria-label={`Risk ${data.risk_score} on a 0 to 100 scale`}>
                      <span className="absolute w-px" style={{ left: "20%", top: -3, bottom: -3, background: "rgba(71,85,105,0.35)" }} />
                      <span className="absolute w-px" style={{ left: "50%", top: -3, bottom: -3, background: "rgba(71,85,105,0.35)" }} />
                      <span
                        className="absolute left-0 top-0 bottom-0 rounded-sm"
                        style={{ width: `${Math.max(2, Math.min(100, data.risk_score))}%`, background: G.hex }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[9px] tracking-[0.08em] text-slate-500 mt-1.5">
                      <span>0</span><span>B·20</span><span>C·50</span><span>100+</span>
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="rounded-2xl p-5" style={glassStyle}>
                    <Eyebrow>Findings</Eyebrow>
                    <div className="font-mono tabular-nums text-3xl font-semibold text-slate-100 mt-2 mb-0.5" style={{ letterSpacing: "-0.02em" }}>
                      {findings.length}
                    </div>
                    <span className="text-[11.5px] text-slate-500">
                      {findings.length === 0 ? "clean scan" : sevCounts.CRITICAL > 0 ? `${sevCounts.CRITICAL} unbypassable` : "all reviewable"}
                    </span>
                    <div className="flex gap-0.5 h-2 rounded-sm overflow-hidden mt-3.5" style={{ background: "rgba(30,41,59,0.9)" }} role="img" aria-label="Findings by severity">
                      {findings.length === 0 ? (
                        <i style={{ flex: 1, background: "#10b981", opacity: 0.35, display: "block" }} />
                      ) : (
                        SEV_ORDER.filter((s) => sevCounts[s] > 0).map((s) => (
                          <i key={s} style={{ flex: sevCounts[s], background: sevColor(s), display: "block" }} />
                        ))
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {findings.length === 0 ? (
                        <span className="micro-legend"><i style={{ background: "#10b981" }} />NONE</span>
                      ) : (
                        SEV_ORDER.filter((s) => sevCounts[s] > 0).map((s) => (
                          <span key={s} className="micro-legend"><i style={{ background: sevColor(s) }} />{s} {sevCounts[s]}</span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Coverage */}
                  <div className="rounded-2xl p-5" style={glassStyle}>
                    <Eyebrow>Coverage</Eyebrow>
                    <div className="font-mono tabular-nums text-3xl font-semibold text-slate-100 mt-2 mb-0.5" style={{ letterSpacing: "-0.02em" }}>
                      {data.files_analyzed.toLocaleString()}
                    </div>
                    <span className="text-[11.5px] text-slate-500">files statically analyzed</span>
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {(data.primary_languages || []).map((l) => (
                        <span key={l} className="font-mono text-[10.5px] text-slate-400 rounded px-2 py-0.5" style={{ border: "1px solid rgba(71,85,105,0.35)" }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gate categories + severity profile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 flex-grow">
                  <div className="rounded-2xl p-5" style={glassStyle}>
                    <SectionTitle sub="Deterministic PASS / WARN / FAIL per category">Gate categories</SectionTitle>
                    <div className="mt-3">
                      {categories.map((c, i) => (
                        <div key={c.category} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < categories.length - 1 ? "1px solid rgba(71,85,105,0.2)" : "none" }}>
                          <i style={{ width: 8, height: 8, borderRadius: 2, background: statusColor(c.status), flexShrink: 0 }} />
                          <span className="font-mono text-[11.5px] text-slate-400 flex-1 tracking-[0.02em]">
                            {CAT_LABEL[c.category] || c.category}
                          </span>
                          <span className="font-mono text-[10.5px] text-slate-500 tabular-nums">
                            {c.findings > 0 ? `${c.findings} finding${c.findings > 1 ? "s" : ""}` : "—"}
                          </span>
                          <StatusChip status={c.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl p-5" style={glassStyle}>
                    <SectionTitle sub={`${findings.length} finding${findings.length === 1 ? "" : "s"} by severity`}>Severity profile</SectionTitle>
                    <div className="flex flex-col gap-2.5 mt-4">
                      {SEV_ORDER.map((s) => {
                        const max = Math.max(...SEV_ORDER.map((k) => sevCounts[k]), 1);
                        return (
                          <div key={s} className="grid grid-cols-[76px_1fr_30px] items-center gap-3">
                            <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: sevCounts[s] > 0 ? sevColor(s) : "#64748b" }}>{s}</span>
                            <span className="h-2.5 relative">
                              <span
                                className="block h-2.5"
                                style={{
                                  width: sevCounts[s] === 0 ? 2 : `${(sevCounts[s] / max) * 100}%`,
                                  minWidth: 2,
                                  background: sevColor(s),
                                  opacity: sevCounts[s] === 0 ? 0.18 : 1,
                                  borderRadius: "0 4px 4px 0",
                                }}
                              />
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 text-right tabular-nums">{sevCounts[s]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Findings ledger ───────────────────────────────────── */}
            <div className="rounded-2xl mt-3.5 overflow-hidden" style={glassStyle}>
              <div className="flex items-baseline gap-3.5 flex-wrap px-5 pt-5 pb-3.5">
                <SectionTitle>Findings ledger</SectionTitle>
                <span className="text-[11.5px] text-slate-500">
                  {findings.length} finding{findings.length === 1 ? "" : "s"} · click a row for evidence &amp; remediation
                </span>
                {findings.length > 0 && (
                  <span className="ml-auto flex items-center gap-1">
                    <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-slate-500 mr-1">Sort</span>
                    {(["severity", "rule", "file"] as FindSort[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => { setFindSort(k); setExpanded(null); }}
                        className="font-mono text-[10.5px] rounded px-2.5 py-1 tracking-[0.04em] transition-colors"
                        style={
                          findSort === k
                            ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", color: "#a78bfa" }
                            : { background: "none", border: "1px solid transparent", color: "#64748b" }
                        }
                      >
                        {k}
                      </button>
                    ))}
                  </span>
                )}
              </div>

              {findings.length === 0 ? (
                <div className="text-center px-5 py-11">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto">
                    <circle cx="20" cy="20" r="18" stroke="#10b981" strokeOpacity=".4" strokeWidth="1.5" />
                    <path d="M13 20.5l4.6 4.6L27.5 15" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="font-semibold text-emerald-400 text-sm mt-3 mb-1">No findings — clean scan</div>
                  <p className="text-xs text-slate-500 max-w-[44ch] mx-auto m-0">
                    All five gate categories passed deterministically. This skill is certified safe for workspace
                    installation at commit {sha}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[760px]">
                    <thead>
                      <tr style={{ background: "rgba(30,41,59,0.5)", borderTop: "1px solid rgba(71,85,105,0.35)", borderBottom: "1px solid rgba(71,85,105,0.35)" }}>
                        {["Severity", "Rule", "Finding", "Location", "Conf"].map((h) => (
                          <th key={h} className="px-3.5 py-2.5 text-left font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFindings.map((f, idx) => (
                        <React.Fragment key={idx}>
                          <tr
                            onClick={() => setExpanded(expanded === idx ? null : idx)}
                            className="cursor-pointer transition-colors hover:bg-slate-800/40 align-top"
                            aria-expanded={expanded === idx}
                            style={{ borderBottom: idx < sortedFindings.length - 1 || expanded === idx ? "1px solid rgba(71,85,105,0.2)" : "none" }}
                          >
                            <td className="px-3.5 py-3"><SevPill severity={f.severity} /></td>
                            <td className="px-3.5 py-3 font-mono text-[11px] whitespace-nowrap">
                              <span className="text-slate-400">{f.id || f.rule}</span>
                              {f.id && <><br /><span className="text-slate-500">{f.rule}</span></>}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-slate-300 max-w-[380px]">
                              <span className="line-clamp-2">{f.message}</span>
                            </td>
                            <td className="px-3.5 py-3 font-mono text-[10.5px] text-slate-500 whitespace-nowrap tabular-nums">
                              {f.file}{f.line ? `:${f.line}` : ""}
                            </td>
                            <td className="px-3.5 py-3 font-mono text-[10px] tracking-[0.08em] text-slate-500 uppercase">
                              {f.confidence || "—"}
                            </td>
                          </tr>
                          {expanded === idx && (f.snippet || f.remediation || f.category) && (
                            <tr style={{ background: "rgba(8,13,20,0.8)", borderBottom: idx < sortedFindings.length - 1 ? "1px solid rgba(71,85,105,0.2)" : "none" }}>
                              <td colSpan={5} className="px-4 pt-3 pb-4">
                                {f.category && (
                                  <span className="inline-block font-mono text-[9.5px] tracking-[0.1em] uppercase text-slate-500 rounded px-2 py-0.5 mb-2.5" style={{ border: "1px solid rgba(71,85,105,0.35)" }}>
                                    gate · {CAT_LABEL[f.category] || f.category}
                                  </span>
                                )}
                                {f.remediation && (
                                  <p className="flex gap-2 items-baseline text-xs text-amber-400 mt-0 mb-2.5">
                                    <b className="font-mono text-[9.5px] tracking-[0.13em] uppercase flex-shrink-0">Remediation</b>
                                    <span className="text-slate-300">{f.remediation}</span>
                                  </p>
                                )}
                                {f.snippet && (
                                  <pre className="m-0 rounded-lg px-3.5 py-3 font-mono text-[11px] text-slate-400 overflow-x-auto leading-relaxed" style={{ background: "#020617", border: "1px solid rgba(71,85,105,0.2)", maxHeight: 150 }}>
                                    <code>{f.snippet}</code>
                                  </pre>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Provenance & distribution ─────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3.5 mt-3.5 mb-14">
              <div
                className="rounded-2xl p-5 font-mono text-[11px] leading-[1.9] text-slate-500"
                style={{ background: "#020617", border: "1px solid rgba(71,85,105,0.25)", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
              >
                <div className="flex justify-between items-center pb-2.5 mb-3" style={{ borderBottom: "1px solid rgba(71,85,105,0.2)" }}>
                  <span className="text-slate-200 font-semibold">scan-report.json</span>
                  <GradeChip grade={data.grade} />
                </div>
                <div className="flex justify-between gap-4"><span>"engine"</span><span style={{ color: "#38bdf8" }}>"scapeguard/2.1.0"</span></div>
                <div className="flex justify-between gap-4"><span>"grade"</span><span className="font-bold" style={{ color: G.hex }}>"{data.grade}"</span></div>
                <div className="flex justify-between gap-4"><span>"risk_score"</span><span className="text-amber-500 tabular-nums">{data.risk_score}</span></div>
                {categories.map((c) => (
                  <div key={c.category} className="flex justify-between gap-4">
                    <span>"{c.category}"</span>
                    <span style={{ color: statusColor(c.status) }}>"{c.status}"</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4"><span>"license"</span><span className="text-slate-200">"{data.license || "Unknown"}"</span></div>
                <div className="flex justify-between gap-4"><span>"files_scanned"</span><span className="text-emerald-400 tabular-nums">{data.files_analyzed}</span></div>
                <div className="flex justify-between gap-4"><span>"skill_hash"</span><span>"{sha}"</span></div>
              </div>

              <div className="flex flex-col gap-3.5">
                <div className="rounded-2xl p-5" style={glassStyle}>
                  <SectionTitle sub="One command compiles this repository and installs the scanned skill.">
                    Install as agent skill
                  </SectionTitle>
                  <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 mt-3 font-mono text-[11.5px] text-slate-300" style={codeSurfaceStyle}>
                    <span className="text-emerald-400 select-none">$</span>
                    <code className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar">{installCmd}</code>
                    <CopyButton text={installCmd} />
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={glassStyle}>
                  <SectionTitle sub="Embed the live skill verification badge in your README — it updates on every scan.">
                    Show your verification
                  </SectionTitle>
                  <div className="flex items-center gap-3 mt-3 mb-3">
                    <img src={`/api/badge/${owner}/${repo}`} alt={`Skill Verified · ${data.grade} — Scanned by GitScape`} className="h-5" />
                    <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">live preview</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-mono text-[11px] text-slate-400" style={codeSurfaceStyle}>
                    <code className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar">{badgeMarkdown}</code>
                    <CopyButton text={badgeMarkdown} />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Page-scoped helpers for the fact pills and micro legends */}
      <style>{`
        .fact-pill{
          display:inline-flex; align-items:center; font-size:11.5px; font-weight:600; color:#94a3b8;
          background:rgba(30,41,59,0.7); border:1px solid rgba(71,85,105,0.35);
          border-radius:99px; padding:4px 12px; white-space:nowrap;
          font-variant-numeric:tabular-nums;
        }
        .micro-legend{
          display:inline-flex; align-items:center; gap:5px;
          font-family:'JetBrains Mono',ui-monospace,monospace; font-size:9.5px; letter-spacing:.06em;
          color:#94a3b8; font-variant-numeric:tabular-nums;
        }
        .micro-legend i{ width:7px; height:7px; border-radius:2px; display:inline-block; }
      `}</style>
    </div>
  );
};
