
import React, { useState, useEffect } from 'react';

interface GithubTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
  currentToken: string;
}

export const GithubTokenModal: React.FC<GithubTokenModalProps> = ({
  isOpen,
  onClose,
  onSaveToken,
  onClearToken,
  currentToken,
}) => {
  const [inputValue, setInputValue] = useState(currentToken);

  useEffect(() => {
    setInputValue(currentToken);
  }, [currentToken, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSaveToken(inputValue);
  };

  const handleClear = () => {
    setInputValue('');
    onClearToken();
  };

  const PAT_DOCS_URL = "https://github.com/settings/tokens/new?scopes=repo&description=GitScapeAI";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      style={{ background: "rgba(2,6,12,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-token-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl p-7 flex flex-col gap-4"
        style={{
          background: "rgba(15,23,42,0.98)",
          border: "1px solid rgba(71,85,105,0.6)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 34, height: 34, background: "rgba(139,92,246,0.15)" }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="#a78bfa">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 id="github-token-modal-title" className="text-base font-bold text-slate-100">
              Unlock private repos
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="m-0 text-[13.5px] leading-relaxed text-slate-400">
          Add a GitHub token with the{" "}
          <code
            className="font-mono text-xs px-1.5 py-px rounded"
            style={{ background: "rgba(51,65,85,0.6)", color: "#cbd5e1" }}
          >
            repo
          </code>{" "}
          scope for private repos and 5,000 requests/hour.
        </p>

        {/* Token input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="github-token-input" className="text-xs font-semibold text-slate-300">
            Personal access token
          </label>
          <input
            type="password"
            id="github-token-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="ghp_••••••••••••••••"
            className="w-full px-4 rounded-[9px] font-mono text-[13px] text-slate-100 placeholder-slate-500 outline-none transition-colors duration-200 focus:border-violet-500/60"
            style={{
              height: 46,
              background: "rgba(8,13,20,0.8)",
              border: "1px solid rgba(71,85,105,0.5)",
            }}
            aria-describedby="token-description"
          />
          <p id="token-description" className="m-0 text-xs text-slate-500">
            <a
              href={PAT_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300"
            >
              Create one on GitHub
            </a>{" "}
            — pre-scoped, one click.
          </p>
        </div>

        {/* Privacy note */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-[9px]"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-xs text-emerald-300">
            Stored only in this browser. Sent only to api.github.com.
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          {currentToken && (
            <button
              onClick={handleClear}
              type="button"
              className="px-5 py-2.5 rounded-[9px] text-[13px] font-semibold text-amber-400 transition-colors hover:text-amber-300 sm:mr-auto"
              style={{ border: "1px solid rgba(245,158,11,0.35)" }}
            >
              Clear token
            </button>
          )}
          <button
            onClick={onClose}
            type="button"
            className="px-5 py-2.5 rounded-[9px] text-[13px] font-semibold text-slate-400 transition-colors hover:text-slate-200"
            style={{ border: "1px solid rgba(71,85,105,0.5)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="px-5 py-2.5 rounded-[9px] text-[13px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
            disabled={inputValue === currentToken && !!inputValue}
          >
            {currentToken ? 'Update token' : 'Save token'}
          </button>
        </div>
      </div>
    </div>
  );
};
