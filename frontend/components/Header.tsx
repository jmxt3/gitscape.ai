import React from 'react';
import GitHubButton from 'react-github-btn';

interface HeaderProps {
  onToggleTokenModal: () => void;
  hasToken: boolean;
}

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ onToggleTokenModal, hasToken }) => {
  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(8, 13, 20, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-slate-100">
              GitScape
            </span>
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: 'white',
                letterSpacing: '0.05em',
              }}
            >
              AI
            </span>
          </div>
        </div>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-slate-400">
          <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How it works</a>
          <a href="#developer-tools" className="hover:text-slate-200 transition-colors">CLI &amp; MCP</a>
          <a href="#security" className="hover:text-slate-200 transition-colors">Security</a>
          <a href="#open-source" className="hover:text-slate-200 transition-colors">Open source</a>
          <a
            href="https://github.com/jmxt3/Git-Scape-Web#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-200 transition-colors"
          >
            Docs
          </a>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <GitHubButton
              href="https://github.com/jmxt3/Git-Scape-Web"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-size="large"
              data-show-count="true"
              aria-label="Star jmxt3/Git-Scape-Web on GitHub"
            >
              Stars
            </GitHubButton>
          </div>

          <button
            id="private-repos-btn"
            onClick={onToggleTokenModal}
            title={hasToken ? 'Manage GitHub Token' : 'Add GitHub Token for Private Repos'}
            aria-label={hasToken ? 'GitHub token is set. Click to manage.' : 'Set GitHub Personal Access Token for private repos'}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-transparent"
            style={hasToken ? {
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#34d399',
            } : {
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#a78bfa',
            }}
          >
            {hasToken ? <CheckIcon /> : <LockIcon />}
            <span className="hidden sm:inline">
              {hasToken ? 'Token Active' : 'Private Repos'}
            </span>
            <span className="sm:hidden">
              {hasToken ? '✓' : 'Token'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};