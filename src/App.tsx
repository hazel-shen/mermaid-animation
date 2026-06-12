import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { AppHeader } from './components/AppHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasView } from './components/CanvasView';
import { MobileDrawer } from './components/MobileDrawer';
import { MobilePillToolbar } from './components/MobilePillToolbar';
import { ExportModal, type ExportFormat } from './components/ExportModal';

import { useMermaidParser } from './hooks/useMermaidParser';
import { useCanvasTransform, useCanvasResize } from './hooks/useCanvasTransform';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useEditorResize } from './hooks/useEditorResize';

import { renderFrame } from './utils/canvasRenderer';
import type { ParticleShape, ExportBg } from './utils/canvasRenderer';

import { SAMPLES, SAMPLE_KEYS, DEFAULT_SAMPLE_KEY } from './constants/sampleDiagrams';

// --- 主元件 ---
const CanvasDiagram = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);

  const SAMPLE_OPTIONS = SAMPLE_KEYS.map(key => ({ value: key, label: t(`samples.${key}`) }));

  // UI state
  const [selectedSample, setSelectedSample] = useState(DEFAULT_SAMPLE_KEY);
  const [code, setCode] = useState(SAMPLES[DEFAULT_SAMPLE_KEY]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [particleColor, setParticleColor] = useState('#2ea4ff');
  const [particleSpeed, setParticleSpeed] = useState(1);
  const [particleSize, setParticleSize] = useState(3);
  const [particleShape, setParticleShape] = useState<ParticleShape>('circle');
  const [canvasBgMode, setCanvasBgMode] = useState<import('./utils/canvasRenderer').CanvasBgMode>('grid');
  const handleCanvasBgModeChange = useCallback((mode: import('./utils/canvasRenderer').CanvasBgMode) => {
    setCanvasBgMode(mode);
    if (mode === 'dark') setParticleColor('#a5b4fc');
    else setParticleColor('#2ea4ff');
  }, []);
  const [isControlBarOpen, setIsControlBarOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  // isDesktop listener
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // --- Hooks ---
  const { nodes, edges, seqLabels, isLoading, error, renderMermaidToData, viewBox } =
    useMermaidParser(code, true, hiddenContainerRef as React.RefObject<HTMLDivElement>);

  const particles = useParticleSystem(edges);

  const {
    transformRef,
    transformState,
    diagramSizeRef,
    fitToScreen,
    handleZoomIn,
    handleZoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    applyViewBox,
  } = useCanvasTransform(canvasRef);

  const { isRecording, startDownload } = useMediaRecorder();
  const { editorWidth, isResizingRef, handleResizeStart } = useEditorResize(320);

  // Keep canvas buffer synced to container size
  useCanvasResize(canvasRef, canvasContainerRef as React.RefObject<HTMLDivElement>);

  // Apply viewBox whenever a new diagram is parsed
  useEffect(() => {
    if (viewBox) {
      applyViewBox(viewBox, canvasRef, canvasContainerRef as React.RefObject<HTMLDivElement>);
    }
  }, [viewBox, applyViewBox]);

  // Bind wheel + touch events (needs passive:false to preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, nodes]);

  // --- Animation loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      // canvas.width/height are physical pixels; pass CSS-pixel dimensions to renderFrame
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
      const tr = transformRef.current;

      particles.forEach(p => p.update(particleSpeed));

      (canvas as any)._lastTransform = tr;
      renderFrame(ctx, w, h, tr, offset, isRecording, {
        nodes,
        edges,
        particles,
        seqLabels,
        isPremium: true,
        particleColor,
        particleSpeed,
        particleSize,
        particleShape,
        isRecording,
        hoveredNodeId: hoveredNodeIdRef.current,
        canvasBgMode,
      }, dpr);

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  // transformRef.current is read inside the loop directly — transformState intentionally omitted
  // to prevent the rAF loop from restarting on every pan/zoom event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, particles, seqLabels, isRecording, particleColor, particleSpeed, particleSize, particleShape, canvasBgMode]);

  // --- Download handler ---
  const handleDownload = useCallback((format: import('./hooks/useMediaRecorder').DownloadFormat) => {
    startDownload(
      canvasRef,
      diagramSizeRef,
      { nodes, edges, particles, seqLabels, isPremium: true, particleColor, particleSpeed, particleSize, particleShape, isRecording, hoveredNodeId: hoveredNodeIdRef.current, canvasBgMode },
      format
    );
  }, [startDownload, nodes, edges, particles, seqLabels, particleColor, particleSize, particleShape, isRecording, diagramSizeRef, canvasBgMode]);

  // --- Shared helper: build tight-crop render options ---
  const buildExportFrame = useCallback((PADDING = 40, SS = 2) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const diagramOffset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
    const { w: dw, h: dh } = diagramSizeRef.current;
    const OUT_W = dw > 0 ? Math.round(dw + PADDING * 2) : 1920;
    const OUT_H = dh > 0 ? Math.round(dh + PADDING * 2) : 1080;
    const SS_W = OUT_W * SS;
    const SS_H = OUT_H * SS;
    const ssTr = { x: PADDING * SS, y: PADDING * SS, scale: SS };
    return { OUT_W, OUT_H, SS_W, SS_H, ssTr, diagramOffset };
  }, [canvasRef, diagramSizeRef]);

  // --- Preview render callback — used by ExportModal ---
  const handlePreviewRender = useCallback((exportBg: ExportBg, dstCanvas: HTMLCanvasElement, showParticles = true) => {
    const frame = buildExportFrame(40, 1);
    if (!frame) return;
    const { OUT_W, OUT_H, ssTr, diagramOffset } = frame;
    dstCanvas.width  = OUT_W;
    dstCanvas.height = OUT_H;
    const ctx = dstCanvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, OUT_W, OUT_H, ssTr, diagramOffset, false, {
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
      showParticles,
    });
  }, [buildExportFrame, nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape]);

  // --- Static export handler ---
  const handleExport = useCallback((exportBg: ExportBg, format: ExportFormat = 'png', showParticles = true) => {
    // MMD: download raw Mermaid source
    if (format === 'mmd') {
      const blob = new Blob([code], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = 'flowmotion.mmd';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      setExportModalOpen(false);
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
      setExportModalOpen(false);
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
    renderFrame(ssCtx, SS_W, SS_H, ssTr, diagramOffset, false, {
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
      showParticles,
    });

    const outCanvas = document.createElement('canvas');
    outCanvas.width  = OUT_W;
    outCanvas.height = OUT_H;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.drawImage(ssCanvas, 0, 0, OUT_W, OUT_H);

    const link = document.createElement('a');
    link.download = 'flowmotion.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();

    setExportModalOpen(false);
  }, [buildExportFrame, code, hiddenContainerRef, nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape]);

  // --- Mouse event wrappers (bind hoveredNodeIdRef) ---
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => handleMouseMove(e, nodes, hoveredNodeIdRef),
    [handleMouseMove, nodes]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(hoveredNodeIdRef),
    [handleMouseLeave]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      {/* Hidden Mermaid render target */}
      <div
        ref={hiddenContainerRef}
        style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', pointerEvents: 'none' }}
      />

      <AppHeader
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        canvasBgMode={canvasBgMode}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
        onParticleSpeedChange={setParticleSpeed}
        onParticleColorChange={setParticleColor}
        onParticleSizeChange={setParticleSize}
        onParticleShapeChange={setParticleShape}
        onCanvasBgModeChange={handleCanvasBgModeChange}
      />

      {exportModalOpen && (
        <ExportModal
          onConfirm={handleExport}
          onClose={() => setExportModalOpen(false)}
          onPreviewRender={handlePreviewRender}
        />
      )}

      <MobileDrawer
        isOpen={isControlBarOpen}
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        canvasBgMode={canvasBgMode}
        onClose={() => setIsControlBarOpen(false)}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
        onParticleSpeedChange={setParticleSpeed}
        onParticleColorChange={setParticleColor}
        onParticleSizeChange={setParticleSize}
        onParticleShapeChange={setParticleShape}
        onCanvasBgModeChange={handleCanvasBgModeChange}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <EditorSidebar
          code={code}
          error={error}
          isOpen={isEditorOpen}
          isDesktop={isDesktop}
          editorWidth={editorWidth}
          isResizing={isResizingRef.current}
          samples={SAMPLE_OPTIONS}
          selectedSample={selectedSample}
          onCodeChange={setCode}
          onToggleOpen={setIsEditorOpen}
          onLoadSample={(key) => { setSelectedSample(key); setCode(SAMPLES[key] ?? code); }}
          onResizeStart={handleResizeStart}
        />

        <CanvasView
          canvasRef={canvasRef}
          containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
          isLoading={isLoading}
          isEditorOpen={isEditorOpen}
          transformState={transformState}
          onOpenEditor={() => setIsEditorOpen(true)}
          onMouseDown={handleMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={onMouseLeave}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={fitToScreen}
          onReset={fitToScreen}
        />
      </div>

      <MobilePillToolbar
        isEditorOpen={isEditorOpen}
        scale={transformState.scale}
        isControlBarOpen={isControlBarOpen}
        onToggleEditor={() => setIsEditorOpen(v => !v)}
        onFit={fitToScreen}
        onToggleDrawer={() => setIsControlBarOpen(v => !v)}
      />
    </div>
  );
};

export default CanvasDiagram;
