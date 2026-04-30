import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onLoadSample(e.target.value);
  };

  return (
    <div
      className={`
        flex-shrink-0 flex flex-col relative
        ${isOpen
          ? 'h-[40vh] lg:h-auto border-b lg:border-b-0 lg:border-r border-slate-700'
          : 'h-0 lg:h-auto overflow-hidden lg:overflow-visible border-b-0 lg:border-r border-slate-700'
        }
      `}
      style={{
        background: '#1e1e2e',
        ...(isDesktop ? { width: isOpen ? editorWidth : 32, transition: isResizing ? 'none' : 'width 0.25s ease' } : {}),
      }}
    >
      {/* Header bar */}
      <div className="px-3 py-2.5 text-sm font-bold flex justify-between items-center flex-shrink-0 min-w-0"
        style={{ background: '#16162a', borderBottom: '1px solid #3a3a5e', color: '#ffffff' }}>
        {isOpen ? (
          <>
            <span className="flex items-center gap-2 truncate">
              <Code size={15} />
              MERMAID SOURCE
            </span>
            <button
              onClick={() => onToggleOpen(false)}
              className="hidden lg:flex ml-1 w-6 h-6 items-center justify-center rounded transition-colors"
              style={{ color: '#a0a0cc' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2e2e4a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              title={t('editor.collapseEditor')}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <button
            onClick={() => onToggleOpen(true)}
            className="hidden lg:flex w-full h-full items-center justify-center transition-colors"
            style={{ color: '#a0a0cc' }}
            title={t('editor.expandEditor')}
          >
            <Code size={15} />
          </button>
        )}
        {isOpen && (
          <button
            onClick={() => onToggleOpen(false)}
            className="lg:hidden ml-1 w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: '#a0a0cc' }}
            title={t('editor.collapseEditor')}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Sample dropdown */}
      {isOpen && (
        <div className="px-2 py-1.5 flex-shrink-0 flex items-center gap-1.5"
          style={{ borderBottom: '1px solid #3a3a5e' }}>
          <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#8888bb' }}>{t('editor.samples')}</span>
          <div className="relative flex-1 min-w-0">
            <select
              value={selectedSample}
              onChange={handleSelect}
              className="w-full appearance-none rounded font-medium pl-2 pr-6 py-1 focus:outline-none cursor-pointer"
              style={{ background: '#2a2a3e', border: '1px solid #4a4a6e', color: '#ffffff', fontSize: '14px' }}
            >
              {samples.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8888bb' }} />
          </div>
        </div>
      )}

      {/* Editor textarea */}
      {isOpen && (
        <>
          <textarea
            value={code}
            onChange={e => onCodeChange(e.target.value)}
            className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
            style={{ background: '#1e1e2e', color: '#cdd6f4', caretColor: '#89b4fa' }}
            spellCheck={false}
          />
          {errorMsg && (
            <div className="p-3 text-xs" style={{ background: '#2a1a1a', color: '#f38ba8', borderTop: '1px solid #4a2a2a' }}>
              ⚠️ {errorMsg}
            </div>
          )}
        </>
      )}

      {/* Resize handle — desktop only */}
      {isDesktop && isOpen && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-30 group"
          title={t('editor.resizeHandle')}
        >
          <div className="absolute inset-y-0 right-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full"
            style={{ background: '#6366f1' }} />
        </div>
      )}
    </div>
  );
};
