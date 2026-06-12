import { useRef, useState, useCallback, useEffect } from 'react';
import type { DiagramNode, Transform } from '../types';
import { hitTestNode } from '../utils/canvasRenderer';

interface UseCanvasTransformReturn {
  transformRef: React.MutableRefObject<Transform>;
  transformState: Transform;
  diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  canvasToWorld: (cx: number, cy: number) => { x: number; y: number };
  fitToScreen: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>, nodes: DiagramNode[], hoveredNodeIdRef: React.MutableRefObject<string | null>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: (hoveredNodeIdRef: React.MutableRefObject<string | null>) => void;
  handleWheel: (e: WheelEvent) => void;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
  applyViewBox: (
    viewBox: { x: number; y: number; width: number; height: number },
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    canvasContainerRef: React.RefObject<HTMLDivElement>
  ) => void;
}

export const useCanvasTransform = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): UseCanvasTransformReturn => {
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const [transformState, setTransformState] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const diagramSizeRef = useRef({ w: 0, h: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const canvasToWorld = useCallback((cx: number, cy: number) => {
    const tr = transformRef.current;
    const offset = (canvasRef.current as any)?.viewBoxOffset || { x: 0, y: 0 };
    const wx = (cx - tr.x) / tr.scale - offset.x;
    const wy = (cy - tr.y) / tr.scale - offset.y;
    return { x: wx, y: wy };
  }, [canvasRef]);

  const applyViewBox = useCallback((
    viewBox: { x: number; y: number; width: number; height: number },
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    canvasContainerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!canvasRef.current || !canvasContainerRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const containerW = canvasContainerRef.current.clientWidth;
    const containerH = canvasContainerRef.current.clientHeight;
    canvasRef.current.width  = Math.round(containerW * dpr);
    canvasRef.current.height = Math.round(containerH * dpr);
    canvasRef.current.style.width  = `${containerW}px`;
    canvasRef.current.style.height = `${containerH}px`;
    (canvasRef.current as any).viewBoxOffset = { x: -viewBox.x, y: -viewBox.y };

    const dw = viewBox.width;
    const dh = viewBox.height;
    diagramSizeRef.current = { w: dw, h: dh };

    const padding = 32;
    const scaleX = (containerW - padding) / dw;
    const scaleY = (containerH - padding) / dh;
    const fitScale = Math.min(scaleX, scaleY, 2);
    const fitX = (containerW - dw * fitScale) / 2;
    const fitY = (containerH - dh * fitScale) / 2;
    transformRef.current = { x: fitX, y: fitY, scale: fitScale };
    setTransformState({ x: fitX, y: fitY, scale: fitScale });
  }, []);

  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: dw, h: dh } = diagramSizeRef.current;
    if (!dw || !dh) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    const padding = 48;
    const scaleX = (cw - padding) / dw;
    const scaleY = (ch - padding) / dh;
    const fitScale = Math.min(scaleX, scaleY, 2);
    const fitX = (cw - dw * fitScale) / 2;
    const fitY = (ch - dh * fitScale) / 2;
    transformRef.current = { x: fitX, y: fitY, scale: fitScale };
    setTransformState({ x: fitX, y: fitY, scale: fitScale });
  }, [canvasRef]);

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const tr = transformRef.current;
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    const newScale = Math.min(tr.scale * 1.25, 8);
    const newX = cx - (cx - tr.x) * (newScale / tr.scale);
    const newY = cy - (cy - tr.y) * (newScale / tr.scale);
    transformRef.current = { x: newX, y: newY, scale: newScale };
    setTransformState({ x: newX, y: newY, scale: newScale });
  }, [canvasRef]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const tr = transformRef.current;
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    const newScale = Math.max(tr.scale * 0.8, 0.1);
    const newX = cx - (cx - tr.x) * (newScale / tr.scale);
    const newY = cy - (cy - tr.y) * (newScale / tr.scale);
    transformRef.current = { x: newX, y: newY, scale: newScale };
    setTransformState({ x: newX, y: newY, scale: newScale });
  }, [canvasRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    canvasRef.current!.style.cursor = 'grabbing';
  }, [canvasRef]);

  const handleMouseMove = useCallback((
    e: React.MouseEvent<HTMLCanvasElement>,
    nodes: DiagramNode[],
    hoveredNodeIdRef: React.MutableRefObject<string | null>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanningRef.current) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      transformRef.current = { ...transformRef.current, x: newX, y: newY };
      setTransformState(t => ({ ...t, x: newX, y: newY }));
      canvas.style.cursor = 'grabbing';
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const { x: mouseX, y: mouseY } = canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);

    let foundId: string | null = null;
    for (const node of nodes) {
      // Shape-aware exact test (pie wedge sweep, diamond, hexagon, …) so the
      // empty corners of non-rectangular shapes don't register as hover hits.
      if (hitTestNode(node, mouseX, mouseY)) {
        foundId = node.id;
        break;
      }
    }

    hoveredNodeIdRef.current = foundId;
    canvas.style.cursor = foundId ? 'pointer' : 'grab';
  }, [canvasRef, canvasToWorld]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, [canvasRef]);

  const handleMouseLeave = useCallback((hoveredNodeIdRef: React.MutableRefObject<string | null>) => {
    isPanningRef.current = false;
    hoveredNodeIdRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, [canvasRef]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const tr = transformRef.current;
    const newScale = Math.min(Math.max(tr.scale * delta, 0.1), 8);
    const newX = mouseX - (mouseX - tr.x) * (newScale / tr.scale);
    const newY = mouseY - (mouseY - tr.y) * (newScale / tr.scale);

    transformRef.current = { x: newX, y: newY, scale: newScale };
    setTransformState({ x: newX, y: newY, scale: newScale });
  }, [canvasRef]);

  // Touch state refs — kept outside useCallback to share between handlers
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartTransformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const pinchMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX - transformRef.current.x, y: t.clientY - transformRef.current.y };
      pinchStartDistRef.current = null;
    } else if (e.touches.length === 2) {
      touchStartRef.current = null;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = transformRef.current.scale;
      pinchStartTransformRef.current = { ...transformRef.current };
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        pinchMidpointRef.current = {
          x: (t0.clientX + t1.clientX) / 2 - rect.left,
          y: (t0.clientY + t1.clientY) / 2 - rect.top,
        };
      }
    }
  }, [canvasRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && touchStartRef.current) {
      const t = e.touches[0];
      const newX = t.clientX - touchStartRef.current.x;
      const newY = t.clientY - touchStartRef.current.y;
      transformRef.current = { ...transformRef.current, x: newX, y: newY };
      setTransformState(s => ({ ...s, x: newX, y: newY }));
    } else if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 0.1), 8);
      const { x: mx, y: my } = pinchMidpointRef.current;
      const startTr = pinchStartTransformRef.current;
      const scaleRatio = newScale / startTr.scale;
      const newX = mx - (mx - startTr.x) * scaleRatio;
      const newY = my - (my - startTr.y) * scaleRatio;
      transformRef.current = { x: newX, y: newY, scale: newScale };
      setTransformState({ x: newX, y: newY, scale: newScale });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    pinchStartDistRef.current = null;
  }, []);

  return {
    transformRef,
    transformState,
    diagramSizeRef,
    canvasToWorld,
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
  };
};

// Hook to sync canvas buffer size to container
export const useCanvasResize = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement>
) => {
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width  = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasRef, containerRef]);
};
