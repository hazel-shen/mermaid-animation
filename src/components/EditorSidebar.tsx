import React from 'react';
import { Code, FileText, Activity, Server, X } from 'lucide-react';

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
  onResizeStart: (e: React.MouseEvent) => void;
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
  onResizeStart,
}) => (
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
            <button onClick={onLoadSequence} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Sequence">
              <FileText size={9} /> <span className="hidden xl:inline">Sequence</span><span className="xl:hidden">Seq</span>
            </button>
            <button onClick={onLoadFlowchart} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Flowchart">
              <Activity size={9} /> <span className="hidden xl:inline">Flowchart</span><span className="xl:hidden">Flow</span>
            </button>
            <button onClick={onLoadArch} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Architecture">
              <Server size={9} /> <span className="hidden xl:inline">Architecture</span><span className="xl:hidden">Arch</span>
            </button>
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
