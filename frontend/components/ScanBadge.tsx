import React, { useMemo, useState } from "react";
import { CategoryResult, ScanFinding, ScanReport, ScanStatus } from "../types";

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

export function categoryOf(finding: { rule: string; category?: string }): string {
  if (finding.category) return finding.category;
  if (LEGACY_RULE_CATEGORY[finding.rule]) return LEGACY_RULE_CATEGORY[finding.rule];
  if (finding.rule?.startsWith("framework.")) return "structure";
  return "other";
}

export function categoryLabel(slug: string): string {
  return CATEGORY_META[slug]?.label ?? slug;
}

// ─── Status styles ──────────────────────────────────────────────────────────

export const STATUS_STYLES: Record<ScanStatus, { label: string; chip: string; dot: string }> = {
  PASS: { label: "Scanned & Safe",     chip: "bg-emerald-900/30 border-emerald-600/40 text-emerald-300", dot: "bg-emerald-400" },
  WARN: { label: "Scan Warnings",      chip: "bg-amber-900/30 border-amber-600/40 text-amber-300",   dot: "bg-amber-400" },
  FAIL: { label: "Scan Failed",         chip: "bg-red-900/30 border-red-600/40 text-red-300",         dot: "bg-red-400" },
};

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

// ─── OWASP tooltips ─────────────────────────────────────────────────────────

// OWASP Agentic Skills Top 10 (AST) — human-readable tooltips
const OWASP_AST_LABELS: Record<string, string> = {
  AST01: "Prompt Injection — Overriding agent instructions via skill text",
  AST02: "Insecure Tool Implementation — Remote code exec, destructive commands",
  AST03: "Supply Chain — Unpinned or unverifiable dependencies",
  AST04: "Insufficient Access Control — Data exfiltration via external endpoints",
  AST05: "Sensitive Data Exposure — Hardcoded API keys, tokens, private keys",
  AST06: "Obfuscation — Hidden text, encoded payloads, homoglyph tricks",
  AST07: "Untrusted Content — Fetching and acting on third-party content",
  AST08: "Excessive Agency — Privilege escalation, config tampering, safety bypass",
  AST09: "Insecure Communication — Unprotected inter-agent channels",
  AST10: "Resource Exhaustion — Unbounded loops, memory, or token consumption",
};

// OWASP LLM Top 10 — human-readable tooltips
const OWASP_LLM_LABELS: Record<string, string> = {
  LLM01: "Prompt Injection — Manipulating model behavior via crafted input",
  LLM02: "Sensitive Information Disclosure — Leaking private data in responses",
  LLM03: "Supply Chain — Poisoned training data or compromised components",
  LLM04: "Data and Model Poisoning — Corrupting model behavior or training data",
  LLM05: "Improper Output Handling — Executing unvalidated model output",
  LLM06: "Excessive Agency — Model taking actions beyond intended scope",
  LLM07: "System Prompt Leakage — Exposing system instructions to users",
  LLM08: "Vector and Embedding Weaknesses — Exploiting retrieval systems",
  LLM09: "Misinformation — Generating false or misleading content",
  LLM10: "Unbounded Consumption — Uncontrolled resource usage",
};

function owaspTooltip(tag: string): string {
  return OWASP_AST_LABELS[tag] ?? OWASP_LLM_LABELS[tag] ?? tag;
}

