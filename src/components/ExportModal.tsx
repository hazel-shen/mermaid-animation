import React, { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import type { ExportBg } from '../utils/canvasRenderer';

export type ExportFormat = 'png' | 'svg' | 'mmd';

interface ExportModalProps {
  onConfirm: (bg: ExportBg, format: ExportFormat) => void;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'png', label: 'PNG', desc: 'High quality raster image' },
  { value: 'svg', label: 'SVG', desc: 'Scalable vector graphics' },
  { value: 'mmd', label: 'MMD', desc: 'Mermaid syntax code' },
];

const BG_OPTIONS: { value: ExportBg; label: string; style: React.CSSProperties }[] = [
  { value: 'solid',        label: 'White',       style: { background: '#ffffff', border: '1.5px solid #e2e8f0' } },
  { value: 'checkerboard', label: 'Dark',         style: { background: '#1e293b' } },
  { value: 'transparent',  label: 'Transparent',  style: { backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%)', backgroundSize: '8px 8px' } },
];

export const ExportModal: React.FC<ExportModalProps> = ({ onConfirm, onClose, canvasRef }) => {
  const [selectedBg, setSelectedBg]         = useState<ExportBg>('solid');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Snapshot on open (once) and re-draw when bg changes
  useEffect(() => {
    const src = canvasRef.current;
    const dst = previewRef.current;
    if (!src || !dst) return;
    const ctx = dst.getContext('2d');
    if (!ctx) return;

    const W = dst.width;
    const H = dst.height;
    ctx.clearRect(0, 0, W, H);

    if (selectedBg === 'solid') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    } else if (selectedBg === 'checkerboard') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, H);
    } else {
      const sz = 8;
      for (let y = 0; y < H; y += sz)
        for (let x = 0; x < W; x += sz) {
          ctx.fillStyle = (Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0 ? '#cbd5e1' : '#ffffff';
          ctx.fillRect(x, y, sz, sz);
        }
    }
    ctx.drawImage(src, 0, 0, W, H);
  }, [selectedBg, canvasRef]);

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
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Fmt</p>
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
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Bg</p>
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
                onClick={() => onConfirm(selectedBg, selectedFormat)}
                className="w-full py-1 rounded bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center gap-0.5 hover:bg-slate-700 transition-colors"
              >
                <Download size={8} />
                Go
              </button>
              <button
                onClick={onClose}
                className="w-full py-0.5 rounded border border-gray-200 text-[9px] text-slate-500 hover:bg-gray-50 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: preview ── */}
        <div className="flex-1 flex flex-col bg-gray-100 min-w-0 relative">
          <div className="absolute top-2 left-3 z-10">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Preview</span>
          </div>
          <button
            onClick={onClose}
            className="absolute top-1.5 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={13} />
          </button>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            <canvas
              ref={previewRef}
              width={960}
              height={540}
              style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
