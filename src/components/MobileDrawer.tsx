import React from 'react';
import { Video, RefreshCw, SlidersHorizontal, X, Gauge, Palette } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  isPremium: boolean;
  isLoading: boolean;
  isRecording: boolean;
  particleSpeed: number;
  particleColor: string;
  onClose: () => void;
  onToggle: () => void;
  onTogglePremium: () => void;
  onRefresh: () => void;
  onDownload: () => void;
  onParticleSpeedChange: (value: number) => void;
  onParticleColorChange: (value: string) => void;
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
  isPremium,
  isLoading,
  isRecording,
  particleSpeed,
  particleColor,
  onClose,
  onToggle,
  onTogglePremium,
  onRefresh,
  onDownload,
  onParticleSpeedChange,
  onParticleColorChange,
}) => (
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
        {isPremium && (
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
              <Palette size={16} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium w-14">粒子色</span>
              <input
                type="color" value={particleColor}
                onChange={e => onParticleColorChange(e.target.value)}
                className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 p-0.5 bg-white cursor-pointer"
              />
              <span className="text-xs text-slate-400 font-mono">{particleColor}</span>
            </label>
          </div>
        )}

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
            onClick={onTogglePremium}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
              isPremium
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                : 'bg-gray-50 text-slate-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span className="text-base">{isPremium ? '✨' : '◻'}</span>
            {isPremium ? 'Export 模式（關閉切換 Draft）' : 'Draft 模式（點擊切換 Export）'}
          </button>
          <button
            onClick={() => { onDownload(); onClose(); }}
            disabled={isRecording}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-transform ${
              isRecording
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-[1.02]'
            }`}
          >
            <Video size={16} />
            {isRecording ? '錄製中...' : '下載影片'}
          </button>
        </div>
      </div>
    </div>
  </>
);
