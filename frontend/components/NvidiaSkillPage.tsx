// Author: Joao Machete
// Description: NVIDIA Curated Skill landing page — dedicated SEO page for each
// NVIDIA/skills entry. Renders taxonomy metadata (domain, audience, subdomain),
// ScapeGuard security grade, findings summary, and structured data for Google.
// Route: /registry/nvidia/{skill-slug}
import React, { useState, useEffect } from "react";
import {
  gradeInfo,
  statusColor,
  glassStyle,
  Eyebrow,
  GradeSeal,
  StatusChip,
  SevPill,
} from "./registryTheme";
import { ScanFinding, CategoryResult } from "../types";

interface NvidiaSkillData {
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
  findings_count?: number;
  findings?: ScanFinding[];
  categories?: CategoryResult[];
  scanned_at?: string;
  stars?: number;
  forks?: number;
  license?: string;
  ai_summary?: string;
  nvidia_domain?: string[];
  nvidia_audience?: string[];
  nvidia_skill_name?: string;
  nvidia_skill_url?: string;
  nvidia_subdomain?: string;
  source?: string;
}

interface NvidiaSkillPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

const RISK_BAR_MAX = 60;

const getApiUrl = (p: string) => {
  const base = (import.meta as any).env?.VITE_API_URL || "";
  return `${base}/api${p}`;
};

const CAT_LABEL: Record<string, string> = {
  secrets: "Secrets & Credentials",
  prompt_injection: "Prompt Injection",
  malicious_execution: "Malicious Execution",
  supply_chain: "Supply Chain",
  excessive_agency: "Excessive Agency",
};

const DomainChip: React.FC<{ label: string }> = ({ label }) => (
  <span
    className="inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-mono font-medium"
    style={{
      background: "rgba(124,58,237,0.1)",
      border: "1px solid rgba(124,58,237,0.3)",
      color: "#c4b5fd",
    }}
  >
    {label}
  </span>
);

const AudienceChip: React.FC<{ label: string }> = ({ label }) => (
  <span
    className="inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-mono font-medium"
    style={{
      background: "rgba(16,185,129,0.08)",
      border: "1px solid rgba(16,185,129,0.25)",
      color: "#6ee7b7",
    }}
  >
    {label}
  </span>
);

const SkeletonCard: React.FC<{ h?: number }> = ({ h = 120 }) => (
  <div className="rounded-2xl animate-pulse" style={{ ...glassStyle, height: h }} />
);

