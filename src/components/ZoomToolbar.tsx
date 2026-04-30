import React from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface ZoomToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  /** Renders inline (no absolute positioning) */
  inline?: boolean;
  /** Compact mode: only scale% + fit button */
  compact?: boolean;
}

export const ZoomToolbar: React.FC<ZoomToolbarProps> = ({ scale, onZoomIn, onZoomOut, onFit, onReset, inline, compact }) => {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-0 bg-white/90 backdrop-blur border border-gray-200 rounded-md shadow-sm px-1 py-px touch-none select-none ${inline ? '' : 'absolute bottom-3 right-3 z-20'}`}>
      <span className="text-xs font-mono text-slate-400 w-8 text-center tabular-nums">
        {Math.round(scale * 100)}%
      </span>
      {!compact && (
        <>
          <div className="w-px h-3 bg-gray-200" />
          <button
            onPointerDown={e => { e.stopPropagation(); onZoomOut(); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
            title={t('zoom.zoomOut')}
          >
            <ZoomOut size={18} />
          </button>
          <button
            onPointerDown={e => { e.stopPropagation(); onZoomIn(); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
            title={t('zoom.zoomIn')}
          >
            <ZoomIn size={18} />
          </button>
        </>
      )}
      <div className="w-px h-3 bg-gray-200" />
      <button
        onPointerDown={e => { e.stopPropagation(); onFit(); }}
        className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
        title={t('zoom.fit')}
      >
        <Maximize2 size={18} />
      </button>
      {!compact && (
        <button
          onPointerDown={e => { e.stopPropagation(); onReset(); }}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-400"
          title={t('zoom.reset')}
        >
          <RotateCcw size={18} />
        </button>
      )}
    </div>
  );
};
