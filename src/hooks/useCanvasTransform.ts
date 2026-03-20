import { useRef, useState, useCallback, useEffect } from 'react';
import type { DiagramNode, Transform } from '../types';

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
  applyViewBox: (
    viewBox: { x: number; y: number; width: number; height: number },
    canvasRef: React.RefObject<HTMLCanvasElement>,
    canvasContainerRef: React.RefObject<HTMLDivElement>
  ) => void;
}

export const useCanvasTransform = (
  canvasRef: React.RefObject<HTMLCanvasElement>
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
    canvasRef: React.RefObject<HTMLCanvasElement>,
    canvasContainerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!canvasRef.current || !canvasContainerRef.current) return;
    const containerW = canvasContainerRef.current.clientWidth;
    const containerH = canvasContainerRef.current.clientHeight;
    canvasRef.current.width = containerW;
    canvasRef.current.height = containerH;
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
    const padding = 48;
    const scaleX = (canvas.width - padding) / dw;
    const scaleY = (canvas.height - padding) / dh;
    const fitScale = Math.min(scaleX, scaleY, 2);
    const fitX = (canvas.width - dw * fitScale) / 2;
    const fitY = (canvas.height - dh * fitScale) / 2;
    transformRef.current = { x: fitX, y: fitY, scale: fitScale };
    setTransformState({ x: fitX, y: fitY, scale: fitScale });
  }, [canvasRef]);

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tr = transformRef.current;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const newScale = Math.min(tr.scale * 1.25, 8);
    const newX = cx - (cx - tr.x) * (newScale / tr.scale);
    const newY = cy - (cy - tr.y) * (newScale / tr.scale);
    transformRef.current = { x: newX, y: newY, scale: newScale };
    setTransformState({ x: newX, y: newY, scale: newScale });
  }, [canvasRef]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tr = transformRef.current;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
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
      if (
        mouseX >= node.x - node.width / 2 &&
        mouseX <= node.x + node.width / 2 &&
        mouseY >= node.y - node.height / 2 &&
        mouseY <= node.y + node.height / 2
      ) {
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
    applyViewBox,
  };
};

// Hook to sync canvas buffer size to container
export const useCanvasResize = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  containerRef: React.RefObject<HTMLDivElement>
) => {
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasRef, containerRef]);
};
