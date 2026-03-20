import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface ZoomToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export const ZoomToolbar: React.FC<ZoomToolbarProps> = ({ scale, onZoomIn, onZoomOut, onFit, onReset }) => (
  <div className="absolute bottom-3 right-3 flex items-center gap-1 z-20 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm px-1.5 py-1">
    <span className="text-[10px] font-mono text-slate-400 w-8 text-center tabular-nums">
      {Math.round(scale * 100)}%
    </span>
    <div className="w-px h-3.5 bg-gray-200" />
    <button
      onClick={onZoomOut}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
      title="縮小"
    >
      <ZoomOut size={12} />
    </button>
    <button
      onClick={onZoomIn}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
      title="放大"
    >
      <ZoomIn size={12} />
    </button>
    <div className="w-px h-3.5 bg-gray-200" />
    <button
      onClick={onFit}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
      title="符合畫面"
    >
      <Maximize2 size={12} />
    </button>
    <button
      onClick={onReset}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-400"
      title="重置"
    >
      <RotateCcw size={11} />
    </button>
  </div>
);
