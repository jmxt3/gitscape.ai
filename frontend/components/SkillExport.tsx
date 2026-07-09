import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { CategoryResult, ScanReport, ScanStatus, SkillManifest, SkillReferences } from "../types";

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

// ─── Scan badge ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ScanStatus, { label: string; chip: string; dot: string }> = {
  PASS: { label: "Scanned & Safe",     chip: "bg-emerald-900/30 border-emerald-600/40 text-emerald-300", dot: "bg-emerald-400" },
  WARN: { label: "Scan Warnings",      chip: "bg-amber-900/30 border-amber-600/40 text-amber-300",   dot: "bg-amber-400" },
  FAIL: { label: "Scan Failed",         chip: "bg-red-900/30 border-red-600/40 text-red-300",         dot: "bg-red-400" },
};

// ─── ScapeGuard taxonomy — must mirror backend scan/taxonomy.py ──────────────

const CATEGORY_META: Record<string, { label: string }> = {
  prompt_injection:    { label: "Prompt Injection" },
  secrets:             { label: "Secrets & Credentials" },
  data_exfiltration:   { label: "Data Exfiltration" },
  malicious_execution: { label: "Malicious Execution" },
  supply_chain:        { label: "Supply Chain" },
  obfuscation:         { label: "Obfuscation" },
  content_exposure:    { label: "Untrusted Content" },
  excessive_agency:    { label: "Excessive Agency" },
  structure:           { label: "Structure & Quality" },
};

// The order the category grid renders in.
const CATEGORY_ORDER = [
  "prompt_injection", "secrets", "data_exfiltration", "malicious_execution",
  "supply_chain", "obfuscation", "content_exposure", "excessive_agency", "structure",
];

// Legacy fallback for reports cached before ScapeGuard v2 tagged findings with a category.
const LEGACY_RULE_CATEGORY: Record<string, string> = {
  "injection.ignore_previous": "prompt_injection",
  "injection.reveal_system_prompt": "prompt_injection",
  "injection.persona_override": "prompt_injection",
  "injection.role_tags": "prompt_injection",
  "injection.tool_abuse": "malicious_execution",
  "exfil.send_secrets": "data_exfiltration",
  "exfil.raw_ip_url": "data_exfiltration",
  "exfil.high_entropy_blob": "obfuscation",
  "hidden.invisible_char": "obfuscation",
};

function categoryOf(finding: { rule: string; category?: string }): string {
  if (finding.category) return finding.category;
  if (LEGACY_RULE_CATEGORY[finding.rule]) return LEGACY_RULE_CATEGORY[finding.rule];
  if (finding.rule?.startsWith("framework.")) return "structure";
  return "other";
}

function categoryLabel(slug: string): string {
  return CATEGORY_META[slug]?.label ?? slug;
}

const STATUS_CHIP: Record<ScanStatus, string> = {
  PASS: "bg-emerald-900/20 border-emerald-700/40 text-emerald-300",
  WARN: "bg-amber-900/20 border-amber-700/40 text-amber-300",
  FAIL: "bg-red-900/25 border-red-700/50 text-red-300",
};

const STATUS_DOT: Record<ScanStatus, string> = {
  PASS: "bg-emerald-400",
  WARN: "bg-amber-400",
  FAIL: "bg-red-400",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-amber-300",
  info: "text-slate-400",
};

// Categories whose CRITICAL findings can never be shipped — mirrors the backend
// gate in scan/package.py so the UI can show the hard-block state immediately,
// before a download round-trip. The server remains the source of truth (its
// `bypassable` flag overrides this once a 422 comes back).
const UNBYPASSABLE_CATEGORIES = new Set(["secrets", "malicious_execution", "data_exfiltration"]);

function computeBypassable(report: ScanReport | null | undefined): boolean {
  if (!report) return true;
  return !report.findings.some(
    (f) =>
      f.severity === "critical" &&
      (f.confidence ?? "high") !== "low" &&
      UNBYPASSABLE_CATEGORIES.has(categoryOf(f))
  );
}

// Derive per-category verdicts from findings when the server didn't send them
// (older cached reports). Only categories present in findings appear here.
function deriveCategories(report: ScanReport): CategoryResult[] {
  if (report.categories && report.categories.length) return report.categories;
  const worst: Record<string, ScanStatus> = {};
  const counts: Record<string, number> = {};
  const rank: Record<ScanStatus, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  for (const f of report.findings) {
    const slug = categoryOf(f);
    counts[slug] = (counts[slug] ?? 0) + 1;
    const s: ScanStatus = ["critical", "high"].includes(f.severity)
      ? "FAIL" : ["medium", "low"].includes(f.severity) ? "WARN" : "PASS";
    if (!worst[slug] || rank[s] > rank[worst[slug]]) worst[slug] = s;
  }
  return Object.keys(counts).map((slug) => ({
    category: slug, status: worst[slug] ?? "PASS", findings: counts[slug],
  }));
}

