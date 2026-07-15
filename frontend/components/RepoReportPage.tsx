import React, { useState, useEffect, useRef } from "react";
import { ScanFinding } from "../types";

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
  categories: { category: string; status: string; findings: number }[];
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

// ── Animated radial security gauge ───────────────────────────────────────────
const SecurityGauge: React.FC<{ grade: string }> = ({ grade }) => {
  const gaugeRef = useRef<SVGCircleElement>(null);
  const RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const scoreMap: Record<string, number> = { A: 95, B: 75, C: 55, F: 20, "?": 0 };
  const score = scoreMap[grade] ?? 0;
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const colorMap: Record<string, string> = {
    A: "#10b981", B: "#84cc16", C: "#f59e0b", F: "#ef4444", "?": "#64748b",
  };
  const color = colorMap[grade] ?? "#64748b";

  useEffect(() => {
    if (gaugeRef.current) {
      gaugeRef.current.style.transition = "none";
      gaugeRef.current.style.strokeDashoffset = String(CIRCUMFERENCE);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (gaugeRef.current) {
            gaugeRef.current.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)";
            gaugeRef.current.style.strokeDashoffset = String(offset);
          }
        });
      });
    }
  }, [grade, offset, CIRCUMFERENCE]);

  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={RADIUS} fill="none" stroke="rgba(71,85,105,0.2)" strokeWidth="10" />
        <defs>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          ref={gaugeRef}
          cx="65" cy="65" r={RADIUS} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          transform="rotate(-90 65 65)"
          filter="url(#gauge-glow)"
        />
        <text x="65" y="60" textAnchor="middle" fontSize="36" fontWeight="800" fill={color} fontFamily="Inter, sans-serif">{grade}</text>
        <text x="65" y="80" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b" fontFamily="Inter, sans-serif">GRADE</text>
      </svg>
    </div>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl p-6 animate-pulse" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(71,85,105,0.2)" }}>
    <div className="h-4 rounded mb-3 w-1/3" style={{ background: "rgba(71,85,105,0.3)" }} />
    <div className="h-8 rounded mb-2 w-1/2" style={{ background: "rgba(71,85,105,0.2)" }} />
    <div className="h-3 rounded w-2/3" style={{ background: "rgba(71,85,105,0.15)" }} />
  </div>
);

