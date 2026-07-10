import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { ScanReport, ScanStatus, SkillManifest, SkillReferences } from "../types";
import { CodeSnippet } from "./CodeSnippet";
import { STATUS_STYLES, computeBypassable } from "./ScanBadge";

interface SkillExportProps {
  skillMd: string;
  manifestJson: SkillManifest | null;
  scanReport: ScanReport | null;
  references: SkillReferences | null;
  repoUrl: string;
  repoNameForFilename: string | null;
  githubToken?: string | null;
  digest: string;

  // Cached framework skill props
  frameworkSkillMd?: string | null;
  frameworkManifest?: SkillManifest | null;
  frameworkScanReport?: ScanReport | null;
  frameworkReferences?: SkillReferences | null;
  onFrameworkSkillGenerated?: (
    skillMd: string,
    manifest: SkillManifest | null,
    scanReport: ScanReport | null,
    references: SkillReferences | null
  ) => void;
  onSwitchToSecurity?: () => void;
  onSwitchToDigest?: () => void;
}


// API calls use a relative /api/* base — nginx proxies to the FastAPI sidecar in production,
// and the Vite dev server proxies to http://localhost:8081 in development.
const API_BASE = '/api';

function ownerRepoFromUrl(repoUrl: string, fallback: string | null): { owner: string; repo: string } {
  const parts = repoUrl.replace(/\.git$/, "").split("/").filter(Boolean);
  return {
    owner: parts[parts.length - 2] ?? "",
    repo: parts[parts.length - 1] ?? (fallback ?? "repo"),
  };
}

// ─── Minimal inline scan chip (full report lives in the Security tab) ─────

