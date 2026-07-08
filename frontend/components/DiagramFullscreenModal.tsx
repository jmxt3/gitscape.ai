
import React, { useEffect } from 'react';
import { Diagram } from './Diagram';
import { RawDiagramNode } from '../types';

interface DiagramFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: RawDiagramNode;
  repoName: string;
  defaultBranch: string;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const DiagramFullscreenModal: React.FC<DiagramFullscreenModalProps> = ({
  isOpen,
  onClose,
  data,
  repoName,
  defaultBranch,
}) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-fullscreen-modal-title"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden border border-slate-700"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <h2 id="diagram-fullscreen-modal-title" className="text-xl font-semibold text-green-400 truncate">
            Diagram View: {repoName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-green-300 rounded-full hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            aria-label="Close fullscreen diagram view"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-grow p-1 sm:p-2 overflow-hidden"> 
          <Diagram
            data={data}
            repoName={repoName}
            defaultBranch={defaultBranch}
            isInFullscreenModal={true}
            showTitle={false} // Prevent Diagram from rendering its own title
          />
        </div>
      </div>
    </div>
  );
};