// ScapeGuard custom rule IDs — human-readable tooltips
const SCAPEGUARD_RULE_LABELS: Record<string, string> = {
  // Excessive Agency (GS-AGY)
  "GS-AGY-001": "Privilege Escalation — Skill requests elevated privileges (sudo/runas)",
  "GS-AGY-002": "Safety Bypass — Disables host agent's safety or confirmation checks",
  "GS-AGY-003": "Config Tampering — Modifies agent or shell configuration files",
  "GS-AGY-004": "Direct Money Access — Attempts crypto wallet or payment actions",

  // Untrusted Content (GS-CNT)
  "GS-CNT-001": "Fetch & Obey — Fetches remote content and treats it as instructions",
  "GS-CNT-002": "External Domains — Skill references external domains",
  "GS-CNT-003": "HTML Comments — HTML comments survived into the shipped skill",

  // Malicious Execution (GS-EXE)
  "GS-EXE-001": "Pipe to Shell — Downloads and pipes a script straight into a shell",
  "GS-EXE-002": "Fetch then Eval — Fetches a URL and evaluates the response",
  "GS-EXE-003": "Decode then Exec — Decodes an encoded blob and executes it",
  "GS-EXE-004": "Destructive Command — Command that can delete files, disks, or databases",
  "GS-EXE-005": "Reverse Shell — Opens an outbound interactive shell to a remote host",
  "GS-EXE-006": "Dynamic Eval — Dynamic code evaluation in a shipped script",
  "GS-EXE-007": "Chmod & Run — Downloads a file and immediately makes it executable or runs it",

  // Data Exfiltration (GS-EXF)
  "GS-EXF-001": "Send Secrets — Instruction to send secrets/credentials outward",
  "GS-EXF-002": "Raw IP URL — Suspicious URL pointing at a raw IP address",
  "GS-EXF-003": "Known Drop Endpoint — Reference to a known data-exfiltration drop endpoint",
  "GS-EXF-004": "Env Harvesting — Environment-variable harvesting piped to a network call",
  "GS-EXF-005": "Sensitive Path Read — Reads sensitive credentials (SSH keys, AWS, etc.)",

  // Prompt Injection (GS-INJ)
  "GS-INJ-001": "Ignore Previous — Attempt to override prior instructions",
  "GS-INJ-002": "Reveal System Prompt — Attempt to exfiltrate the system prompt",
  "GS-INJ-003": "Persona Override — Hidden persona/role override",
  "GS-INJ-004": "Role Tags — Embedded chat role or control tags",
  "GS-INJ-005": "Execute Follow-up — Instruction to run or execute subsequent commands",

  // Obfuscation (GS-OBF)
  "GS-OBF-001": "Invisible Characters — Hidden zero-width or bidirectional control character",
  "GS-OBF-002": "High Entropy Blob — High-entropy base64-like blob (possible payload)",
  "GS-OBF-003": "Escape Sequence Run — Dense hex or unicode escape run (likely obfuscation)",
  "GS-OBF-004": "Char Chain Execution — String-reversal or chr() chain feeding an exec/eval",
  "GS-OBF-005": "Mixed Script Homoglyph — Mixed-script homoglyph token (visual spoofing)",

  // Secrets & Credentials (GS-SEC)
  "GS-SEC-001": "Hardcoded AWS Access Key ID",
  "GS-SEC-002": "Hardcoded GitHub Token",
  "GS-SEC-003": "Hardcoded OpenAI API Key",
  "GS-SEC-004": "Hardcoded Anthropic API Key",
  "GS-SEC-005": "Hardcoded Google API Key",
  "GS-SEC-006": "Hardcoded Slack Token",
  "GS-SEC-007": "Hardcoded Stripe Live Secret Key",
  "GS-SEC-008": "Embedded PEM Private Key",
  "GS-SEC-009": "JSON Web Token (JWT)",
  "GS-SEC-010": "Generic Credentials Assigned to variable",

  // Structure & Quality (GS-STR)
  "GS-STR-001": "Missing Overview — Required ## Overview section is missing",
  "GS-STR-002": "Missing When to Use — Required ## When to Use section is missing",
  "GS-STR-003": "Missing Core Process — Required ## Core Process section is missing",
  "GS-STR-004": "Missing Rationalizations — Required ## Common Rationalizations section is missing",
  "GS-STR-005": "Missing Red Flags — Required ## Red Flags section is missing",
  "GS-STR-006": "Missing Verification — Required ## Verification section is missing",

  // Supply Chain (GS-DEP)
  "GS-DEP-001": "Unpinned Dependencies — Version drift or substitution risk",
  "GS-DEP-002": "Unverifiable Package — Install instruction for undeclared package",
  "GS-DEP-003": "Install from URL/VCS — Installs dependency directly from URL/VCS",
  "GS-DEP-004": "Lifecycle Install Scripts — Package lifecycle install scripts present",
  "GS-DEP-005": "Typosquatted Dependency — Dependency name resembles a popular package",
};

function scapeguardTooltip(f: ScanFinding): string {
  const code = f.id || "";
  const label = SCAPEGUARD_RULE_LABELS[code];
  let tooltip = `ScapeGuard Rule: ${code}`;
  if (label) {
    tooltip += `\n${label}`;
  } else if (f.rule) {
    tooltip += `\nRule Name: ${f.rule}`;
  }
  if (f.remediation) {
    tooltip += `\n\nRemediation: ${f.remediation}`;
  }
  return tooltip;
}

