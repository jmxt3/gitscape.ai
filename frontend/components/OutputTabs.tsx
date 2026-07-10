import React, { useCallback, useState } from 'react';
import { DigestOutput } from './DigestOutput';
import { SkillExport } from './SkillExport';
import { ScanBadge } from './ScanBadge';
import { SkillManifest, ScanReport, SkillReferences } from '../types';

interface OutputTabsProps {
  digest: string;
  isLoadingDigest: boolean;

  repoName: string;
  repoNameForFilename: string | null;
  defaultBranch: string | null;
  filesCount?: number | null;

  skillMd?: string;
  manifestJson?: SkillManifest | null;
  scanReport?: ScanReport | null;
  references?: SkillReferences | null;
  repoUrl?: string;
  githubToken?: string | null;

  // New framework skill props
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

type TabKey = 'digest' | 'security' | 'skill';

const TABS: { key: TabKey; label: string; activeColor: string; underline: string }[] = [
  { key: 'digest', label: 'Digest', activeColor: '#c4b5fd', underline: '#7c3aed' },
  { key: 'security', label: 'Security', activeColor: '#6ee7b7', underline: '#10b981' },
  { key: 'skill', label: 'Agent Skill', activeColor: '#fcd34d', underline: '#f59e0b' },
];

const SCAN_BADGE: Record<ScanReport['status'], { label: string; bg: string; color: string }> = {
  PASS: { label: 'SCAN PASSED', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  WARN: { label: 'SCAN WARNINGS', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  FAIL: { label: 'SCAN FAILED', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
};

export const OutputTabs: React.FC<OutputTabsProps> = ({
  digest,
  isLoadingDigest,
  repoName,
  repoNameForFilename,
  defaultBranch,
  filesCount,
  skillMd,
  manifestJson,
  scanReport,
  references,
  repoUrl,
  githubToken,
  frameworkSkillMd,
  frameworkManifest,
  frameworkScanReport,
  frameworkReferences,
  onFrameworkSkillGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(() => (skillMd ? 'skill' : 'digest'));

  const resolvedScan = frameworkScanReport ?? scanReport;
  const badge = resolvedScan ? SCAN_BADGE[resolvedScan.status] : null;

  const handleSwitchToSecurity = useCallback(() => setActiveTab('security'), []);
  const handleSwitchToDigest = useCallback(() => setActiveTab('digest'), []);

  return (
    <div
      className="rounded-2xl p-5 sm:p-7 flex flex-col gap-4.5"
      style={{
        background: 'rgba(15,23,42,0.75)',
        border: '1px solid rgba(71,85,105,0.5)',
        boxShadow: '0 12px 48px -12px rgba(0,0,0,0.6)',
      }}
    >
      {/* ── Results header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[17px] font-extrabold text-slate-100">{repoName}</span>
        {defaultBranch && (
          <span
            className="font-mono text-[11px] px-2.5 py-[3px] rounded-full"
            style={{ background: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
          >
            {defaultBranch}
            {filesCount ? ` · ${filesCount.toLocaleString()} files` : ''}
          </span>
        )}
        {badge && (
          <span
            className="text-[10px] font-bold px-2.5 py-[3px] rounded-full tracking-[0.06em]"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(71,85,105,0.4)' }}
        role="tablist"
        aria-label="Result artifacts"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4.5 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-200 ${
                isActive ? 'font-bold' : 'font-semibold text-slate-400 hover:text-slate-200'
              }`}
              style={
                isActive
                  ? { color: tab.activeColor, borderBottom: `2px solid ${tab.underline}`, marginBottom: -1 }
                  : { borderBottom: '2px solid transparent', marginBottom: -1 }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      {activeTab === 'digest' && (
        <section id="section-code-digest" role="tabpanel">
          <DigestOutput
            digest={digest}
            isLoading={isLoadingDigest}
            repoNameForFilename={repoNameForFilename}
          />
        </section>
      )}

      {activeTab === 'security' && (
        <section id="section-security" role="tabpanel">
          {resolvedScan ? (
            <div className="flex flex-col gap-4">
              <p className="text-[12px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">ScapeGuard</span> scans every generated skill
                for prompt injection, hardcoded secrets, data exfiltration, malicious execution,
                supply chain risks, obfuscation, untrusted content, excessive agency, and structure quality.
              </p>
              <ScanBadge report={resolvedScan} repoUrl={repoUrl} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500/60">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </span>
              <p className="text-sm">Security scan will run automatically when your skill is generated.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'skill' && (
        <section id="section-skill-export" role="tabpanel">
          {skillMd ? (
            <SkillExport
              skillMd={skillMd}
              manifestJson={manifestJson ?? null}
              scanReport={scanReport ?? null}
              references={references ?? null}
              repoUrl={repoUrl ?? ""}
              repoNameForFilename={repoNameForFilename}
              githubToken={githubToken ?? null}
              digest={digest}
              frameworkSkillMd={frameworkSkillMd}
              frameworkManifest={frameworkManifest}
              frameworkScanReport={frameworkScanReport}
              frameworkReferences={frameworkReferences}
              onFrameworkSkillGenerated={onFrameworkSkillGenerated}
              onSwitchToSecurity={handleSwitchToSecurity}
              onSwitchToDigest={handleSwitchToDigest}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 text-amber-500/60">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </span>
              <p className="text-sm">Generate a digest first to preview the Agent Skill.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
