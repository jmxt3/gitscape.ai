import React, { useState, useEffect, useMemo } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface DigestOutputProps {
  digest: string;
  isLoading: boolean;
  repoNameForFilename: string | null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CopyIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.75c0 .621-.504 1.125-1.125 1.125h-4.5c-.621 0-1.125-.504-1.125-1.125V5.25c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.25c0-1.108.806-2.057 1.907-2.25a48.208 48.208 0 011.927-.184" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const DocumentIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildFilename(repoNameForFilename: string | null): string {
  let filenamePart = 'digest';
  if (repoNameForFilename) {
    let name = repoNameForFilename;
    name = name.replace(/-/g, '_');
    name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');
    name = name.replace(/([a-z\d])([A-Z])/g, '$1_$2');
    name = name.toLowerCase();
    filenamePart = name;
  }
  return `git_scape_${filenamePart}_digest.txt`;
}

// ─── Summary stats derived cheaply from the digest string ────────────────────

interface DigestStats {
  filesAnalyzed: number | null;
  lineCount: number;
  sizeBytes: number;
}

function parseStats(digest: string): DigestStats {
  // "Files analyzed: 1514" is always near the top — only scan first 500 chars.
  const header = digest.slice(0, 500);
  const match = header.match(/Files analyzed:\s*(\d+)/i);
  return {
    filesAnalyzed: match ? parseInt(match[1], 10) : null,
    lineCount: (digest.match(/\n/g) ?? []).length + 1,
    sizeBytes: new TextEncoder().encode(digest).length,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const DigestOutputComponent: React.FC<DigestOutputProps> = ({
  digest,
  isLoading,
  repoNameForFilename,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Cheap stats — only recalculate when digest changes.
  const stats = useMemo<DigestStats | null>(
    () => (digest ? parseStats(digest) : null),
    [digest]
  );

  const filename = useMemo(
    () => buildFilename(repoNameForFilename),
    [repoNameForFilename]
  );

  const handleCopy = () => {
    if (!digest) return;
    navigator.clipboard
      .writeText(digest)
      .then(() => setCopied(true))
      .catch((err) => console.error('Failed to copy:', err));
  };

  const handleDownload = () => {
    if (!digest) return;
    const blob = new Blob([digest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-md border border-dashed border-slate-700 w-full">
        <LoadingSpinner className="h-12 w-12 text-violet-400" />
        <p className="mt-2 text-sm text-violet-400">Generating digest…</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!digest) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-md border border-dashed border-slate-700 w-full">
        <p className="text-violet-400 text-center px-4">
          No digest generated yet.
        </p>
      </div>
    );
  }

  // ── Ready state ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-medium text-violet-400">Generated Code Digest</h3>

      {/* Summary card */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/60 border border-slate-700 rounded-xl p-6">
        {/* Icon */}
        <div className="shrink-0 p-4 rounded-full bg-violet-500/10 border border-violet-500/20">
          <DocumentIcon className="w-8 h-8 text-violet-400" />
        </div>

        {/* Stats */}
        <div className="flex-1 flex flex-wrap justify-center sm:justify-start gap-6">
          {stats?.filesAnalyzed != null && (
            <Stat label="Files analyzed" value={stats.filesAnalyzed.toLocaleString()} />
          )}
          <Stat label="Lines" value={stats?.lineCount.toLocaleString() ?? '—'} />
          <Stat label="Size" value={stats ? formatBytes(stats.sizeBytes) : '—'} />
          <Stat label="Format" value="Plain text" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          id="digest-download-btn"
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all duration-150 shadow-md hover:shadow-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <DownloadIcon className="w-4 h-4" />
          Download Digest
        </button>

        <button
          id="digest-copy-btn"
          onClick={handleCopy}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
            copied
              ? 'bg-green-600 text-white focus:ring-green-500'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 focus:ring-violet-500'
          }`}
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Copied to clipboard!
            </>
          ) : (
            <>
              <CopyIcon className="w-4 h-4" />
              Copy to clipboard
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        The digest is ready to paste into any AI model. Use <span className="text-slate-400 font-mono">Download</span> to save it as a <span className="text-slate-400 font-mono">.txt</span> file, or <span className="text-slate-400 font-mono">Copy</span> to paste directly.
      </p>
    </div>
  );
};

// ─── Stat pill ────────────────────────────────────────────────────────────────

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center sm:items-start">
    <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
    <span className="text-lg font-bold text-slate-200 mt-0.5">{value}</span>
  </div>
);

export const DigestOutput = React.memo(DigestOutputComponent);