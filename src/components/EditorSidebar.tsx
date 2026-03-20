import React from 'react';
import { Code, X } from 'lucide-react';

interface EditorSidebarProps {
  code: string;
  errorMsg: string | null;
  isOpen: boolean;
  isDesktop: boolean;
  editorWidth: number;
  isResizing: boolean;
  onCodeChange: (value: string) => void;
  onToggleOpen: (open: boolean) => void;
  onLoadSequence: () => void;
  onLoadFlowchart: () => void;
  onLoadArch: () => void;
  onLoadClass: () => void;
  onLoadState: () => void;
  onLoadEr: () => void;
  onLoadGantt: () => void;
  onLoadPie: () => void;
  onLoadGitGraph: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

interface SampleButton {
  label: string;
  shortLabel: string;
  onClick: () => void;
  color: string;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  code,
  errorMsg,
  isOpen,
  isDesktop,
  editorWidth,
  isResizing,
  onCodeChange,
  onToggleOpen,
  onLoadSequence,
  onLoadFlowchart,
  onLoadArch,
  onLoadClass,
  onLoadState,
  onLoadEr,
  onLoadGantt,
  onLoadPie,
  onLoadGitGraph,
  onResizeStart,
}) => {
  const sampleButtons: SampleButton[] = [
    { label: 'Sequence', shortLabel: 'Seq', onClick: onLoadSequence, color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700' },
    { label: 'Flowchart', shortLabel: 'Flow', onClick: onLoadFlowchart, color: 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700' },
    { label: 'Architecture', shortLabel: 'Arch', onClick: onLoadArch, color: 'bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-700' },
    { label: 'Class', shortLabel: 'Class', onClick: onLoadClass, color: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700' },
    { label: 'State', shortLabel: 'State', onClick: onLoadState, color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700' },
    { label: 'ER', shortLabel: 'ER', onClick: onLoadEr, color: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700' },
    { label: 'Gantt', shortLabel: 'Gantt', onClick: onLoadGantt, color: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700' },
    { label: 'Pie', shortLabel: 'Pie', onClick: onLoadPie, color: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' },
    { label: 'Git Graph', shortLabel: 'Git', onClick: onLoadGitGraph, color: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700' },
  ];

  return (
    <div
      className={`
        flex-shrink-0 border-gray-200 flex flex-col bg-white relative
        ${isOpen
          ? 'h-[40vh] lg:h-auto border-b lg:border-b-0 lg:border-r'
          : 'h-8 lg:h-auto border-b-0 lg:border-r'
        }
      `}
      style={isDesktop
        ? { width: isOpen ? editorWidth : 32, transition: isResizing ? 'none' : 'width 0.25s ease' }
        : undefined
      }
    >
      {/* Header bar */}
      <div className="px-2 py-1.5 border-b border-gray-200 text-xs font-semibold text-slate-500 flex justify-between items-center bg-gray-50 flex-shrink-0 min-w-0">
        {isOpen ? (
          <>
            <span className="flex items-center gap-1.5 truncate"><Code size={12} /> MERMAID SOURCE</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Collapse button — desktop only */}
              <button
                onClick={() => onToggleOpen(false)}
                className="hidden lg:flex ml-1 w-5 h-5 items-center justify-center rounded hover:bg-gray-200 text-slate-400 hover:text-slate-600 transition-colors"
                title="收合編輯器"
              >
                <X size={11} />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => onToggleOpen(true)}
            className="hidden lg:flex w-full h-full items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            title="展開編輯器"
          >
            <Code size={13} />
          </button>
        )}
        {/* Mobile collapse/expand */}
        {isOpen && (
          <button
            onClick={() => onToggleOpen(false)}
            className="lg:hidden ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-slate-400 transition-colors"
            title="收合編輯器"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Sample diagram buttons */}
      {isOpen && (
        <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">範例圖表</p>
          <div className="flex flex-wrap gap-1">
            {sampleButtons.map(btn => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className={`px-1.5 py-0.5 text-[10px] border rounded transition-colors ${btn.color}`}
                title={btn.label}
              >
                <span className="hidden xl:inline">{btn.label}</span>
                <span className="xl:hidden">{btn.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor content */}
      {isOpen && (
        <>
          <textarea
            value={code}
            onChange={e => onCodeChange(e.target.value)}
            className="flex-1 bg-white text-slate-800 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            spellCheck={false}
          />
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs border-t border-red-100">⚠️ {errorMsg}</div>
          )}
        </>
      )}

      {/* Resize handle — desktop only */}
      {isDesktop && isOpen && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-30 group"
          title="拖曳調整寬度"
        >
          <div className="absolute inset-y-0 right-0 w-1 bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full" />
        </div>
      )}
    </div>
  );
};
