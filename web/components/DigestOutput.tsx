import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface DigestOutputProps {
  digest: string;
  isLoading: boolean;
  repoNameForFilename: string | null; // e.g., "my-repo" or "MyCoolProject"
}

const CopyIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.75c0 .621-.504 1.125-1.125 1.125h-4.5c-.621 0-1.125-.504-1.125-1.125V5.25c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.25c0-1.108.806-2.057 1.907-2.25a48.208 48.208 0 011.927-.184" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);


const DigestOutputComponent: React.FC<DigestOutputProps> = ({ digest, isLoading, repoNameForFilename }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    if (digest) {
      navigator.clipboard.writeText(digest)
        .then(() => setCopied(true))
        .catch(err => console.error('Failed to copy text: ', err));
    }
  };

  const handleDownload = () => {
    if (digest) {
      let filenamePart = 'digest'; // Default
      if (repoNameForFilename) {
        let name = repoNameForFilename; // e.g., "flask-Ultra", "MyGreatRepo"

        // Replace hyphens with underscores
        name = name.replace(/-/g, '_'); // "flask_Ultra", "MyGreatRepo"

        // Handle transitions from uppercase to uppercase+lowercase (e.g., USAToday -> USA_Today)
        name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');

        // Handle transitions from lowercase/digit to uppercase (e.g., myRepo -> my_Repo, MyGreatRepo -> My_Great_Repo)
        name = name.replace(/([a-z\d])([A-Z])/g, '$1_$2');

        // Convert to lowercase
        name = name.toLowerCase(); // "flask_ultra", "my_great_repo"

        filenamePart = name;
      }

      const filename = `git_scape_${filenamePart}_digest.txt`;
      const blob = new Blob([digest], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-md border border-dashed border-slate-700 w-full">
        <LoadingSpinner className="h-12 w-12 text-violet-400" />
        <p className="mt-2 text-sm text-violet-400">Loading digest content...</p>
      </div>
    );
  }

  if (!digest && !isLoading) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-md border border-dashed border-slate-700 w-full">
        <p className="text-violet-400 text-center px-4">
          No code digest content generated.
          <br />
          This might happen if no relevant files were found or if only the repository structure is being displayed.
        </p>
      </div>
    );
  }


  const buttonBaseClasses = "flex items-center space-x-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition duration-150 ease-in-out text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";
  const normalButtonClasses = "text-violet-300 bg-slate-700 hover:bg-slate-600 focus:ring-violet-500";
  const copiedButtonClasses = "text-green-300 bg-green-600 hover:bg-green-700 focus:ring-green-500";


  return (
    <div className="flex flex-col h-full w-full">
      <h3 className="text-lg font-medium text-violet-400 mb-3">Generated Code Digest</h3>
      <div
        className="h-[500px] overflow-auto p-3 font-mono text-sm border border-slate-700 rounded-md bg-slate-900/95 text-slate-300 flex-grow"
        aria-label="Generated code digest"
        role="region"
      >
        <pre className="whitespace-pre-wrap break-words select-all m-0">{digest}</pre>
      </div>
      <div className="mt-4 flex justify-end space-x-3">
        <button
          onClick={handleDownload}
          aria-label="Download Digest"
          title="Download Digest"
          className={`${buttonBaseClasses} ${normalButtonClasses}`}
          disabled={!digest}
        >
          <DownloadIcon className="w-5 h-5" />
          <span>Download Digest</span>
        </button>
        <button
          onClick={handleCopy}
          aria-label={copied ? "Digest Copied" : "Copy Digest"}
          title={copied ? "Copied!" : "Copy Digest"}
          className={`${buttonBaseClasses} ${copied ? copiedButtonClasses : normalButtonClasses}`}
          disabled={!digest}
        >
          {copied ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
          <span>{copied ? "Copied!" : "Copy Digest"}</span>
        </button>
      </div>
    </div>
  );
};
export const DigestOutput = React.memo(DigestOutputComponent);