import React, { useState } from 'react';
import { Video, RefreshCw, SlidersHorizontal, X, Gauge, Palette, Maximize2, Shapes } from 'lucide-react';
import type { DownloadFormat } from '../hooks/useMediaRecorder';
import type { ParticleShape } from '../utils/canvasRenderer';

const SHAPE_OPTIONS: { value: ParticleShape; label: string }[] = [
  { value: 'circle',   label: '● 圓形' },
  { value: 'square',   label: '■ 方形' },
  { value: 'diamond',  label: '◆ 菱形' },
  { value: 'triangle', label: '▲ 三角' },
  { value: 'star',     label: '★ 星形' },
  { value: 'heart',    label: '♥ 愛心' },
  { value: 'hat',      label: '🎩 帽子' },
];

interface MobileDrawerProps {
  isOpen: boolean;
  isLoading: boolean;
  isRecording: boolean;
  particleSpeed: number;
  particleColor: string;
  particleSize: number;
  particleShape: ParticleShape;
  onClose: () => void;
  onToggle: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onDownload: (format: DownloadFormat) => void;
  onParticleSpeedChange: (value: number) => void;
  onParticleColorChange: (value: string) => void;
  onParticleSizeChange: (value: number) => void;
  onParticleShapeChange: (value: ParticleShape) => void;
}

export const MobileDrawerFAB: React.FC<Pick<MobileDrawerProps, 'isOpen' | 'onToggle'>> = ({ isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className="md:hidden fixed bottom-16 right-3 z-30 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md"
    style={{
      background: isOpen
        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
        : 'linear-gradient(135deg, #3b82f6, #6366f1)',
    }}
    aria-label={isOpen ? '隱藏控制列' : '顯示控制列'}
  >
    {isOpen
      ? <X size={13} className="text-white" />
      : <SlidersHorizontal size={13} className="text-white" />
    }
  </button>
);

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  isLoading,
  isRecording,
  particleSpeed,
  particleColor,
  particleSize,
  particleShape,
  onClose,
  onToggle,
  onExport,
  onRefresh,
  onDownload,
  onParticleSpeedChange,
  onParticleColorChange,
  onParticleSizeChange,
  onParticleShapeChange,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('gif');

  const handleDownload = () => {
    onDownload(selectedFormat);
    onClose();
  };

  return (
    <>
      <MobileDrawerFAB isOpen={isOpen} onToggle={onToggle} />

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-4 pb-4 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">粒子設定</p>
              <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                <Gauge size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium w-14">速度</span>
                <input
                  type="range" min="0.1" max="5" step="0.1"
                  value={particleSpeed}
                  onChange={e => onParticleSpeedChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs text-slate-400 w-7 text-right tabular-nums">{particleSpeed.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                <Maximize2 size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium w-14">大小</span>
                <input
                  type="range" min="1" max="10" step="0.5"
                  value={particleSize}
                  onChange={e => onParticleSizeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs text-slate-400 w-7 text-right tabular-nums">{particleSize.toFixed(1)}</span>
              </label>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Shapes size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium w-14">形狀</span>
                <select
                  value={particleShape}
                  onChange={e => onParticleShapeChange(e.target.value as ParticleShape)}
                  className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 px-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {SHAPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                <Palette size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium w-14">粒子色</span>
                <input
                  type="color" value={particleColor}
                  onChange={e => onParticleColorChange(e.target.value)}
                  className="w-6 h-6 rounded overflow-hidden border border-gray-200 p-0.5 bg-white cursor-pointer flex-shrink-0"
                />
                <input
                  type="text"
                  value={particleColor}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) onParticleColorChange(v);
                  }}
                  maxLength={7}
                  spellCheck={false}
                  className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-sm font-mono text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
            </div>

          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">操作</p>
            <button
              onClick={() => { onRefresh(); onClose(); }}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm text-slate-700 font-medium transition-colors"
            >
              <RefreshCw size={16} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              重新渲染
            </button>
            <button
              onClick={() => { onExport(); onClose(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <span className="text-base">✨</span>
              匯出靜態圖（PNG）
            </button>

            {/* Download section */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">下載格式</p>

              {/* Format toggle */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setSelectedFormat('mp4')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFormat === 'mp4'
                      ? 'bg-white text-orange-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Video size={14} />
                  MP4
                </button>
                <button
                  onClick={() => setSelectedFormat('gif')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFormat === 'gif'
                      ? 'bg-white text-orange-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">GIF</span>
                  GIF
                </button>
              </div>

              <button
                onClick={() => !isRecording && handleDownload()}
                disabled={isRecording}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-transform ${
                  isRecording
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-[1.02]'
                }`}
              >
                {selectedFormat === 'gif'
                  ? <span className="text-xs font-extrabold">GIF</span>
                  : <Video size={16} />
                }
                {isRecording
                  ? (selectedFormat === 'gif' ? '處理 GIF 中...' : '錄製中...')
                  : `下載 ${selectedFormat.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
