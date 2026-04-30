import React, { useState, useRef, useEffect } from 'react';
import { Zap, Video, RefreshCw, Palette, Gauge, ChevronDown, Maximize2, Shapes, ChevronUp } from 'lucide-react';
const githubLogo = 'https://raw.githubusercontent.com/hazel-shen/mermaid-animation/refs/heads/main/src/assets/github-logo.png';
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

interface AppHeaderProps {
  isLoading: boolean;
  isRecording: boolean;
  particleSpeed: number;
  particleColor: string;
  particleSize: number;
  particleShape: ParticleShape;
  onExport: () => void;
  onRefresh: () => void;
  onDownload: (format: DownloadFormat) => void;
  onParticleSpeedChange: (value: number) => void;
  onParticleColorChange: (value: string) => void;
  onParticleSizeChange: (value: number) => void;
  onParticleShapeChange: (value: ParticleShape) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isLoading,
  isRecording,
  particleSpeed,
  particleColor,
  particleSize,
  particleShape,
  onExport,
  onRefresh,
  onDownload,
  onParticleSpeedChange,
  onParticleColorChange,
  onParticleSizeChange,
  onParticleShapeChange,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('gif');
  const [headerOpen, setHeaderOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFormat = (fmt: DownloadFormat) => {
    setSelectedFormat(fmt);
    setDropdownOpen(false);
  };

  return (
    <>
      {/* Floating expand button — desktop only, shown when header is hidden */}
      {!headerOpen && (
        <button
          onClick={() => setHeaderOpen(true)}
          title="展開控制列"
          className="hidden md:flex fixed top-3 right-3 z-50 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 bg-white/70 backdrop-blur border border-gray-200 shadow-md hover:bg-white/90 transition-all"
        >
          <ChevronDown size={13} />
          控制列
        </button>
      )}

      {/* Full header bar */}
      <header className={`border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-50 min-w-0 transition-all duration-200 ${
        headerOpen ? '' : 'hidden md:hidden'
      }`}>
      {/* Full bar — logo | particle controls | action buttons | collapse toggle */}
      <div className="px-3 py-2 flex items-center gap-2 min-w-0">

        {/* Logo + title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="font-bold text-sm md:text-base text-slate-800 whitespace-nowrap">
              Mermaid Animation
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">mermaid v11.13.0</span>
              <a
                href="https://github.com/hazel-shen/mermaid-animation"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
                className="flex items-center hover:opacity-70 transition-opacity"
              >
                <img src={githubLogo} alt="GitHub" className="w-3 h-3 object-contain" />
              </a>
            </div>
          </div>
        </div>

        {/* Particle controls + action buttons — desktop */}
        <div className="hidden md:flex items-center gap-2 min-w-0 flex-1">

          {/* Particle controls */}
          <div className="flex items-center gap-3 pl-3 ml-1 border-l border-gray-200 flex-shrink-0">
              {/* Speed + Size stacked */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" title="速度">
                  <Gauge size={11} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-7">速度</span>
                  <input
                    type="range" min="0.1" max="5" step="0.1"
                    value={particleSpeed}
                    onChange={e => onParticleSpeedChange(parseFloat(e.target.value))}
                    className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" title="大小">
                  <Maximize2 size={11} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-7">大小</span>
                  <input
                    type="range" min="1" max="10" step="0.5"
                    value={particleSize}
                    onChange={e => onParticleSizeChange(parseFloat(e.target.value))}
                    className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </label>
              </div>
              {/* Shape + Color stacked */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" title="形狀">
                  <Shapes size={11} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-7">形狀</span>
                  <select
                    value={particleShape}
                    onChange={e => onParticleShapeChange(e.target.value as ParticleShape)}
                    className="h-5 rounded border border-gray-200 bg-white text-xs text-slate-700 px-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    {SHAPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" title="粒子色">
                  <Palette size={11} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-7">粒子色</span>
                  <input
                    type="color" value={particleColor}
                    onChange={e => onParticleColorChange(e.target.value)}
                    className="w-4 h-4 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer flex-shrink-0"
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
                    className="w-16 h-5 px-1 rounded border border-gray-200 text-[10px] font-mono text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </label>
              </div>
            </div>

          {/* Action buttons — pushed to right */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button
              onClick={onRefresh}
              className="px-2 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded text-xs flex items-center gap-1 shadow-sm transition-all whitespace-nowrap border-0"
              title="重新渲染"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              重新渲染
            </button>
            <button
              onClick={onExport}
              className="px-2 py-1.5 rounded text-xs shadow-sm transition-all flex items-center gap-1 whitespace-nowrap border-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              ✨ Export
            </button>

            {/* Split download button */}
            <div ref={dropdownRef} className="relative flex">
              <button
                onClick={() => !isRecording && onDownload(selectedFormat)}
                disabled={isRecording}
                className={`px-2 py-1.5 rounded-l text-xs flex items-center gap-1 font-bold shadow-sm transition-transform whitespace-nowrap ${
                  isRecording
                    ? 'bg-red-100 text-red-600 border border-red-200'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
                }`}
                title={`下載 ${selectedFormat.toUpperCase()}`}
              >
                <Video size={13} />
                {isRecording
                  ? (selectedFormat === 'gif' ? 'GIF...' : 'REC...')
                  : `Download ${selectedFormat.toUpperCase()}`}
              </button>
              <button
                onClick={() => !isRecording && setDropdownOpen(v => !v)}
                disabled={isRecording}
                className={`px-1.5 py-1.5 rounded-r text-xs font-bold shadow-sm border-l transition-transform ${
                  isRecording
                    ? 'bg-red-100 text-red-600 border border-red-200 border-l-red-300'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:scale-105 border-l-red-400'
                }`}
                title="選擇格式"
              >
                <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[200] min-w-[120px]">
                  <button
                    onClick={() => handleSelectFormat('mp4')}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-orange-50 transition-colors ${selectedFormat === 'mp4' ? 'text-orange-600 font-bold bg-orange-50' : 'text-slate-700'}`}
                  >
                    <Video size={12} />
                    MP4 影片
                    {selectedFormat === 'mp4' && <span className="ml-auto text-orange-500">✓</span>}
                  </button>
                  <button
                    onClick={() => handleSelectFormat('gif')}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-orange-50 transition-colors ${selectedFormat === 'gif' ? 'text-orange-600 font-bold bg-orange-50' : 'text-slate-700'}`}
                  >
                    <span className="text-[10px] font-bold leading-none">GIF</span>
                    GIF 動圖
                    {selectedFormat === 'gif' && <span className="ml-auto text-orange-500">✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Collapse toggle — inside action buttons */}
            <button
              onClick={() => setHeaderOpen(false)}
              title="收起控制列"
              className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        </div>

      </div>
      </header>
    </>
  );
};