// Status icons — one per ScanStatus
const ScanStatusIcon: React.FC<{ status: ScanStatus }> = ({ status }) => {
  if (status === "PASS") return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (status === "WARN") return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
  // FAIL
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

// A single category tile in the coverage grid.
const CategoryTile: React.FC<{ result: CategoryResult }> = ({ result }) => (
  <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${STATUS_CHIP[result.status]}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[result.status]}`} />
    <span className="text-[10px] font-medium leading-tight truncate">{categoryLabel(result.category)}</span>
    {result.findings > 0 && (
      <span className="ml-auto text-[9px] font-mono opacity-70 shrink-0">{result.findings}</span>
    )}
  </div>
);

const ScanBadge: React.FC<{ report: ScanReport }> = ({ report }) => {
  const [open, setOpen] = useState(report.status !== "PASS");
  const style = STATUS_STYLES[report.status];
  const categories = useMemo(() => {
    const cats = deriveCategories(report);
    return [...cats].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    );
  }, [report]);
  const version = report.engine_version ? `v${report.engine_version}` : "";
  const shortHash = report.skill_hash
    ? report.skill_hash.replace("sha256:", "sha256:").slice(0, 17) + "…"
    : null;
  const scannedAt = report.generated_at
    ? new Date(report.generated_at).toLocaleString()
    : null;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${style.chip}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
        <span className="text-xs font-semibold tracking-wide flex items-center gap-1.5">
          <ScanStatusIcon status={report.status} />
          {style.label}
        </span>
        <span className="ml-auto text-[10px] font-mono opacity-70">
          {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
          {(open ? " ▲" : " ▼")}
        </span>
      </button>

      {/* Behavioral summary (LLM judge, when enabled) */}
      {report.summary && (
        <p className="mt-2 text-[11px] text-slate-300 leading-relaxed italic">{report.summary}</p>
      )}

      {/* Category coverage grid — shows what ScapeGuard checked, green included */}
      {open && categories.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {categories.map((c) => <CategoryTile key={c.category} result={c} />)}
        </div>
      )}

      {/* Findings detail */}
      {open && report.findings.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5 max-h-72 overflow-auto">
          {report.findings.map((f, i) => (
            <li key={i} className="text-[11px] bg-slate-900/50 rounded-md px-2.5 py-2 border border-slate-700/60">
              {/* Row 1: issue code + category + severity + confidence */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {f.id && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600/60 text-slate-300 font-mono text-[10px]">{f.id}</span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-800/60 border border-slate-700/60 text-slate-300">
                  {categoryLabel(categoryOf(f))}
                </span>
                <span className={`font-bold text-[10px] ${SEVERITY_COLOR[f.severity] ?? "text-slate-300"}`}>
                  {f.severity.toUpperCase()}
                </span>
                {f.confidence && (
                  <span className="text-[9px] text-slate-500 font-mono">conf: {f.confidence}</span>
                )}
                {/* OWASP mapping chips */}
                {[...(f.owasp_ast ?? []), ...(f.owasp_llm ?? [])].map((tag) => (
                  <span key={tag} className="px-1 py-0.5 rounded bg-violet-900/30 border border-violet-700/40 text-violet-300 text-[9px] font-mono">{tag}</span>
                ))}
              </div>
              {/* Row 2: message */}
              <div className="text-slate-300 mt-1 leading-relaxed">{f.message}</div>
              {/* Row 3: file location + source attribution */}
              <div className="text-slate-500 mt-0.5 font-mono text-[10px]">
                {f.file}{f.line ? `:${f.line}` : ""}
                {f.source_path ? <span className="text-slate-600"> · from {f.source_path}</span> : null}
              </div>
              {/* Row 4: offending snippet */}
              {f.snippet && (
                <div className="text-slate-500 mt-0.5 font-mono text-[10px] truncate italic">"{f.snippet}"</div>
              )}
              {/* Row 5: remediation hint */}
              {f.remediation && (
                <div className="text-emerald-400/80 mt-0.5 text-[10px]">↳ {f.remediation}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Provenance footer */}
      {open && (
        <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono text-slate-500">
          <span className="text-slate-400">Scanned by ScapeGuard{version ? ` ${version}` : ""}</span>
          {report.license?.spdx_id && report.license.spdx_id !== "NOASSERTION" && (
            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/60 text-slate-300">{report.license.spdx_id}</span>
          )}
          {typeof report.files_scanned === "number" && report.files_scanned > 0 && (
            <span>· {report.files_scanned} file{report.files_scanned === 1 ? "" : "s"}</span>
          )}
          {shortHash && <span className="truncate">· {shortHash}</span>}
          {scannedAt && <span>· {scannedAt}</span>}
        </div>
      )}
    </div>
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


      {/* Scan badge */}
      {displayScan && <ScanBadge report={displayScan} />}

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

      {/* Zip content hint */}
      <p className="text-[11px] text-slate-500">
        The <span className="text-slate-400 font-medium">.zip</span> contains a slim <span className="text-slate-400 font-medium">SKILL.md</span>, a <span className="text-slate-400 font-medium">references/</span> folder, ADK/Agno exporters, a provenance-stamped <span className="text-slate-400 font-medium">manifest.json</span>, and its full ScapeGuard audit as <span className="text-slate-400 font-medium">scan-report.json</span> + <span className="text-slate-400 font-medium">scan-report.sarif</span>.
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
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">{children}</a>,
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