const ScanChip: React.FC<{ report: ScanReport; onViewDetails?: () => void }> = ({ report, onViewDetails }) => {
  const style = STATUS_STYLES[report.status];
  return (
    <button
      onClick={onViewDetails}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:brightness-110 ${style.chip}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <span className="text-xs font-semibold">{style.label}</span>
      <span className="text-[10px] font-mono opacity-70">
        {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
      </span>
      {onViewDetails && (
        <span className="text-[10px] opacity-60 ml-1">View details →</span>
      )}
    </button>
  );
};


const preprocessMarkdown = (content: string): { frontmatter: { name: string; description: string } | null; content: string } => {
  if (!content) return { frontmatter: null, content: "" };

  let processed = content;
  let frontmatter: { name: string; description: string } | null = null;

  // 1. Handle YAML Frontmatter
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = processed.match(frontmatterRegex);
  if (match) {
    const yamlStr = match[1];
    const result: Record<string, string> = {};
    const lines = yamlStr.split(/\r?\n/);
    let currentKey = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const keyValMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (keyValMatch) {
        currentKey = keyValMatch[1];
        let val = keyValMatch[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[currentKey] = val;
      } else if (currentKey) {
        let val = trimmed;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[currentKey] = (result[currentKey] || "") + " " + val;
      }
    }

    const name = result['name'] || '';
    const description = result['description'] || '';

    if (name || description) {
      frontmatter = { name, description };
      processed = processed.replace(frontmatterRegex, "");
    }
  }

  // 2. Handle HTML tags translation
  processed = processed
    // Convert breaks to newlines
    .replace(/<\/?br\s*\/?>/gi, "\n")
    // Convert bold/strong
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    // Convert italics/emphasis
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    // Convert inline code blocks
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    // Convert anchors/links (e.g., <a href="...">text</a>)
    .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    // Convert paragraph tags to newlines
    .replace(/<\/?p>/gi, "\n");

  return { frontmatter, content: processed };
};

// ─── Main component ─────────────────────────────────────────────────────────────────────────

export const SkillExport: React.FC<SkillExportProps> = ({
  skillMd,
  manifestJson,
  scanReport,
  references,
  repoUrl,
  repoNameForFilename,
  githubToken: _githubToken,
  digest,
  frameworkSkillMd,
  frameworkManifest,
  frameworkScanReport,
  frameworkReferences,
  onFrameworkSkillGenerated,
  onSwitchToSecurity,
  onSwitchToDigest,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [warnAccepted, setWarnAccepted] = useState(false);

  // Engineering Skill state
  const [frameworkLoading, setFrameworkLoading] = useState(false);
  const [frameworkError, setFrameworkError] = useState<string | null>(null);

  // A report attached when a download is rejected by the server gate (422)
  const [blockedReport, setBlockedReport] = useState<ScanReport | null>(null);
  // Server's authoritative bypassable verdict (null until a 422 tells us)
  const [serverBypassable, setServerBypassable] = useState<boolean | null>(null);
  const [copyBadgeState, setCopyBadgeState] = useState<"idle" | "copied">("idle");

  // Engineering Skill is always the display — falls back to the initial Code Skill preview while generating
  const displaySkillMd = frameworkSkillMd ?? skillMd;
  const displayReferences = (frameworkReferences ?? references) ?? {};
  const displayScan = blockedReport ?? frameworkScanReport ?? scanReport;
  const displayManifest = frameworkManifest ?? manifestJson;

  const summaryTitle =
    displayManifest?.metadata?.summary_title ||
    displayManifest?.description ||
    null;
  const summaryBullets: string[] =
    displayManifest?.metadata?.summary_bullets?.length
      ? displayManifest.metadata.summary_bullets
      : displayManifest
      ? [
          `Specialist guidelines for working in the ${displayManifest.display_name || displayManifest.name} codebase.`,
          `Covers ${displayManifest.metadata?.files_analyzed ?? "—"} source files across ${displayManifest.metadata?.primary_languages?.join(", ") || "multiple languages"}.`,
          "Adherence to repository structure, architecture, and testing patterns.",
          "Follow established conventions before modifying any core logic.",
        ]
      : [];

  const status: ScanStatus | null = displayScan?.status ?? null;
  const bypassable = serverBypassable !== null ? serverBypassable : computeBypassable(displayScan);
  const hardBlocked = status === "FAIL" && !bypassable;
  const showAcceptCheckbox = status === "WARN" || (status === "FAIL" && bypassable);
  const needsAccept = showAcceptCheckbox && !warnAccepted;

  const fileNames = useMemo(() => ["SKILL.md", ...Object.keys(displayReferences)], [displayReferences]);
  const [selectedFile, setSelectedFile] = useState<string>("SKILL.md");
  const selectedContent = selectedFile === "SKILL.md" ? displaySkillMd : (displayReferences[selectedFile] ?? "");

  const { isTruncated, previewContent, totalLines, displayedLines, totalChars } = useMemo(() => {
    if (!selectedContent) {
      return { isTruncated: false, previewContent: "", totalLines: 0, displayedLines: 0, totalChars: 0 };
    }
    const totalChars = selectedContent.length;
    const CHAR_LIMIT = 100000;
    const LINE_LIMIT = 1000;

    let truncatedByChars = false;
    let contentToProcess = selectedContent;
    if (totalChars > CHAR_LIMIT) {
      contentToProcess = selectedContent.slice(0, CHAR_LIMIT);
      truncatedByChars = true;
    }

    const lines = contentToProcess.split("\n");
    const hasLineLimitExceeded = lines.length > LINE_LIMIT;

    if (hasLineLimitExceeded || truncatedByChars) {
      let totalLinesCount = 0;
      for (let i = 0; i < selectedContent.length; i++) {
        if (selectedContent[i] === "\n") totalLinesCount++;
      }
      totalLinesCount++;

      let preview = contentToProcess;
      let displayedCount = lines.length;

      if (hasLineLimitExceeded) {
        preview = lines.slice(0, LINE_LIMIT).join("\n");
        displayedCount = LINE_LIMIT;
      }

      return {
        isTruncated: true,
        previewContent: preview,
        totalLines: totalLinesCount,
        displayedLines: displayedCount,
        totalChars
      };
    }

    return {
      isTruncated: false,
      previewContent: selectedContent,
      totalLines: lines.length,
      displayedLines: lines.length,
      totalChars
    };
  }, [selectedContent]);

  const languageList = manifestJson?.metadata?.primary_languages?.join(", ") ?? "—";
  const filesAnalyzed = manifestJson?.metadata?.files_analyzed ?? "—";
  const symbols = manifestJson?.metadata?.symbols_indexed;
  const generatedAt = manifestJson?.metadata?.generated_at
    ? new Date(manifestJson.metadata.generated_at).toLocaleString()
    : "—";

  const requestBody = useCallback(() => {
    const { owner, repo } = ownerRepoFromUrl(repoUrl, repoNameForFilename);
    return {
      repo_url: repoUrl,
      owner,
      repo,
      digest_md: digest,
      languages: manifestJson?.metadata?.primary_languages ?? [],
      files_analyzed: manifestJson?.metadata?.files_analyzed ?? 0,
      // Only ever request a bypass for a genuinely bypassable FAIL. An
      // unbypassable critical is blocked server-side regardless.
      bypass_scan_gate: status === "FAIL" && warnAccepted && bypassable,
      skill_type: "framework",
    };
  }, [repoUrl, repoNameForFilename, digest, manifestJson, status, warnAccepted, bypassable]);

  // ── Handlers ──────────────────────────────────────────────────────────────────────────────

  const handleDownloadZip = useCallback(async () => {
    if (!repoUrl || !digest || needsAccept || hardBlocked) return;
    setIsDownloading(true);
    setDownloadError(null);
    setBlockedReport(null);
    try {
      const { repo } = ownerRepoFromUrl(repoUrl, repoNameForFilename);
      const response = await fetch(`${API_BASE}/skill-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody()),
      });
      if (response.status === 422) {
        const detail = (await response.json())?.detail;
        if (detail?.scan_report) setBlockedReport(detail.scan_report);
        if (typeof detail?.bypassable === "boolean") setServerBypassable(detail.bypassable);
        throw new Error(
          detail?.bypassable === false
            ? "Export blocked: critical security findings. This skill cannot be packaged."
            : "Export blocked by the security scan."
        );
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${repo}-skill.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      setDownloadError(err.message ?? "Download failed.");
    } finally {
      setIsDownloading(false);
    }
  }, [repoUrl, repoNameForFilename, digest, needsAccept, hardBlocked, requestBody]);

  const handleGenerateFramework = useCallback(async () => {
    if (!digest) return;
    setFrameworkLoading(true);
    setFrameworkError(null);
    try {
      const response = await fetch(`${API_BASE}/skill/framework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody(), skill_type: "framework" }),
      });
      if (response.status === 503) throw new Error("Engineering Skill requires the Gemini API key on this server.");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (onFrameworkSkillGenerated) {
        onFrameworkSkillGenerated(
          data.skill_md ?? "",
          data.manifest ?? null,
          data.scan_report ?? null,
          data.references ?? {}
        );
      }
      setWarnAccepted(false);
      setBlockedReport(null);
      setServerBypassable(null);
    } catch (err: any) {
      setFrameworkError(err.message ?? "Engineering Skill generation failed.");
    } finally {
      setFrameworkLoading(false);
    }
  }, [digest, requestBody, onFrameworkSkillGenerated]);

  // Reset frameworkError when digest changes
  useEffect(() => {
    setFrameworkError(null);
  }, [digest]);

  // Auto-generate Engineering Skill as soon as a digest is available
  useEffect(() => {
    if (digest && frameworkSkillMd == null && !frameworkLoading && !frameworkError) {
      handleGenerateFramework();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest, frameworkSkillMd, frameworkLoading, frameworkError, handleGenerateFramework]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedContent);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (_) { /* clipboard unavailable */ }
  }, [selectedContent]);

  const handleCopyBadge = useCallback(async () => {
    // A static shields.io badge linking back to GitScape — no storage infra needed.
    const label = status === "PASS" ? "passed" : status === "WARN" ? "warnings" : "review";
    const color = status === "PASS" ? "brightgreen" : status === "WARN" ? "yellow" : "red";
    const badge =
      `[![Scanned by ScapeGuard](https://img.shields.io/badge/ScapeGuard-${label}-${color}?logo=shield)]` +
      `(https://gitscape.ai)`;
    try {
      await navigator.clipboard.writeText(badge);
      setCopyBadgeState("copied");
      setTimeout(() => setCopyBadgeState("idle"), 2000);
    } catch (_) { /* clipboard unavailable */ }
  }, [status]);


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Metadata pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-full font-mono">{generatedAt}</span>
        <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-full">{filesAnalyzed} files</span>
        {typeof symbols === "number" && (
          <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-full">{symbols} symbols</span>
        )}
        {languageList !== "—" && (
          <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-full">{languageList}</span>
        )}
        <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-full font-mono text-[10px] tracking-wide">agentskills.io v1.0</span>
      </div>

      {/* Summary Box — only after Engineering Skill is fully generated */}
      {frameworkSkillMd && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-5 flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SUMMARY</span>
          {summaryTitle && (
            <p className="text-xs font-semibold text-slate-200 leading-relaxed">
              {summaryTitle}
            </p>
          )}
          {summaryBullets.length > 0 && (
            <ul className="list-disc pl-4 space-y-2 text-xs text-slate-400">
              {summaryBullets.map((bullet, idx) => (
                <li key={idx} className="leading-relaxed pl-1 marker:text-violet-500">
                  {bullet.replace(/^\s*-\s*/, "")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}





      {/* First-time generation loading state */}
      {frameworkLoading && frameworkSkillMd == null && (
        <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 px-4 py-5 flex items-center gap-3">
          <svg className="w-4 h-4 animate-spin text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <div>
            <p className="text-xs font-semibold text-violet-300">Generating Engineering Skill…</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Gemini is analysing your repository and producing all 6 canonical sections.</p>
          </div>
        </div>
      )}

      {/* Error states */}
      {frameworkError && frameworkSkillMd == null && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-400">{frameworkError}</p>
          <button
            onClick={handleGenerateFramework}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-300 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {frameworkError && frameworkSkillMd != null && (
        <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/40 px-3 py-2 rounded-lg">{frameworkError}</p>
      )}


      {/* Inline scan status — full report in the Security tab */}
      {displayScan && <ScanChip report={displayScan} onViewDetails={onSwitchToSecurity} />}

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          id="skill-download-zip-btn"
          onClick={handleDownloadZip}
          disabled={isDownloading || needsAccept || hardBlocked}
          title={
            hardBlocked
              ? "Critical security findings — this skill cannot be packaged."
              : needsAccept
              ? "Accept the security findings to enable download."
              : undefined
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-400 text-black text-sm font-semibold transition-all duration-150 shadow-md disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Packaging…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download .zip</>
          )}
        </button>

        <button
          onClick={handleCopy}
          id="skill-copy-btn"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border ${copyState === "copied"
            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100"}`}
        >
          {copyState === "copied" ? "Copied!" : `Copy ${selectedFile}`}
        </button>

        <button
          onClick={handleCopyBadge}
          id="skill-copy-badge-btn"
          title="Copy a Markdown badge for your README"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border ${copyBadgeState === "copied"
            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100"}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          {copyBadgeState === "copied" ? "Badge copied!" : "Copy badge"}
        </button>

        {showAcceptCheckbox && (
          <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
            <input type="checkbox" checked={warnAccepted} onChange={(e) => setWarnAccepted(e.target.checked)} className="accent-amber-500" />
            {status === "FAIL" ? "I accept the security risks and want to download anyway" : "I accept the warnings"}
          </label>
        )}
      </div>

      {repoUrl && !hardBlocked && (
        <div
          className="rounded-xl px-4 py-3.5 flex flex-col gap-2"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <p className="text-xs font-semibold text-amber-300 m-0">
            Install this skill straight into your project
          </p>
          <CodeSnippet compact prompt accent="amber" code={`npx gitscape ${repoUrl}`} />
          <p className="text-[11px] text-slate-500 m-0">
            Runs the same compile + ScapeGuard scan, writes the files into
            <span className="font-mono text-slate-400"> .agents/skills/</span> and registers them in your AGENTS.md.
          </p>
        </div>
      )}

      {hardBlocked && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">
          <span className="font-semibold">Export blocked.</span> ScapeGuard found a critical threat
          (a live credential, remote-code-execution payload, or known exfiltration endpoint). Skills
          with active-payload critical findings can never be packaged — review the findings above.
        </p>
      )}
      {status === "FAIL" && bypassable && !warnAccepted && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">
          Download is restricted because the security scan returned <span className="font-semibold">FAIL</span>. Review the findings above — you must accept the security risks below to enable the download anyway.
        </p>
      )}
      {downloadError && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 px-3 py-2 rounded-lg">{downloadError}</p>
      )}

      <p className="text-[11px] text-slate-500">
        The <span className="text-slate-400 font-medium">.zip</span> contains a slim <span className="text-slate-400 font-medium">SKILL.md</span>, the full source code digest, a <span className="text-slate-400 font-medium">references/</span> folder, ADK/Agno exporters, a provenance-stamped <span className="text-slate-400 font-medium">manifest.json</span>, and its full ScapeGuard audit as <span className="text-slate-400 font-medium">scan-report.json</span> + <span className="text-slate-400 font-medium">scan-report.sarif</span>.
      </p>

      {/* File selector */}
      <div className="flex flex-wrap gap-1.5">
        {fileNames.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedFile(name)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${selectedFile === name
              ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
              : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"}`}
          >
            {name.replace(/^references\//, "")}
          </button>
        ))}
      </div>

      {/* File viewer */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 min-h-[360px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-700/60 z-10 backdrop-blur-sm shrink-0">
          <span className="font-mono text-xs text-slate-400">{selectedFile}</span>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
        </div>
        {isTruncated && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-[11px] flex flex-wrap items-center justify-between gap-1.5 z-10 shrink-0">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>
                Large file truncated for performance. Showing first {displayedLines.toLocaleString()} of {totalLines.toLocaleString()} lines ({((previewContent.length / totalChars) * 100).toFixed(1)}% of characters).
              </span>
            </span>
            <span className="opacity-80">Use "Copy" or download ZIP for full content.</span>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {previewContent ? (
            selectedFile.endsWith(".md") ? (() => {
              const { frontmatter, content } = preprocessMarkdown(previewContent);
              return (
                <div className="p-5 prose-skill">
                  {frontmatter && (
                    <div className="mb-6 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
                      <table className="w-full text-xs text-left border-collapse">
                        <tbody>
                          <tr className="border-b border-slate-700/60">
                            <th className="px-4 py-3 font-semibold text-slate-300 bg-slate-800/40 w-1/5 border-r border-slate-700/60 whitespace-nowrap">Name</th>
                            <td className="px-4 py-3 font-mono font-medium text-amber-300 text-slate-300">{frontmatter.name}</td>
                          </tr>
                          <tr className="text-slate-300">
                            <th className="px-4 py-3 font-semibold text-slate-300 bg-slate-800/40 w-1/5 border-r border-slate-700/60 whitespace-nowrap">Description</th>
                            <td className="px-4 py-3 leading-relaxed text-slate-300">{frontmatter.description}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  <ReactMarkdown
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-bold text-slate-100 mb-3 mt-1 border-b border-slate-700 pb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold text-slate-100 mb-2 mt-5">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mb-1.5 mt-4">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-xs font-semibold text-slate-300 mb-1 mt-3 uppercase tracking-wide">{children}</h4>,
                      p: ({ children }) => <p className="text-xs text-slate-300 leading-relaxed mb-3">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-xs text-slate-300 leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
                      em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock ? (
                          <code className={`${className ?? ""} block text-[11px] leading-relaxed`} {...props}>{children}</code>
                        ) : (
                          <code className="bg-slate-800 text-amber-300 text-[11px] px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>
                        );
                      },
                      pre: ({ children }) => <pre className="bg-slate-900 border border-slate-700/60 rounded-lg p-3 mb-3 overflow-x-auto text-[11px]">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-amber-500/50 pl-3 text-slate-400 italic my-3">{children}</blockquote>,
                      a: ({ href, children }) => {
                        const isLocalFile = href && fileNames.includes(href);
                        if (isLocalFile) {
                          return (
                            <a
                              href={`#${href}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedFile(href);
                              }}
                              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
                            >
                              {children}
                            </a>
                          );
                        }
                        const isDigestLink = href && (href.endsWith("_digest.txt") || href.includes("_digest.txt"));
                        if (isDigestLink && onSwitchToDigest) {
                          return (
                            <a
                              href={`#digest`}
                              onClick={(e) => {
                                e.preventDefault();
                                onSwitchToDigest();
                              }}
                              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
                            >
                              {children}
                            </a>
                          );
                        }
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                          >
                            {children}
                          </a>
                        );
                      },
                      hr: () => <hr className="border-slate-700 my-4" />,
                      table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="text-xs w-full border-collapse">{children}</table></div>,
                      th: ({ children }) => <th className="text-left px-3 py-1.5 bg-slate-800 text-slate-200 font-semibold border border-slate-700">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-1.5 text-slate-300 border border-slate-700/60">{children}</td>,
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              );
            })() : (
              <pre className="p-4 text-xs leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words select-all">
                {previewContent}
              </pre>
            )
          ) : (
            <pre className="p-4 text-xs leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words select-all">
              <span className="text-slate-600 italic">No content available.</span>
            </pre>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-500 text-center">
        Compatible with{" "}
        <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer" className="text-amber-400/80 hover:text-amber-300 underline underline-offset-2">agentskills.io</a>
        {" "}· Claude Code · Antigravity · Codex · Cursor · Visual Studio Code
      </p>
    </div>
  );
};
