import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import type { ExportBg } from '../utils/canvasRenderer';

interface ExportModalProps {
  onConfirm: (bg: ExportBg) => void;
  onClose: () => void;
}

const BG_OPTIONS: { value: ExportBg; label: string; desc: string; preview: React.ReactNode }[] = [
  {
    value: 'solid',
    label: '純色',
    desc: '純白背景',
    preview: <div className="w-full h-full rounded border border-gray-100" style={{ background: '#ffffff' }} />,
  },
  {
    value: 'checkerboard',
    label: '原圖',
    desc: '與預覽相同',
    preview: (
      <div className="w-full h-full rounded relative overflow-hidden" style={{ background: '#f8fafc' }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(#e2e8f020 1px, transparent 1px), repeating-linear-gradient(90deg, #e2e8f020 1px, transparent 1px)',
            backgroundSize: '10px 10px',
          }}
        />
      </div>
    ),
  },
  {
    value: 'transparent',
    label: '透明',
    desc: '去背 PNG',
    preview: (
      <div className="w-full h-full rounded relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%)',
            backgroundSize: '12px 12px',
          }}
        />
      </div>
    ),
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({ onConfirm, onClose }) => {
  const [selected, setSelected] = useState<ExportBg>('solid');

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[340px] p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-base">匯出靜態圖</h2>
            <p className="text-xs text-slate-400 mt-0.5">選擇背景樣式，下載為 PNG</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Background options */}
        <div className="grid grid-cols-3 gap-2">
          {BG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                selected === opt.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="w-full h-14">{opt.preview}</div>
              <span className={`text-xs font-semibold ${selected === opt.value ? 'text-indigo-600' : 'text-slate-600'}`}>
                {opt.label}
              </span>
              <span className="text-[10px] text-slate-400">{opt.desc}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity shadow-sm"
          >
            <Download size={14} />
            下載 PNG
          </button>
        </div>
      </div>
    </div>
  );
};