const gradeColor = (g: string) => ({ A: "#10b981", B: "#84cc16", C: "#f59e0b", F: "#ef4444" }[g] ?? "#64748b");
const gradeLabel = (g: string) => ({ A: "Excellent", B: "Good", C: "Moderate", F: "High Risk" }[g] ?? "Unknown");
const sevColor = (s: string) =>
  ({ CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#64748b", INFO: "#3b82f6" }[(s || "").toUpperCase()] ?? "#64748b");

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2 mb-4">
    <span style={{ display: "inline-block", width: 3, height: 16, borderRadius: 2, background: "linear-gradient(#7c3aed, #22d3ee)", flexShrink: 0 }} />
    {children}
  </h2>
);

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div
    className={`rounded-xl p-5 ${className}`}
    style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(71,85,105,0.2)" }}
  >
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const RepoReportPage: React.FC<RepoReportPageProps> = ({ owner, repo, onNavigate }) => {
  const [data, setData] = useState<RepoReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"severity" | "rule" | "file">("severity");
  const [copied, setCopied] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);

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
          metaDesc.setAttribute("content",
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

  const copyBadge = () => {
    const grade = data?.grade ?? "?";
    navigator.clipboard.writeText(`[![ScapeGuard Grade ${grade}](https://gitscape.ai/api/badge/${owner}/${repo})](${pageUrl})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedFindings = data
    ? [...(data.findings || [])].sort((a, b) => {
        const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        if (sortField === "severity") return (sevOrder[(a.severity || "").toUpperCase()] ?? 9) - (sevOrder[(b.severity || "").toUpperCase()] ?? 9);
        if (sortField === "rule") return (a.rule ?? "").localeCompare(b.rule ?? "");
        return (a.file ?? "").localeCompare(b.file ?? "");
      })
    : [];

  return (
    <div className="min-h-screen" style={{ background: "#0b1120" }}>
      {/* ── Hero band ───────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.05) 100%)",
          borderBottom: "1px solid rgba(71,85,105,0.2)",
        }}
      >
        <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: 80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14 relative">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
            <button onClick={() => onNavigate("/")} className="hover:text-slate-300 transition-colors">GitScape AI</button>
            <span>›</span>
            <button onClick={() => onNavigate("/registry")} className="hover:text-slate-300 transition-colors">Registry</button>
            <span>›</span>
            <span className="text-cyan-400 font-semibold">{owner}/{repo}</span>
          </nav>

          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="h-9 w-72 rounded-lg animate-pulse" style={{ background: "rgba(71,85,105,0.3)" }} />
              <div className="h-4 w-96 rounded animate-pulse" style={{ background: "rgba(71,85,105,0.2)" }} />
            </div>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={{ color: "#f1f5f9", letterSpacing: "-1px" }}>
                <span style={{ color: "#22d3ee" }}>{owner}</span>
                <span style={{ color: "#475569" }}> / </span>
                {repo}
              </h1>
              {data && <p className="text-[15px] text-slate-400 max-w-2xl mb-4">{data.description}</p>}
              
              {data && data.ai_summary && (
                <div 
                  className="mb-6 p-4 rounded-xl max-w-3xl border"
                  style={{
                    background: "rgba(30,41,59,0.3)",
                    borderColor: "rgba(71,85,105,0.2)"
                  }}
                >
                  <p className="text-sm italic text-slate-300 leading-relaxed">
                    🛡 &ldquo;{data.ai_summary}&rdquo;
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-7">
                {data && (
                  <>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>
                      📅 {data.scanned_at ? `Scanned ${data.scanned_at.slice(0, 10)}` : "Scan date unknown"}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>
                      📁 {data.files_analyzed} files
                    </span>
                    {data.stars !== undefined && data.stars > 0 && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>
                        ⭐ {data.stars.toLocaleString()} stars
                      </span>
                    )}
                    {data.forks !== undefined && data.forks > 0 && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>
                        🍴 {data.forks.toLocaleString()} forks
                      </span>
                    )}
                    {data.license && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>
                        ⚖️ {data.license}
                      </span>
                    )}
                    {data.primary_languages.map((l) => (
                      <span key={l} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.35)", color: "#94a3b8" }}>{l}</span>
                    ))}
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${gradeColor(data.grade)}11`, border: `1px solid ${gradeColor(data.grade)}44`, color: gradeColor(data.grade) }}>
                      🛡 Grade {data.grade} · {gradeLabel(data.grade)}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(71,85,105,0.4)", color: "#94a3b8" }}>
                  View on GitHub ↗
                </a>
                <button onClick={() => onNavigate("/registry")} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(71,85,105,0.3)", color: "#64748b" }}>
                  ← Registry
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Score cards ──────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl p-8 text-center mb-8" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="text-rose-400 font-semibold mb-1">Failed to load report</div>
            <p className="text-xs text-slate-500">{error}</p>
            <button onClick={() => onNavigate("/registry")} className="mt-4 text-xs text-cyan-400 hover:underline">← Back to Registry</button>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
            <div className="grid grid-cols-2 gap-4">
              {/* Gauge */}
              <div
                className="rounded-2xl p-5 flex flex-col items-center justify-center col-span-2 sm:col-span-1"
                style={{ background: "rgba(15,23,42,0.7)", border: `1px solid ${gradeColor(data.grade)}22`, boxShadow: `0 0 40px -8px ${gradeColor(data.grade)}22` }}
              >
                <SecurityGauge grade={data.grade} />
                <span className="text-sm font-bold mt-1" style={{ color: gradeColor(data.grade) }}>{gradeLabel(data.grade)}</span>
              </div>

              {[
                {
                  label: "Risk Score",
                  value: data.risk_score,
                  color: data.risk_score > 15 ? "text-rose-400" : data.risk_score > 5 ? "text-amber-400" : "text-emerald-400",
                  sub: data.risk_score > 15 ? "High Risk" : data.risk_score > 5 ? "Moderate" : "Low Risk",
                },
                {
                  label: "Findings",
                  value: data.findings.length,
                  color: data.findings.length > 0 ? "text-orange-400" : "text-emerald-400",
                  sub: data.findings.length > 0 ? "Issues found" : "Clean",
                },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="rounded-2xl p-5 flex flex-col items-center justify-center" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(71,85,105,0.2)" }}>
                  <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3">{label}</span>
                  <span className={`text-5xl font-extrabold leading-none ${color}`}>{value}</span>
                  <span className="text-xs text-slate-500 mt-2">{sub}</span>
                </div>
              ))}

              {/* Verdict */}
              <div className="rounded-2xl p-5 flex flex-col items-center justify-center col-span-2 sm:col-span-1" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(71,85,105,0.2)" }}>
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3">Verdict</span>
                <span className="text-2xl font-extrabold" style={{ color: data.status === "PASS" ? "#10b981" : data.status === "WARN" ? "#f59e0b" : "#ef4444" }}>{data.status}</span>
                <span className="text-xs text-slate-500 mt-2">ScapeGuard verdict</span>
              </div>
            </div>

            {/* Mock scan-report.json editor card */}
            <div 
              className="rounded-2xl p-6 font-mono text-xs text-slate-400"
              style={{ background: "#020617", border: "1px solid rgba(71,85,105,0.25)", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
            >
              <div className="flex justify-between items-center border-b border-slate-900 pb-3 mb-4">
                <span className="font-semibold text-slate-200">scan-report.json</span>
                <span 
                  className="px-2 py-0.5 border rounded text-[10px] font-bold"
                  style={{
                    background: `${gradeColor(data.grade)}11`,
                    borderColor: `${gradeColor(data.grade)}33`,
                    color: gradeColor(data.grade)
                  }}
                >
                  {data.grade} {data.status}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">"engine"</span>
                  <span className="text-sky-400">"scapeguard/2.1.0"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">"grade"</span>
                  <span style={{ color: gradeColor(data.grade) }} className="font-bold">"{data.grade}"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">"risk_score"</span>
                  <span className="text-amber-500">{data.risk_score}</span>
                </div>
                {(() => {
                  const defaultCategories = ["secrets", "prompt_injection", "malicious_execution", "supply_chain", "excessive_agency"];
                  const categoriesToRender = data.categories && data.categories.length > 0 
                    ? data.categories 
                    : defaultCategories.map(cat => {
                        let status = "PASS";
                        if (data.grade === "F" && (cat === "secrets" || cat === "prompt_injection")) status = "FAIL";
                        else if (["B", "C"].includes(data.grade) && cat === "prompt_injection") status = "WARN";
                        return { category: cat, status, findings: status === "PASS" ? 0 : 1 };
                      });
                  return categoriesToRender.map((c) => {
                    const catColor = c.status === "PASS" ? "text-emerald-400" : c.status === "WARN" ? "text-amber-400" : "text-rose-400";
                    return (
                      <div key={c.category} className="flex justify-between">
                        <span className="text-slate-500">"{c.category}"</span>
                        <span className={catColor}>"{c.status}"</span>
                      </div>
                    );
                  });
                })()}
                <div className="flex justify-between">
                  <span className="text-slate-500">"license"</span>
                  <span className="text-slate-200">"{data.license || "Unknown"}"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">"files_scanned"</span>
                  <span className="text-emerald-400">{data.files_analyzed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">"skill_hash"</span>
                  <span className="text-slate-500">"{data.last_git_sha ? data.last_git_sha.slice(0, 12) : "9f2ce41a"}"</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Findings table ─────────────────────────────────────────── */}
        {data && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Security Findings</SectionTitle>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Sort:</span>
                {(["severity", "rule", "file"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSortField(f)}
                    className="px-2.5 py-1 rounded-md font-semibold transition-colors"
                    style={{
                      background: sortField === f ? "rgba(124,58,237,0.15)" : "transparent",
                      border: sortField === f ? "1px solid rgba(124,58,237,0.35)" : "1px solid transparent",
                      color: sortField === f ? "#a78bfa" : "#64748b",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {sortedFindings.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="text-3xl mb-2">✓</div>
                <p className="text-emerald-400 font-semibold text-sm">No security findings detected</p>
                <p className="text-xs text-slate-500 mt-1">This repository is considered safe for agent installation.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(71,85,105,0.2)" }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(71,85,105,0.2)" }}>
                      {["Severity", "Rule", "Description", "Location"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-widest text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFindings.map((f, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => setExpandedFinding(expandedFinding === idx ? null : idx)}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: idx < sortedFindings.length - 1 ? "1px solid rgba(71,85,105,0.1)" : "none",
                            background: expandedFinding === idx ? "rgba(124,58,237,0.05)" : "transparent",
                          }}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${sevColor(f.severity)}15`, border: `1px solid ${sevColor(f.severity)}40`, color: sevColor(f.severity) }}>
                              {(f.severity || "").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{f.rule}</td>
                          <td className="px-4 py-3 text-xs text-slate-300 max-w-xs">
                            <span className="line-clamp-2">{f.message}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{f.file}{f.line ? `:${f.line}` : ""}</td>
                        </tr>
                        {expandedFinding === idx && (f.snippet || f.remediation) && (
                          <tr style={{ background: "rgba(8,13,20,0.8)", borderBottom: idx < sortedFindings.length - 1 ? "1px solid rgba(71,85,105,0.1)" : "none" }}>
                            <td colSpan={4} className="px-4 pb-3 pt-1">
                              {f.remediation && <p className="text-xs text-amber-400 mb-2 font-medium">💡 {f.remediation}</p>}
                              {f.snippet && (
                                <pre className="text-[10px] text-slate-400 overflow-x-auto leading-relaxed p-3 rounded-lg" style={{ background: "rgba(8,13,20,0.9)", border: "1px solid rgba(71,85,105,0.15)", maxHeight: 120 }}>
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
          </section>
        )}

        {/* ── Badge embed ────────────────────────────────────────────── */}
        {data && (
          <section className="mb-8">
            <SectionTitle>Add Badge to Your README</SectionTitle>
            <GlassCard>
              <p className="text-xs text-slate-400 mb-4">Display your ScapeGuard security grade directly in your repository README:</p>
              <div className="flex items-center gap-4 mb-4">
                <img src={`/api/badge/${owner}/${repo}`} alt={`ScapeGuard Grade ${data.grade}`} className="h-5" />
                <span className="text-xs text-slate-500">Preview</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg font-mono text-[11px] text-slate-400" style={{ background: "rgba(8,13,20,0.8)", border: "1px solid rgba(71,85,105,0.2)" }}>
                <code className="flex-grow overflow-x-auto">{`[![ScapeGuard Grade ${data.grade}](https://gitscape.ai/api/badge/${owner}/${repo})](${pageUrl})`}</code>
                <button
                  onClick={copyBadge}
                  className="ml-2 flex-shrink-0 px-3 py-1.5 rounded text-[10px] font-bold transition-colors"
                  style={{
                    background: copied ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.15)",
                    border: copied ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(124,58,237,0.35)",
                    color: copied ? "#34d399" : "#a78bfa",
                  }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </GlassCard>
          </section>
        )}

        {/* ── Install command ────────────────────────────────────────── */}
        {data && (
          <section className="mb-12">
            <SectionTitle>Install as Agent Skill</SectionTitle>
            <GlassCard>
              <p className="text-xs text-slate-400 mb-3">Run this one command to compile and install this repository as a skill in your AI agent workspace:</p>
              <div className="flex items-center gap-3 p-3 rounded-lg font-mono text-xs text-slate-300" style={{ background: "rgba(8,13,20,0.8)", border: "1px solid rgba(71,85,105,0.2)" }}>
                <span className="text-emerald-400 select-none">$</span>
                <code>npx gitscape {repoUrl}</code>
              </div>
            </GlassCard>
          </section>
        )}
      </div>
    </div>
  );
};
