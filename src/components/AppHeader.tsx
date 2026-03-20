import React from 'react';
import { Zap, Video, Loader2, RefreshCw, Palette, Gauge } from 'lucide-react';

interface AppHeaderProps {
  isPremium: boolean;
  isLoading: boolean;
  isRecording: boolean;
  particleSpeed: number;
  particleColor: string;
  onTogglePremium: () => void;
  onRefresh: () => void;
  onDownload: () => void;
  onParticleSpeedChange: (value: number) => void;
  onParticleColorChange: (value: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isPremium,
  isLoading,
  isRecording,
  particleSpeed,
  particleColor,
  onTogglePremium,
  onRefresh,
  onDownload,
  onParticleSpeedChange,
  onParticleColorChange,
}) => (
  <header className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-10 px-3 py-2 flex items-center gap-2 min-w-0">
    {/* Logo + title */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm">
        <Zap size={16} className="text-white" />
      </div>
      <h1 className="font-bold text-sm md:text-base leading-tight text-slate-800 whitespace-nowrap">
        Mermaid<span className="hidden sm:inline"> Animation</span>
      </h1>
    </div>

    {/* Particle controls — desktop only */}
    {isPremium && (
      <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" title="更改粒子速度">
          <Gauge size={13} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">速度</span>
          <input
            type="range" min="0.1" max="5" step="0.1"
            value={particleSpeed}
            onChange={e => onParticleSpeedChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" title="更改粒子顏色">
          <Palette size={13} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">粒子色</span>
          <input
            type="color" value={particleColor}
            onChange={e => onParticleColorChange(e.target.value)}
            className="w-6 h-6 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer"
          />
        </label>
      </div>
    )}

    {/* Action buttons — desktop only */}
    <div className="hidden md:flex items-center gap-1.5 ml-auto flex-shrink-0">
      <button
        onClick={onRefresh}
        className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 rounded text-xs flex items-center gap-1 shadow-sm transition-colors"
        title="重新渲染"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        重新渲染
      </button>
      <button
        onClick={onTogglePremium}
        className={`px-2.5 py-1.5 rounded text-xs border shadow-sm transition-colors flex items-center gap-1 ${
          isPremium
            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
            : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span>{isPremium ? '✨' : '◻'}</span>
        {isPremium ? 'Export' : 'Draft'}
      </button>
      <button
        onClick={onDownload}
        disabled={isRecording}
        className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1 font-bold shadow-sm transition-transform ${
          isRecording
            ? 'bg-red-100 text-red-600 border border-red-200'
            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
        }`}
      >
        <Video size={14} />
        {isRecording ? 'REC...' : 'Download'}
      </button>
    </div>
  </header>
);
