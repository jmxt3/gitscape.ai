import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface RepoInputProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

const QUICK_LOAD_REPOS = [
  { name: "Google ADK", url: "https://github.com/google/adk-python" },
  { name: "FastAPI", url: "https://github.com/tiangolo/fastapi" },
  { name: "LangChain", url: "https://github.com/langchain-ai/langchain" },
  { name: "Supabase", url: "https://github.com/supabase/supabase" },
  { name: "vLLM", url: "https://github.com/vllm-project/vllm" },
  { name: "Transformers", url: "https://github.com/huggingface/transformers" },
];

const ClearIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748b" className="shrink-0">
    <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.22.7.83.57A12 12 0 0 0 12 .3z" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);

export const RepoInput: React.FC<RepoInputProps> = ({ repoUrl, setRepoUrl, onGenerate, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate();
  };

  const handleClearInput = () => {
    setRepoUrl('');
    document.getElementById('repoUrl')?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* URL input */}
        <div
          className="relative flex-1 flex items-center gap-2.5 px-4 rounded-[10px] transition-colors duration-200 focus-within:border-violet-500/60"
          style={{
            background: "rgba(8,13,20,0.8)",
            border: "1px solid rgba(71,85,105,0.5)",
            height: 52,
          }}
        >
          <GithubIcon />
          <input
            type="url"
            id="repoUrl"
            name="repoUrl"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            required
            className="flex-1 h-full bg-transparent border-none outline-none text-[15px] text-slate-100 placeholder-slate-500 pr-8"
            disabled={isLoading}
            aria-label="Repository URL"
          />
          {repoUrl && !isLoading && (
            <button
              type="button"
              onClick={handleClearInput}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500 rounded-r-[10px]"
              aria-label="Clear repository URL input"
              title="Clear input"
            >
              <ClearIcon />
            </button>
          )}
        </div>

        {/* Generate button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-6 rounded-[10px] text-[15px] font-bold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed btn-shimmer"
          style={
            isLoading
              ? { background: "#334155", color: "#94a3b8", height: 52 }
              : {
                background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                boxShadow: "0 4px 20px -4px rgba(124,58,237,0.6)",
                height: 52,
              }
          }
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              Analyzing…
            </>
          ) : (
            <>
              <SparkleIcon />
              Generate skill
            </>
          )}
        </button>
      </div>

      {/* Quick-load chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Try:</span>
        {QUICK_LOAD_REPOS.map(repo => (
          <button
            key={repo.name}
            type="button"
            onClick={() => setRepoUrl(repo.url)}
            disabled={isLoading}
            className="px-3 py-[5px] rounded-full text-xs font-semibold text-slate-300 transition-colors duration-200 hover:text-slate-100 hover:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/60 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "rgba(51,65,85,0.4)",
              border: "1px solid rgba(71,85,105,0.4)",
            }}
            title={`Load ${repo.name} repository`}
          >
            {repo.name}
          </button>
        ))}
      </div>
    </form>
  );
};
