import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { AppHeader } from './components/AppHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasView } from './components/CanvasView';
import { MobileDrawer } from './components/MobileDrawer';
import { MobilePillToolbar } from './components/MobilePillToolbar';
import { ExportModal } from './components/ExportModal';

import { useMermaidParser } from './hooks/useMermaidParser';
import { useCanvasTransform, useCanvasResize } from './hooks/useCanvasTransform';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useEditorResize } from './hooks/useEditorResize';
import { useExportPipeline } from './hooks/useExportPipeline';

import { renderFrame } from './utils/canvasRenderer';
import { applyParticleSettingsPatch, DEFAULT_PARTICLE_SETTINGS } from './utils/particleSettings';
import type { ParticleSettings } from './types';

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
  const [particleSettings, setParticleSettings] = useState<ParticleSettings>(DEFAULT_PARTICLE_SETTINGS);
  const updateParticleSettings = useCallback((patch: Partial<ParticleSettings>) => {
    setParticleSettings(prev => applyParticleSettingsPatch(prev, patch));
  }, []);
  const { speed: particleSpeed, color: particleColor, size: particleSize, shape: particleShape, bgMode: canvasBgMode } = particleSettings;
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

  // --- Export pipeline (PNG / SVG / MMD / MP4 / GIF + modal preview) ---
  const closeExportModal = useCallback(() => setExportModalOpen(false), []);
  const { handleDownload, handlePreviewRender, handleExport } = useExportPipeline({
    canvasRef,
    hiddenContainerRef: hiddenContainerRef as React.RefObject<HTMLDivElement>,
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
    onExported: closeExportModal,
  });

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
        settings={particleSettings}
        onSettingsChange={updateParticleSettings}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
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
        settings={particleSettings}
        onSettingsChange={updateParticleSettings}
        onClose={() => setIsControlBarOpen(false)}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
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
