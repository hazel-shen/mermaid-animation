import React from 'react';
import { Loader2, Code } from 'lucide-react';
import { ZoomToolbar } from './ZoomToolbar';
import type { Transform } from '../types';

interface CanvasViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  isEditorOpen: boolean;
  transformState: Transform;
  onOpenEditor: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  canvasRef,
  containerRef,
  isLoading,
  isEditorOpen,
  transformState,
  onOpenEditor,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}) => (
  <div ref={containerRef} className="flex-1 relative overflow-hidden min-h-0 bg-gray-100">
    {isLoading && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 z-10 backdrop-blur-sm">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Rendering...</p>
      </div>
    )}

    {/* Open editor button — desktop only */}
    {!isEditorOpen && (
      <button
        onClick={onOpenEditor}
        className="hidden lg:flex absolute top-3 left-3 z-20 items-center gap-1.5 px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm text-xs text-slate-600 hover:bg-white transition-colors"
        title="展開編輯器"
      >
        <Code size={12} />
        <span>編輯</span>
      </button>
    )}

    {/* Desktop open-editor button only — mobile pill is rendered at App level */}

    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      className="block w-full h-full"
      style={{ cursor: 'grab' }}
    />

    {/* Desktop ZoomToolbar — bottom right */}
    <div className="hidden lg:block">
      <ZoomToolbar
        scale={transformState.scale}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFit={onFit}
        onReset={onReset}
      />
    </div>
  </div>
);
