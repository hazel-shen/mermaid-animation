import React from 'react';
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

export const ZoomToolbar: React.FC<ZoomToolbarProps> = ({ scale, onZoomIn, onZoomOut, onFit, onReset, inline, compact }) => (
  <div className={`flex items-center gap-0.5 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 touch-none select-none ${inline ? '' : 'absolute bottom-3 right-3 z-20'}`}>
    <span className="text-[9px] font-mono text-slate-400 w-7 text-center tabular-nums">
      {Math.round(scale * 100)}%
    </span>
    {!compact && (
      <>
        <div className="w-px h-3 bg-gray-200" />
        <button
          onPointerDown={e => { e.stopPropagation(); onZoomOut(); }}
          className="w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
          title="縮小"
        >
          <ZoomOut size={11} />
        </button>
        <button
          onPointerDown={e => { e.stopPropagation(); onZoomIn(); }}
          className="w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
          title="放大"
        >
          <ZoomIn size={11} />
        </button>
      </>
    )}
    <div className="w-px h-3 bg-gray-200" />
    <button
      onPointerDown={e => { e.stopPropagation(); onFit(); }}
      className="w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
      title="符合畫面"
    >
      <Maximize2 size={11} />
    </button>
    {!compact && (
      <button
        onPointerDown={e => { e.stopPropagation(); onReset(); }}
        className="w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-400"
        title="重置"
      >
        <RotateCcw size={10} />
      </button>
    )}
  </div>
);
