import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download } from 'lucide-react';
import type { ExportBg } from '../utils/canvasRenderer';

export type ExportFormat = 'png' | 'svg' | 'mmd';

interface ExportModalProps {
  onConfirm: (bg: ExportBg, format: ExportFormat, showParticles: boolean) => void;
  onClose: () => void;
  onPreviewRender: (bg: ExportBg, dstCanvas: HTMLCanvasElement, showParticles: boolean) => void;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'svg', label: 'SVG' },
  { value: 'mmd', label: 'MMD' },
];

export const ExportModal: React.FC<ExportModalProps> = ({ onConfirm, onClose, onPreviewRender }) => {
  const { t } = useTranslation();
  const [selectedBg, setSelectedBg]         = useState<ExportBg>('solid');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const previewRef = useRef<HTMLCanvasElement>(null);

  const BG_OPTIONS: { value: ExportBg; label: string; style: React.CSSProperties }[] = [
    { value: 'solid',        label: t('export.bgWhite'),       style: { background: '#ffffff', border: '1.5px solid #e2e8f0' } },
    { value: 'checkerboard', label: t('export.bgDark'),         style: { background: '#f8fafc', backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '8px 8px' } },
    { value: 'transparent',  label: t('export.bgTransparent'),  style: { backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%)', backgroundSize: '8px 8px' } },
  ];

  useEffect(() => {
    const dst = previewRef.current;
    if (!dst) return;
    onPreviewRender(selectedBg, dst, false);
  }, [selectedBg, selectedFormat, onPreviewRender]);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl flex overflow-hidden"
           style={{ width: 'min(90vw, 900px)', height: 'min(80vh, 560px)' }}>

        {/* ── Left sidebar ── */}
        <div className="flex flex-col w-11 shrink-0 border-r border-gray-100">
          <div className="flex flex-col gap-2 p-2 flex-1">
            {/* Format */}
            <div className="flex flex-col gap-0.5">
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">{t('export.format')}</p>
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedFormat(opt.value)}
                  title={opt.label}
                  className={`w-full py-0.5 rounded border text-center transition-all ${
                    selectedFormat === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${selectedFormat === opt.value ? 'text-blue-600' : 'text-slate-600'}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Background */}
            <div className="flex flex-col gap-0.5">
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">{t('export.background')}</p>
              <div className="flex flex-col gap-1">
                {BG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedBg(opt.value)}
                    title={opt.label}
                    className={`w-full h-4 rounded transition-all ${
                      selectedBg === opt.value ? 'ring-2 ring-blue-500 ring-offset-1' : 'ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                    style={opt.style}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onConfirm(selectedBg, selectedFormat, false)}
                className="w-full py-1 rounded bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center gap-0.5 hover:bg-slate-700 transition-colors"
              >
                <Download size={8} />
                {t('export.export')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: preview ── */}
        <div className="flex-1 flex flex-col bg-gray-100 min-w-0 relative">
          <div className="absolute top-2 left-3 z-10">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('export.preview')}</span>
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white/50 hover:bg-red-50 text-slate-400 hover:text-red-500 shadow-sm border border-gray-200/60 hover:border-red-200 transition-colors"
          >
            <X size={10} strokeWidth={2} />
          </button>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            <canvas
              ref={previewRef}
              style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
