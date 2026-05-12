import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface RepoInputProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

const QUICK_LOAD_REPOS = [
  { name: "OpenClaw", url: "https://github.com/openclaw/openclaw" },
  { name: "FastAPI", url: "https://github.com/tiangolo/fastapi" },
  { name: "Codex", url: "https://github.com/openai/codex" },
  { name: "LangGraph", url: "https://github.com/langchain-ai/langgraph" },
  { name: "ADK", url: "https://github.com/google/adk-python" },
];

const ClearIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);


export const RepoInput: React.FC<RepoInputProps> = ({ repoUrl, setRepoUrl, onGenerate, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate();
  };

  const handleClearInput = () => {
    setRepoUrl('');
    // Optionally, focus the input after clearing
    document.getElementById('repoUrl')?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <input
          type="url"
          id="repoUrl"
          name="repoUrl"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="e.g., https://github.com/owner/repo"
          required
          className="w-full px-4 py-2 pr-10 border border-slate-600 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500 bg-slate-700 text-slate-100 placeholder-slate-400"
          disabled={isLoading}
          aria-label="Repository URL"
        />
        {repoUrl && !isLoading && (
          <button
            type="button"
            onClick={handleClearInput}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500 rounded-r-md"
            aria-label="Clear repository URL input"
            title="Clear input"
          >
            <ClearIcon />
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
        {/* Mobile: show quick load buttons above the generate button, both stacked vertically */}
        <div className="flex flex-row sm:flex-row flex-wrap sm:flex-nowrap space-x-2 sm:space-x-2 mb-2 sm:mb-0">
          {QUICK_LOAD_REPOS.map(repo => (
            <button
              key={repo.name}
              type="button"
              onClick={() => setRepoUrl(repo.url)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900 focus:ring-violet-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-2 sm:mb-0"
              title={`Load ${repo.name} repository`}
            >
              {repo.name}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto flex justify-center items-center sm:ml-3 p-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="mr-2 h-5 w-5 text-white" />
              Analyzing repo...
            </>
          ) : (
            'Generate Skill'
          )}
        </button>
      </div>
    </form>
  );
};