// ─── Finding grouping ───────────────────────────────────────────────────────

// Group key for deduplicating findings that share the same rule, message, and snippet
// but appear in multiple files.
interface GroupedFinding {
  representative: ScanFinding;
  locations: { file: string; line: number; source_path?: string | null }[];
}

function groupFindings(findings: ScanFinding[]): GroupedFinding[] {
  const map = new Map<string, GroupedFinding>();
  for (const f of findings) {
    const key = `${f.id ?? f.rule}||${f.message}||${f.snippet ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations.push({ file: f.file, line: f.line, source_path: f.source_path });
    } else {
      map.set(key, {
        representative: f,
        locations: [{ file: f.file, line: f.line, source_path: f.source_path }],
      });
    }
  }
  return Array.from(map.values());
}

// ─── Bypassable logic ──────────────────────────────────────────────────────

// Categories whose CRITICAL findings can never be shipped — mirrors the backend
// gate in scan/package.py so the UI can show the hard-block state immediately,
// before a download round-trip. The server remains the source of truth (its
// `bypassable` flag overrides this once a 422 comes back).
const UNBYPASSABLE_CATEGORIES = new Set(["secrets", "malicious_execution", "data_exfiltration"]);

export function computeBypassable(report: ScanReport | null | undefined): boolean {
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

// ─── Sub-components ─────────────────────────────────────────────────────────

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

// ─── Main ScanBadge ─────────────────────────────────────────────────────────

export const ScanBadge: React.FC<{ report: ScanReport; repoUrl?: string }> = ({ report, repoUrl }) => {
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
      {open && report.findings.length > 0 && (() => {
        const groups = groupFindings(report.findings);
        return (
        <ul className="mt-2.5 flex flex-col gap-1.5 max-h-72 overflow-auto">
          {groups.map((g, i) => {
            const f = g.representative;
            return (
            <li key={i} className="text-[11px] bg-slate-900/50 rounded-md px-2.5 py-2 border border-slate-700/60">
              {/* Row 1: issue code + category + severity + confidence */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {f.id && (
                  <span
                    title={scapeguardTooltip(f)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600/60 text-slate-300 font-mono text-[10px] cursor-help"
                  >{f.id}</span>
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
                {/* OWASP mapping chips — with tooltips */}
                {[...(f.owasp_ast ?? []), ...(f.owasp_llm ?? [])].map((tag) => (
                  <span
                    key={tag}
                    title={owaspTooltip(tag)}
                    className="px-1 py-0.5 rounded bg-violet-900/30 border border-violet-700/40 text-violet-300 text-[9px] font-mono cursor-help"
                  >{tag}</span>
                ))}
                {/* Duplicate count badge */}
                {g.locations.length > 1 && (
                  <span
                    title={`Found in ${g.locations.length} locations`}
                    className="px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-600/40 text-slate-400 text-[9px] font-mono cursor-help"
                  >
                    ×{g.locations.length}
                  </span>
                )}
              </div>
              {/* Row 2: message */}
              <div className="text-slate-300 mt-1 leading-relaxed">{f.message}</div>
              {/* Row 3: file locations (grouped) */}
              {g.locations.map((loc, li) => (
                <div key={li} className="text-slate-500 mt-0.5 font-mono text-[10px]">
                  {loc.file}{loc.line ? `:${loc.line}` : ""}
                  {loc.source_path ? (
                    <span className="text-slate-600">
                      {" · from "}
                      {repoUrl ? (
                        <a
                          href={`${repoUrl.replace(/\.git$/, "")}/blob/HEAD/${loc.source_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400/80 hover:text-violet-300 underline decoration-violet-500/30 hover:decoration-violet-400/60 transition-colors"
                        >
                          {loc.source_path}
                        </a>
                      ) : (
                        loc.source_path
                      )}
                    </span>
                  ) : null}
                </div>
              ))}
              {/* Row 4: offending snippet */}
              {f.snippet && (
                <div className="text-slate-500 mt-0.5 font-mono text-[10px] truncate italic">"{f.snippet}"</div>
              )}
              {/* Row 5: remediation hint */}
              {f.remediation && (
                <div className="text-emerald-400/80 mt-0.5 text-[10px]">↳ {f.remediation}</div>
              )}
            </li>
            );
          })}
        </ul>
        );
      })()}

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
