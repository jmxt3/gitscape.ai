import React, { useState } from 'react';
import GitHubButton from 'react-github-btn';

interface HeaderProps {
  onToggleTokenModal: () => void;
  hasToken: boolean;
  currentPath: string;
  onNavigate: (path: string, hash?: string) => void;
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

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);


export const Header: React.FC<HeaderProps> = ({ onToggleTokenModal, hasToken, currentPath, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-baseline gap-1 hover:opacity-90 transition-opacity"
          >
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
          </a>
        </div>

        {/* Center nav */}
        <nav className="hidden md:flex landscape-only-flex items-center gap-7 text-[13px] font-medium text-slate-400">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className={`hover:text-slate-200 transition-colors landscape-hidden ${currentPath === '/' ? 'text-slate-100 font-semibold' : ''}`}
          >
            Home
          </a>
          <a
            href="/#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/', '#how-it-works');
            }}
            className="hover:text-slate-200 transition-colors landscape-hidden"
          >
            How it works
          </a>
          <a
            href="/#developer-tools"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/', '#developer-tools');
            }}
            className="hover:text-slate-200 transition-colors landscape-hidden"
          >
            CLI &amp; MCP
          </a>
          <a
            href="/#security"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/', '#security');
            }}
            className="hover:text-slate-200 transition-colors landscape-hidden"
          >
            Security
          </a>
          <a
            href="/#open-source"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/', '#open-source');
            }}
            className="hover:text-slate-200 transition-colors landscape-hidden"
          >
            Open source
          </a>
          <a
            href="/registry"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/registry');
            }}
            className={`hover:text-slate-200 transition-colors ${currentPath === '/registry' ? 'text-cyan-400 font-bold' : ''}`}
          >
            Registry
          </a>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block landscape-hidden">
            <GitHubButton
              href="https://github.com/jmxt3/gitscape.ai"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-size="large"
              data-show-count="true"
              aria-label="Star jmxt3/gitscape.ai on GitHub"
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

          {/* Hamburger button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden border-t border-slate-800/60 transition-all duration-200"
          style={{
            background: 'rgba(8, 13, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <nav className="flex flex-col px-4 py-3 gap-3 text-[14px] font-medium text-slate-300">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
                setIsMobileMenuOpen(false);
              }}
              className={`py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all ${currentPath === '/' ? 'text-slate-100 bg-slate-800/60 font-semibold' : ''}`}
            >
              Home
            </a>
            <a
              href="/#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/', '#how-it-works');
                setIsMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all"
            >
              How it works
            </a>
            <a
              href="/#developer-tools"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/', '#developer-tools');
                setIsMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all"
            >
              CLI &amp; MCP
            </a>
            <a
              href="/#security"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/', '#security');
                setIsMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all"
            >
              Security
            </a>
            <a
              href="/#open-source"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/', '#open-source');
                setIsMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all"
            >
              Open source
            </a>
            <a
              href="/registry"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/registry');
                setIsMobileMenuOpen(false);
              }}
              className={`py-2 px-3 rounded-lg hover:text-slate-100 hover:bg-slate-800/40 transition-all ${currentPath === '/registry' ? 'text-cyan-400 bg-cyan-950/20 border border-cyan-800/30 font-bold' : ''}`}
            >
              Registry
            </a>

            {/* GitHub Stars Button in mobile menu (when screen is extra small) */}
            <div className="sm:hidden pt-2 border-t border-slate-800/60 flex items-center justify-between px-3">
              <span className="text-slate-400 text-xs font-semibold">GitHub Stars</span>
              <GitHubButton
                href="https://github.com/jmxt3/gitscape.ai"
                data-color-scheme="no-preference: dark; light: dark; dark: dark;"
                data-size="large"
                data-show-count="true"
                aria-label="Star jmxt3/gitscape.ai on GitHub"
              >
                Stars
              </GitHubButton>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};