const RiskBar: React.FC<{ risk: number; grade: string; wide?: boolean }> = ({ risk, grade, wide }) => {
  const g = gradeInfo(grade);
  return (
    <div className={`flex items-center gap-3 ${wide ? "w-full" : ""}`}>
      <div
        className="rounded-sm overflow-hidden flex-shrink-0"
        style={{ width: wide ? "100%" : 80, height: 6, background: "rgba(30,41,59,0.9)" }}
      >
        <div
          style={{
            width: `${Math.min(100, (risk / RISK_BAR_MAX) * 100)}%`,
            height: "100%",
            background: g.hex,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span className="font-mono text-[11px] text-slate-400 tabular-nums flex-shrink-0">
        {risk} / {RISK_BAR_MAX}
      </span>
    </div>
  );
};

function injectSeoMeta(skill: NvidiaSkillData) {
  const title = `${skill.nvidia_skill_name || skill.repo} — NVIDIA AI Skill Security Audit | GitScape AI`;
  const domains = (skill.nvidia_domain || []).join(", ");
  const grade = skill.grade || "?";
  const findings = skill.findings_count ?? (skill.findings?.length ?? 0);
  const langs = (skill.primary_languages || []).join(", ");

  const desc =
    `${skill.nvidia_skill_name || skill.repo} is an NVIDIA-curated AI agent skill` +
    (domains ? ` in ${domains}` : "") +
    `. ScapeGuard security grade: ${grade}` +
    (findings > 0 ? ` with ${findings} finding${findings !== 1 ? "s" : ""}` : ", no findings detected") +
    (langs ? ` · Languages: ${langs}` : "") +
    `. View the full security audit on GitScape AI.`;

  const slug = (skill.nvidia_skill_name || skill.repo).toLowerCase().replace(/[\s_]+/g, "-");
  const pageUrl = `https://gitscape.ai/registry/nvidia/${slug}`;

  document.title = title;

  const setMeta = (name: string, content: string, prop = false) => {
    const attr = prop ? "property" : "name";
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.content = content;
  };

  setMeta("description", desc);
  setMeta("robots", "index, follow, max-snippet:200, max-image-preview:large");
  setMeta("og:title", title, true);
  setMeta("og:description", desc, true);
  setMeta("og:url", pageUrl, true);
  setMeta("og:type", "website", true);
  setMeta("og:site_name", "GitScape AI", true);
  setMeta("twitter:card", "summary");
  setMeta("twitter:title", title);
  setMeta("twitter:description", desc);

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  canonical.href = pageUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": pageUrl,
    name: skill.nvidia_skill_name || `${skill.owner}/${skill.repo}`,
    url: skill.nvidia_skill_url || `https://github.com/${skill.owner}/${skill.repo}`,
    description: skill.description,
    applicationCategory: "DeveloperApplication",
    creator: { "@type": "Organization", name: "NVIDIA" },
    review: {
      "@type": "Review",
      author: { "@type": "Organization", name: "GitScape AI ScapeGuard" },
      reviewBody: desc,
      reviewRating: {
        "@type": "Rating",
        ratingValue: ({ A: "5", B: "4", C: "3" } as Record<string, string>)[grade] || "1",
        bestRating: "5",
        worstRating: "1",
      },
      datePublished: skill.scanned_at?.slice(0, 10) || "",
    },
    keywords: [...(skill.nvidia_domain || []), ...(skill.nvidia_audience || [])].join(", "),
  };

  let ldScript = document.querySelector('script[data-scape="nvidia-skill"]') as HTMLScriptElement | null;
  if (!ldScript) { ldScript = document.createElement("script"); ldScript.type = "application/ld+json"; ldScript.setAttribute("data-scape", "nvidia-skill"); document.head.appendChild(ldScript); }
  ldScript.text = JSON.stringify(jsonLd, null, 2);
}

export const NvidiaSkillPage: React.FC<NvidiaSkillPageProps> = ({ slug, onNavigate }) => {
  const [data, setData] = useState<NvidiaSkillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(getApiUrl(`/registry/nvidia/${slug}`))
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Skill not yet indexed" : "Failed to load skill");
        return r.json();
      })
      .then((d) => { setData(d); injectSeoMeta(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const goToFullReport = () => { if (data) onNavigate(`/registry/${data.owner}/${data.repo}`); };
  const goToRegistry = () => onNavigate("/registry");

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#0b1120" }}>
        <div className="max-w-[1060px] mx-auto px-4 sm:px-7 pt-10 pb-16 space-y-6">
          <SkeletonCard h={220} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i => <SkeletonCard key={i} h={110} />)}</div>
          <SkeletonCard h={300} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
        <div className="text-center max-w-md px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-3">Skill Not Yet Indexed</h1>
          <p className="text-slate-400 text-sm mb-6">{error || "This NVIDIA skill has not been scanned yet."}</p>
          <button onClick={goToRegistry} className="inline-flex items-center rounded-lg text-sm font-semibold px-5 py-2.5"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", color: "#c4b5fd" }}>
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  const g = gradeInfo(data.grade);
  const findings = data.findings_count ?? (data.findings?.length ?? 0);
  const langs = (data.primary_languages || []).join(" · ");
  const scannedDate = data.scanned_at ? data.scanned_at.slice(0, 10) : null;
  const categories = data.categories || [];

  return (
    <div className="min-h-screen" style={{ background: "#0b1120" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{
        background: "linear-gradient(135deg,rgba(124,58,237,0.10) 0%,rgba(16,185,129,0.04) 60%,rgba(6,182,212,0.04) 100%)",
        borderBottom: "1px solid rgba(71,85,105,0.2)",
      }}>
        <div style={{ position:"absolute",top:-60,right:-60,width:380,height:380,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.14),transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:-40,left:100,width:260,height:260,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.07),transparent 70%)",pointerEvents:"none" }} />

        <div className="max-w-[1060px] mx-auto px-4 sm:px-7 pt-10 pb-9 relative">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[11.5px] font-mono text-slate-500 mb-6">
            <button onClick={goToRegistry} className="hover:text-slate-300 transition-colors">Registry</button>
            <span>/</span>
            <span style={{ color: "#76a9fa" }}>NVIDIA</span>
            <span>/</span>
            <span className="text-slate-300 truncate">{data.nvidia_skill_name || data.repo}</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left */}
            <div className="flex-1 min-w-0">
              {/* NVIDIA badge */}
              <div className="inline-flex items-center gap-2 mb-4 rounded-full px-3 py-1"
                style={{ background:"rgba(118,233,0,0.08)", border:"1px solid rgba(118,233,0,0.22)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#76e900" style={{ flexShrink:0 }}><polygon points="12,2 22,20 2,20" /></svg>
                <span className="font-mono text-[10.5px] tracking-[0.08em] font-semibold uppercase" style={{ color:"#76e900" }}>NVIDIA Curated Skill</span>
              </div>

              <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-100 mb-3 leading-tight" style={{ letterSpacing:"-0.8px" }}>
                {data.nvidia_skill_name || data.repo}
              </h1>
              <p className="text-[14.5px] text-slate-400 max-w-[62ch] mb-5 leading-relaxed">{data.description}</p>

              {/* Taxonomy chips */}
              <div className="flex flex-wrap gap-2 mb-5">
                {(data.nvidia_domain||[]).map(d => <DomainChip key={d} label={d} />)}
                {(data.nvidia_audience||[]).map(a => <AudienceChip key={a} label={a} />)}
                {data.nvidia_subdomain && (
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-mono font-medium"
                    style={{ background:"rgba(6,182,212,0.07)", border:"1px solid rgba(6,182,212,0.2)", color:"#67e8f9" }}>
                    {data.nvidia_subdomain}
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 mb-6">
                {langs && <span>{langs}</span>}
                {langs && <span>·</span>}
                <span>{(data.files_analyzed||0).toLocaleString()} files</span>
                {data.stars ? <><span>·</span><span>⭐ {data.stars.toLocaleString()}</span></> : null}
                {scannedDate && <><span>·</span><span>Scanned {scannedDate}</span></>}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <button onClick={goToFullReport} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
                  style={{ background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"#fff" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Full Security Report
                </button>
                {data.nvidia_skill_url && (
                  <a href={data.nvidia_skill_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
                    style={{ background:"rgba(30,41,59,0.7)", border:"1px solid rgba(71,85,105,0.4)", color:"#94a3b8" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    View on NVIDIA
                  </a>
                )}
                <a href={`https://github.com/${data.owner}/${data.repo}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
                  style={{ background:"rgba(30,41,59,0.5)", border:"1px solid rgba(71,85,105,0.35)", color:"#64748b" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" /></svg>
                  GitHub
                </a>
              </div>
            </div>

            {/* Right: grade certificate */}
            <div className="flex-shrink-0 rounded-2xl overflow-hidden" style={{ ...glassStyle, width:240, minWidth:220 }}>
              <div className="flex flex-col items-center px-6 py-7 gap-3">
                <Eyebrow>ScapeGuard Grade</Eyebrow>
                <GradeSeal grade={data.grade} size={88} />
                <StatusChip status={data.status} />
                <div className="w-full mt-2">
                  <Eyebrow>Risk Score</Eyebrow>
                  <div className="mt-2"><RiskBar risk={data.risk_score} grade={data.grade} wide /></div>
                </div>
                <div className="w-full pt-3 mt-1" style={{ borderTop:"1px solid rgba(71,85,105,0.2)" }}>
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Findings</span><span className="text-slate-300">{findings}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
                    <span>Files</span><span className="text-slate-300">{(data.files_analyzed||0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-[1060px] mx-auto px-4 sm:px-7 py-10 space-y-8">

        {/* AI Summary */}
        {data.ai_summary && (
          <div className="rounded-2xl px-6 py-5" style={glassStyle}>
            <Eyebrow>AI Security Summary</Eyebrow>
            <p className="mt-2 text-[14px] text-slate-400 leading-relaxed italic">&ldquo;{data.ai_summary}&rdquo;</p>
          </div>
        )}

        {/* Gate Categories */}
        {categories.length > 0 && (
          <div>
            <h2 className="text-[13px] font-semibold text-slate-300 tracking-[0.04em] uppercase mb-4">Gate Category Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const isPass = cat.status === "PASS", isWarn = cat.status === "WARN";
                const borderColor = isPass ? "rgba(16,185,129,0.25)" : isWarn ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.3)";
                const dotColor = isPass ? "#10b981" : isWarn ? "#f59e0b" : "#ef4444";
                return (
                  <div key={cat.category} className="rounded-xl px-4 py-3.5 flex items-center justify-between gap-3"
                    style={{ ...glassStyle, borderColor }}>
                    <span className="text-[13px] text-slate-300">{CAT_LABEL[cat.category] || cat.category}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <i style={{ width:6,height:6,borderRadius:"50%",background:dotColor,display:"inline-block" }} />
                      <span className="font-mono text-[10.5px] font-semibold" style={{ color:dotColor }}>{cat.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Findings */}
        {data.findings && data.findings.length > 0 && (
          <div>
            <h2 className="text-[13px] font-semibold text-slate-300 tracking-[0.04em] uppercase mb-4">
              Security Findings ({data.findings.length})
            </h2>
            <div className="rounded-2xl overflow-hidden" style={glassStyle}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr style={{ background:"rgba(30,41,59,0.6)", borderBottom:"1px solid rgba(71,85,105,0.3)" }}>
                      {["Severity","Rule","Message","Location"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.findings.slice(0,20).map((f,i) => (
                      <tr key={i} style={{ borderBottom: i < data.findings!.length-1 ? "1px solid rgba(71,85,105,0.15)" : "none" }}>
                        <td className="px-4 py-3"><SevPill sev={f.severity} /></td>
                        <td className="px-4 py-3 font-mono text-[11.5px] text-slate-400">{f.rule}</td>
                        <td className="px-4 py-3 text-[12.5px] text-slate-300 max-w-[280px]">{f.message?.slice(0,180)}</td>
                        <td className="px-4 py-3 font-mono text-[10.5px] text-slate-500">
                          {f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No findings */}
        {findings === 0 && (
          <div className="rounded-2xl flex items-center gap-4 px-6 py-5"
            style={{ ...glassStyle, borderColor:"rgba(16,185,129,0.3)" }}>
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background:"rgba(16,185,129,0.12)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[14px] text-emerald-400">No Security Findings</p>
              <p className="text-[12.5px] text-slate-500 mt-0.5">ScapeGuard found no issues across {data.files_analyzed} analyzed files.</p>
            </div>
          </div>
        )}

        {/* NVIDIA Taxonomy */}
        <div className="rounded-2xl px-6 py-5" style={glassStyle}>
          <h2 className="text-[13px] font-semibold text-slate-300 tracking-[0.04em] uppercase mb-4">NVIDIA Skill Taxonomy</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            {[
              { label:"Skill Name", value: data.nvidia_skill_name },
              { label:"Subdomain",  value: data.nvidia_subdomain },
              { label:"Domain",     value: (data.nvidia_domain||[]).join(", ") },
              { label:"Audience",   value: (data.nvidia_audience||[]).join(", ") },
              { label:"GitHub Repo",value: `${data.owner}/${data.repo}` },
              { label:"Source",     value: "NVIDIA/skills" },
            ].map(({ label, value }) =>
              value ? (
                <div key={label}>
                  <dt className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-slate-500 mb-1">{label}</dt>
                  <dd className="text-[13px] text-slate-300">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </div>

        {/* CTA footer */}
        <div className="rounded-2xl px-6 py-8 text-center" style={{
          background:"linear-gradient(135deg,rgba(124,58,237,0.07) 0%,rgba(6,182,212,0.04) 100%)",
          border:"1px solid rgba(124,58,237,0.18)",
        }}>
          <Eyebrow>ScapeGuard · Security-Audited AI Skills</Eyebrow>
          <h3 className="text-xl font-bold text-slate-100 mt-2 mb-2">Browse all 229 NVIDIA-curated skills</h3>
          <p className="text-[13.5px] text-slate-400 mb-6 max-w-[52ch] mx-auto">
            Every skill indexed, every grade earned. The GitScape Public Registry covers all 229 NVIDIA agent
            skills plus thousands of community repositories.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={goToRegistry} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
              style={{ background:"rgba(30,41,59,0.8)", border:"1px solid rgba(71,85,105,0.4)", color:"#94a3b8" }}>
              Back to Registry
            </button>
            <button onClick={goToFullReport} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
              style={{ background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"#fff" }}>
              Full Security Report
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
