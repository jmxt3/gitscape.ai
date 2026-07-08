import React, { useState } from 'react';
import { DigestOutput } from './DigestOutput';
import { Diagram } from './Diagram';
import { SkillExport } from './SkillExport';
import { RawDiagramNode, SkillManifest, ScanReport, SkillReferences } from '../types';

interface OutputTabsProps {
  digest: string;
  isLoadingDigest: boolean;

  diagramData: RawDiagramNode | null;
  repoName: string;
  repoNameForFilename: string | null;
  defaultBranch: string | null;
  filesCount?: number | null;

  onOpenDiagramFullscreenModal: (data: RawDiagramNode, repoName: string, defaultBranch: string | null) => void;

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

type TabKey = 'digest' | 'map' | 'skill';

const TABS: { key: TabKey; label: string; activeColor: string; underline: string }[] = [
  { key: 'digest', label: 'Digest', activeColor: '#c4b5fd', underline: '#7c3aed' },
  { key: 'map', label: 'Code Map', activeColor: '#6ee7b7', underline: '#10b981' },
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
  diagramData,
  repoName,
  repoNameForFilename,
  defaultBranch,
  filesCount,
  onOpenDiagramFullscreenModal,
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

  const badge = scanReport ? SCAN_BADGE[scanReport.status] : null;

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

      {activeTab === 'map' && (
        <section id="section-code-visualization" role="tabpanel">
          <div className="h-[500px] min-h-[400px] w-full">
            {diagramData && repoName && defaultBranch ? (
              <Diagram
                data={diagramData}
                repoName={repoName}
                defaultBranch={defaultBranch}
                onOpenFullscreenModal={onOpenDiagramFullscreenModal}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Code map data not available or still loading.
              </div>
            )}
          </div>
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
