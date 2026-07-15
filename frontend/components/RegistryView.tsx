import React, { useState, useEffect } from "react";
import { ScanFinding, ScanReport, SkillManifest } from "../types";

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
  freshness: string;
}

interface DetailPayload {
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
  categories: any[];
  skill_md: string;
  manifest: SkillManifest;
}

export const RegistryView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [query, setQuery] = useState<string>("");
  const [skills, setSkills] = useState<RegistrySkill[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [selectedSkillUrl, setSelectedSkillUrl] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"findings" | "skill_md" | "manifest">("findings");
  const [detailError, setDetailError] = useState<string | null>(null);

  // Helper to build API URL
  const getApiUrl = (routePath: string) => {
    const base = import.meta.env.VITE_API_URL || "";
    return `${base}/api${routePath}`;
  };

  const fetchList = async (searchVal: string) => {
    setLoadingList(true);
    try {
      const url = getApiUrl(`/registry/search${searchVal ? `?query=${encodeURIComponent(searchVal)}` : ""}`);
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setSkills(data);
      }
    } catch (e) {
      console.error("Failed to fetch registry list", e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchList("");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchList(query);
  };

  const handleSelectSkill = async (repoUrl: string) => {
    setSelectedSkillUrl(repoUrl);
    setLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    try {
      const url = getApiUrl(`/registry/detail?repo_url=${encodeURIComponent(repoUrl)}`);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to load details (HTTP ${resp.status})`);
      }
      const data = await resp.json();
      setDetail(data);
      setActiveTab("findings");
    } catch (e: any) {
      setDetailError(e.message || "An error occurred during dynamic compilation.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Compile on the fly for custom searches
  const handleCompileOnTheFly = () => {
    if (!query.startsWith("http://") && !query.startsWith("https://")) {
      alert("Please enter a valid GitHub repository URL in the search input first.");
      return;
    }
    handleSelectSkill(query);
  };

  const getGradeBg = (grade: string) => {
    if (grade === "A") return "bg-emerald-500/10 border-emerald-500/35 text-emerald-400";
    if (grade === "B") return "bg-lime-500/10 border-lime-500/35 text-lime-400";
    if (grade === "C") return "bg-amber-500/10 border-amber-500/35 text-amber-400";
    return "bg-rose-500/10 border-rose-500/35 text-rose-400";
  };

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-cyan-400">Public Agent Skill Registry</h2>
          <p className="text-xs text-slate-400">Search indexed skills, or type any GitHub URL to compile and scan on the fly.</p>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto min-w-[320px]">
          <input
            type="text"
            placeholder="Search or GitHub Repo URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow px-3.5 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-lg focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-bold rounded-lg transition-colors"
          >
            Search
          </button>
          {query.includes("github.com/") && (
            <button
              type="button"
              onClick={handleCompileOnTheFly}
              className="px-4 py-2 bg-cyan-950/80 border border-cyan-800 hover:border-cyan-600 text-xs font-bold text-cyan-400 rounded-lg transition-colors"
            >
              Compile &amp; Scan
            </button>
          )}
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
        {/* Left Side: Skills Catalog */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Available Skills</span>
          
          {loadingList ? (
            <div className="flex items-center justify-center py-20 bg-slate-950/20 border border-slate-900 rounded-xl">
              <span className="text-xs text-slate-500 animate-pulse">Loading catalog...</span>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-950/20 border border-slate-900 rounded-xl text-center px-4">
              <span className="text-xs text-slate-500 mb-2">No pre-indexed skills found for "{query}"</span>
              {query.includes("github.com/") && (
                <button
                  onClick={handleCompileOnTheFly}
                  className="px-3.5 py-1.5 bg-cyan-950/50 border border-cyan-900 hover:border-cyan-800 text-[11px] font-bold text-cyan-400 rounded-lg transition-colors"
                >
                  Compile this repository now
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {skills.map((skill) => (
                <a
                  key={skill.repo_url}
                  href={`/registry/${skill.owner}/${skill.repo}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedSkillUrl(skill.repo_url);
                    handleSelectSkill(skill.repo_url);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 block ${
                    selectedSkillUrl === skill.repo_url
                      ? "bg-slate-950/60 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.06)]"
                      : "bg-slate-950/30 border-slate-900 hover:border-slate-800 hover:bg-slate-950/40"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-semibold text-xs tracking-wide text-slate-200">
                      {skill.owner}/{skill.repo}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full ${getGradeBg(skill.grade)}`}>
                      Grade {skill.grade}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{skill.description}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>{skill.primary_languages.join(" · ")}</span>
                    <span>{skill.files_analyzed} files</span>
                  </div>
                  {skill.scanned_at && (
                    <div className="mt-1.5 text-[10px] text-slate-600">
                      Scanned {skill.scanned_at.slice(0, 10)}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] font-semibold text-cyan-500 hover:text-cyan-400">
                    View full report →
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Detailed Security Audit and Preview */}
        <div className="lg:col-span-7 bg-slate-950/40 border border-slate-900 rounded-2xl p-5 sm:p-6 flex flex-col">
          {loadingDetail ? (
            <div className="flex-grow flex flex-col items-center justify-center py-32">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
              <span className="text-xs text-slate-400">Compiling repository structure...</span>
              <span className="text-[10px] text-slate-500 mt-1">Downloading, performing static analysis, and running security audit.</span>
            </div>
          ) : detailError ? (
            <div className="flex-grow flex flex-col items-center justify-center py-32 px-6 text-center">
              <svg className="w-8 h-8 text-rose-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="text-xs font-semibold text-rose-400">Failed to compile skill</span>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[380px]">{detailError}</p>
            </div>
          ) : !detail ? (
            <div className="flex-grow flex flex-col items-center justify-center py-32 text-center">
              <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-6 6m0 0l-6-6m6 6V9a6 6 0 0112 0v3" />
              </svg>
              <span className="text-xs text-slate-500 font-semibold">Select a skill or enter a GitHub URL</span>
              <p className="text-[10px] text-slate-600 mt-1">Get audited security reports and pre-compiled workspace skill markdown.</p>
            </div>
          ) : (
            <div className="flex-grow flex flex-col gap-4">
              {/* Skill Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-4">
                <div>
                  <h3 className="font-bold text-sm tracking-wide text-slate-200">{detail.owner}/{detail.repo}</h3>
                  <a
                    href={detail.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-500 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    {detail.repo_url}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="flex gap-2">
                  <span className={`text-xs font-bold px-3 py-1 border rounded-lg ${getGradeBg(detail.grade)}`}>
                    Grade {detail.grade}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`npx gitscape ${detail.repo_url}`);
                      alert("CLI command copied to clipboard!");
                    }}
                    className="px-3 py-1 bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:border-slate-600 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy command
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-900">
                {[
                  { key: "findings", label: `Audit Report (${detail.findings.length})` },
                  { key: "skill_md", label: "SKILL.md Preview" },
                  { key: "manifest", label: "Provenance JSON" }
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as any)}
                    className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === t.key
                        ? "border-cyan-500 text-cyan-400"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-grow max-h-[360px] overflow-y-auto pr-1">
                {activeTab === "findings" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      <span>ScapeGuard Verdict: <strong>{detail.status}</strong></span>
                      <span>Risk Score: <strong>{detail.risk_score}</strong></span>
                    </div>

                    {detail.findings.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        ✓ No vulnerabilities or prompt injections found. This skill is safe to load.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {detail.findings.map((f, idx) => (
                          <div key={idx} className="p-3 bg-slate-950/60 border border-slate-900 rounded-lg flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">
                                [{f.severity}] {f.rule}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {f.file}{f.line ? `:${f.line}` : ""}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{f.message}</p>
                            {f.snippet && (
                              <pre className="text-[10px] bg-slate-950 p-2 rounded border border-slate-900/60 overflow-x-auto text-slate-400 max-h-[80px]">
                                <code>{f.snippet}</code>
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "skill_md" && (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {detail.skill_md}
                  </div>
                )}

                {activeTab === "manifest" && (
                  <pre className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 text-[10px] text-slate-400 font-mono overflow-x-auto leading-normal">
                    {JSON.stringify(detail.manifest, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
