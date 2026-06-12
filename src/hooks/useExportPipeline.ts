import { useCallback } from 'react';
import { renderFrame } from '../utils/canvasRenderer';
import type { ExportBg, ParticleShape, CanvasBgMode, RenderFrameOptions } from '../utils/canvasRenderer';
import type { ExportFormat } from '../components/ExportModal';
import type { DownloadFormat } from './useMediaRecorder';
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import type { Particle } from '../utils/particle';

/**
 * Tight-crop export frame: output canvas sized to the diagram plus padding,
 * with a supersampled (SS×) intermediate for sharp downscaling. Falls back to
 * 1920×1080 when the diagram size is not known yet.
 */
export const computeExportFrame = (
  diagramSize: { w: number; h: number },
  padding = 40,
  ss = 2
) => {
  const OUT_W = diagramSize.w > 0 ? Math.round(diagramSize.w + padding * 2) : 1920;
  const OUT_H = diagramSize.h > 0 ? Math.round(diagramSize.h + padding * 2) : 1080;
  return {
    OUT_W,
    OUT_H,
    SS_W: OUT_W * ss,
    SS_H: OUT_H * ss,
    ssTr: { x: padding * ss, y: padding * ss, scale: ss },
  };
};

interface UseExportPipelineArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hiddenContainerRef: React.RefObject<HTMLDivElement | null>;
  diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  hoveredNodeIdRef: React.RefObject<string | null>;
  code: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  particles: Particle[];
  seqLabels: SeqLabel[];
  particleColor: string;
  particleSpeed: number;
  particleSize: number;
  particleShape: ParticleShape;
  canvasBgMode: CanvasBgMode;
  isRecording: boolean;
  startDownload: (
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
    opts: RenderFrameOptions,
    format: DownloadFormat
  ) => void;
  /** Called after a static export completes (e.g. to close the export modal). */
  onExported: () => void;
}

/**
 * Owns the static (PNG / SVG / MMD) and video (MP4 / GIF) export paths plus
 * the export-preview render, so App.tsx only wires UI events to these.
 */
export const useExportPipeline = ({
  canvasRef,
  hiddenContainerRef,
  diagramSizeRef,
  hoveredNodeIdRef,
  code,
  nodes,
  edges,
  particles,
  seqLabels,
  particleColor,
  particleSpeed,
  particleSize,
  particleShape,
  canvasBgMode,
  isRecording,
  startDownload,
  onExported,
}: UseExportPipelineArgs) => {
  // Static exports render without recording chrome, hover, or live background.
  const staticRenderOpts = useCallback(
    (exportBg: ExportBg, showParticles: boolean): RenderFrameOptions => ({
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
      showParticles,
    }),
    [nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape]
  );

  const buildExportFrame = useCallback((padding = 40, ss = 2) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const diagramOffset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
    return { ...computeExportFrame(diagramSizeRef.current, padding, ss), diagramOffset };
  }, [canvasRef, diagramSizeRef]);

  // Video / GIF download of the live canvas.
  const handleDownload = useCallback((format: DownloadFormat) => {
    startDownload(
      canvasRef,
      diagramSizeRef,
      { nodes, edges, particles, seqLabels, isPremium: true, particleColor, particleSpeed, particleSize, particleShape, isRecording, hoveredNodeId: hoveredNodeIdRef.current, canvasBgMode },
      format
    );
  }, [startDownload, canvasRef, diagramSizeRef, hoveredNodeIdRef, nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape, isRecording, canvasBgMode]);

  // Preview render — used by ExportModal.
  const handlePreviewRender = useCallback((exportBg: ExportBg, dstCanvas: HTMLCanvasElement, showParticles = true) => {
    const frame = buildExportFrame(40, 1);
    if (!frame) return;
    const { OUT_W, OUT_H, ssTr, diagramOffset } = frame;
    dstCanvas.width  = OUT_W;
    dstCanvas.height = OUT_H;
    const ctx = dstCanvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, OUT_W, OUT_H, ssTr, diagramOffset, false, staticRenderOpts(exportBg, showParticles));
  }, [buildExportFrame, staticRenderOpts]);

  // Static export: PNG (tight-crop supersampled), SVG (Mermaid output), or MMD (raw source).
  const handleExport = useCallback((exportBg: ExportBg, format: ExportFormat = 'png', showParticles = true) => {
    // MMD: download raw Mermaid source
    if (format === 'mmd') {
      const blob = new Blob([code], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = 'flowmotion.mmd';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      onExported();
      return;
    }

    // SVG: grab the Mermaid-rendered SVG from the hidden container
    if (format === 'svg') {
      const svgEl = hiddenContainerRef.current?.querySelector('svg');
      if (!svgEl) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = 'flowmotion.svg';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      onExported();
      return;
    }

    // PNG: tight-crop supersampled render
    const frame = buildExportFrame();
    if (!frame) return;
    const { OUT_W, OUT_H, SS_W, SS_H, ssTr, diagramOffset } = frame;

    const ssCanvas = document.createElement('canvas');
    ssCanvas.width  = SS_W;
    ssCanvas.height = SS_H;
    const ssCtx = ssCanvas.getContext('2d')!;
    renderFrame(ssCtx, SS_W, SS_H, ssTr, diagramOffset, false, staticRenderOpts(exportBg, showParticles));

    const outCanvas = document.createElement('canvas');
    outCanvas.width  = OUT_W;
    outCanvas.height = OUT_H;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.drawImage(ssCanvas, 0, 0, OUT_W, OUT_H);

    const link = document.createElement('a');
    link.download = 'flowmotion.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();

    onExported();
  }, [buildExportFrame, staticRenderOpts, code, hiddenContainerRef, onExported]);

  return { handleDownload, handlePreviewRender, handleExport };
};
