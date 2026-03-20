import React from 'react';
import { Code, X, ChevronDown } from 'lucide-react';

export interface SampleOption {
  value: string;
  label: string;
}


interface EditorSidebarProps {
  code: string;
  errorMsg: string | null;
  isOpen: boolean;
  isDesktop: boolean;
  editorWidth: number;
  isResizing: boolean;
  samples: SampleOption[];
  selectedSample: string;
  onCodeChange: (value: string) => void;
  onToggleOpen: (open: boolean) => void;
  onLoadSample: (value: string) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  code,
  errorMsg,
  isOpen,
  isDesktop,
  editorWidth,
  isResizing,
  samples,
  selectedSample,
  onCodeChange,
  onToggleOpen,
  onLoadSample,
  onResizeStart,
}) => {
  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onLoadSample(e.target.value);
  };

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
            <button
              onClick={() => onToggleOpen(false)}
              className="hidden lg:flex ml-1 w-5 h-5 items-center justify-center rounded hover:bg-gray-200 text-slate-400 hover:text-slate-600 transition-colors"
              title="收合編輯器"
            >
              <X size={11} />
            </button>
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

      {/* Sample dropdown */}
      {isOpen && (
        <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">範例</span>
          <div className="relative flex-1 min-w-0">
            <select
              value={selectedSample}
              onChange={handleSelect}
              className="w-full appearance-none bg-white border border-gray-200 rounded text-[11px] text-slate-600 pl-2 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer hover:border-indigo-300 transition-colors"
            >
              {samples.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Editor textarea */}
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
