import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Video, Film, RefreshCw, Gauge, Palette, Maximize2, Shapes, ImageIcon } from 'lucide-react';
import type { DownloadFormat } from '../hooks/useMediaRecorder';
import type { ParticleShape, CanvasBgMode } from '../utils/canvasRenderer';

interface MobileDrawerProps {
  isOpen: boolean;
  isLoading: boolean;
  isRecording: boolean;
  particleSpeed: number;
  particleColor: string;
  particleSize: number;
  particleShape: ParticleShape;
  canvasBgMode: CanvasBgMode;
  onClose: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onDownload: (format: DownloadFormat) => void;
  onParticleSpeedChange: (value: number) => void;
  onParticleColorChange: (value: string) => void;
  onParticleSizeChange: (value: number) => void;
  onParticleShapeChange: (value: ParticleShape) => void;
  onCanvasBgModeChange: (value: CanvasBgMode) => void;
}


export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  isLoading,
  isRecording,
  particleSpeed,
  particleColor,
  particleSize,
  particleShape,
  canvasBgMode,
  onClose,
  onExport,
  onRefresh,
  onDownload,
  onParticleSpeedChange,
  onParticleColorChange,
  onParticleSizeChange,
  onParticleShapeChange,
  onCanvasBgModeChange,
}) => {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('gif');

  const SHAPE_OPTIONS: { value: ParticleShape; label: string }[] = [
    { value: 'circle',   label: t('shapes.circle') },
    { value: 'square',   label: t('shapes.square') },
    { value: 'diamond',  label: t('shapes.diamond') },
    { value: 'triangle', label: t('shapes.triangle') },
    { value: 'star',     label: t('shapes.star') },
    { value: 'heart',    label: t('shapes.heart') },
    { value: 'hat',      label: t('shapes.hat') },
  ];

  const handleDownload = () => {
    onDownload(selectedFormat);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-xl shadow-2xl border-t border-gray-200 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: 'min(80vh, calc(100dvh - 100px))' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto overscroll-contain px-3 pt-1 flex flex-col gap-1.5"
          style={{
            maxHeight: 'min(calc(80vh - 24px), calc(100dvh - 124px))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          }}
        >

          {/* Particle settings — 2-col grid */}
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{t('drawer.particleSettings')}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer col-span-2">
              <Gauge size={14} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">{t('header.speed')}</span>
              <input
                type="range" min="0.1" max="5" step="0.1"
                value={particleSpeed}
                onChange={e => onParticleSpeedChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-sm text-slate-400 w-8 text-right tabular-nums">{particleSpeed.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer col-span-2">
              <Maximize2 size={14} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">{t('header.size')}</span>
              <input
                type="range" min="1" max="10" step="0.5"
                value={particleSize}
                onChange={e => onParticleSizeChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-sm text-slate-400 w-8 text-right tabular-nums">{particleSize.toFixed(1)}</span>
            </label>
            <div className="col-span-2 flex items-center gap-1.5 text-sm text-slate-600">
              <Shapes size={14} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">{t('header.shape')}</span>
              <select
                value={particleShape}
                onChange={e => onParticleShapeChange(e.target.value as ParticleShape)}
                className="rounded border border-gray-200 bg-white text-sm text-slate-700 px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {SHAPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <label className="col-span-2 flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer min-w-0 overflow-hidden">
              <Palette size={14} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap flex-shrink-0">{t('header.color')}</span>
              <input
                type="color" value={particleColor}
                onChange={e => onParticleColorChange(e.target.value)}
                className="w-4 h-4 rounded overflow-hidden border border-gray-200 p-0 bg-white cursor-pointer flex-shrink-0"
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
                className="min-w-0 flex-1 px-1 py-0.5 rounded border border-gray-200 text-sm font-mono text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </label>
            <div className="col-span-2 flex items-center gap-1.5 text-sm text-slate-600">
              <ImageIcon size={14} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap flex-shrink-0">{t('header.bg')}</span>
              <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => onCanvasBgModeChange('white')}
                  className={`px-3 py-1 transition-colors ${canvasBgMode === 'white' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-gray-50'}`}
                >
                  {t('header.bgWhite')}
                </button>
                <button
                  onClick={() => onCanvasBgModeChange('grid')}
                  className={`px-3 py-1 border-l border-gray-200 transition-colors ${canvasBgMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-gray-50'}`}
                >
                  {t('header.bgGrid')}
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Actions */}
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{t('drawer.actions')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onRefresh(); onClose(); }}
              className="flex items-center justify-center gap-1.5 px-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-slate-700 font-medium transition-colors"
            >
              <RefreshCw size={12} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              {t('drawer.rerender')}
            </button>
            <button
              onClick={() => { onExport(); onClose(); }}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              {t('drawer.exportPng')}
            </button>
          </div>

          {/* Download */}
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{t('drawer.download')}</p>
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setSelectedFormat('mp4')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-sm font-medium transition-all ${
                selectedFormat === 'mp4'
                  ? 'bg-white text-orange-600 shadow-sm font-bold'
                  : 'text-slate-500'
              }`}
            >
              <Video size={13} />
              MP4
            </button>
            <button
              onClick={() => setSelectedFormat('gif')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-sm font-medium transition-all ${
                selectedFormat === 'gif'
                  ? 'bg-white text-orange-600 shadow-sm font-bold'
                  : 'text-slate-500'
              }`}
            >
              <Film size={13} />
              GIF
            </button>
          </div>
          <button
            onClick={() => !isRecording && handleDownload()}
            disabled={isRecording}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-transform ${
              isRecording
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-[1.02]'
            }`}
          >
            {selectedFormat === 'gif' ? <Film size={14} /> : <Video size={14} />}
            {isRecording
              ? (selectedFormat === 'gif' ? t('drawer.processingGif') : t('drawer.recording'))
              : t('drawer.downloadFile', { format: selectedFormat.toUpperCase() })}
          </button>
        </div>
      </div>
    </>
  );
};
