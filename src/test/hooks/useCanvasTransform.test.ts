import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasTransform } from '../../hooks/useCanvasTransform';
import type { DiagramNode } from '../../types';

// 800×600 canvas, dpr=1 → logical centre (400, 300)
const makeCanvas = (w = 800, h = 600) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const makeNode = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
  id: 'n1', label: 'A', type: 'node', shape: 'roundRect',
  color: '#fff', stroke: '#333',
  x: 100, y: 100, width: 80, height: 40,
  ...overrides,
});

// ── canvasToWorld ─────────────────────────────────────────────────────────────

describe('useCanvasTransform – canvasToWorld', () => {
  it('maps canvas coords 1:1 at identity transform', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const pos = result.current.canvasToWorld(100, 200);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('applies scale and translation correctly', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.transformRef.current = { x: 50, y: 30, scale: 2 }; });
    // wx = (150 - 50) / 2 = 50, wy = (230 - 30) / 2 = 100
    const pos = result.current.canvasToWorld(150, 230);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(100);
  });

  it('applies viewBoxOffset stored on canvas element', () => {
    const canvas = makeCanvas();
    (canvas as any).viewBoxOffset = { x: -20, y: -10 };
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    // wx = (100 - 0) / 1 - (-20) = 120, wy = (200 - 0) / 1 - (-10) = 210
    const pos = result.current.canvasToWorld(100, 200);
    expect(pos.x).toBeCloseTo(120);
    expect(pos.y).toBeCloseTo(210);
  });
});

// ── zoom in / out ─────────────────────────────────────────────────────────────

describe('useCanvasTransform – handleZoomIn', () => {
  let canvas: HTMLCanvasElement;
  beforeEach(() => { canvas = makeCanvas(800, 600); });

  it('increases scale by ×1.25', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleZoomIn(); });
    expect(result.current.transformState.scale).toBeCloseTo(1.25);
  });

  it('zooms toward the canvas centre', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleZoomIn(); });
    // cx=400, cy=300; newX = 400 - 400*(1.25/1) = -100
    expect(result.current.transformState.x).toBeCloseTo(-100);
    expect(result.current.transformState.y).toBeCloseTo(-75);
  });

  it('caps scale at 8', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.transformRef.current = { x: 0, y: 0, scale: 8 }; });
    act(() => { result.current.handleZoomIn(); });
    expect(result.current.transformState.scale).toBe(8);
  });
});

describe('useCanvasTransform – handleZoomOut', () => {
  let canvas: HTMLCanvasElement;
  beforeEach(() => { canvas = makeCanvas(800, 600); });

  it('decreases scale by ×0.8', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleZoomOut(); });
    expect(result.current.transformState.scale).toBeCloseTo(0.8);
  });

  it('zooms toward the canvas centre', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleZoomOut(); });
    // cx=400, cy=300; newX = 400 - 400*(0.8/1) = 80
    expect(result.current.transformState.x).toBeCloseTo(80);
    expect(result.current.transformState.y).toBeCloseTo(60);
  });

  it('floors scale at 0.1', () => {
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.transformRef.current = { x: 0, y: 0, scale: 0.1 }; });
    act(() => { result.current.handleZoomOut(); });
    expect(result.current.transformState.scale).toBeCloseTo(0.1);
  });
});

// ── wheel zoom ────────────────────────────────────────────────────────────────

describe('useCanvasTransform – handleWheel', () => {
  it('zooms out when deltaY > 0 (scroll down)', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const e = new WheelEvent('wheel', { deltaY: 100, clientX: 100, clientY: 100, cancelable: true });
    act(() => { result.current.handleWheel(e); });
    // delta=0.9; newScale = min(max(1*0.9,0.1),8) = 0.9
    expect(result.current.transformState.scale).toBeCloseTo(0.9);
  });

  it('zooms in when deltaY < 0 (scroll up)', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const e = new WheelEvent('wheel', { deltaY: -100, clientX: 100, clientY: 100, cancelable: true });
    act(() => { result.current.handleWheel(e); });
    // delta=1.1; newScale = 1.1
    expect(result.current.transformState.scale).toBeCloseTo(1.1);
  });

  it('zooms around the mouse position', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    // mouseX=100, mouseY=100, delta=0.9, initial x=0,y=0,scale=1
    // newX = 100 - (100-0)*(0.9/1) = 10
    const e = new WheelEvent('wheel', { deltaY: 100, clientX: 100, clientY: 100, cancelable: true });
    act(() => { result.current.handleWheel(e); });
    expect(result.current.transformState.x).toBeCloseTo(10);
    expect(result.current.transformState.y).toBeCloseTo(10);
  });

  it('clamps wheel scale within [0.1, 8]', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.transformRef.current = { x: 0, y: 0, scale: 0.1 }; });
    // Scroll down = zoom out, but already at floor
    const e = new WheelEvent('wheel', { deltaY: 100, clientX: 0, clientY: 0, cancelable: true });
    act(() => { result.current.handleWheel(e); });
    expect(result.current.transformState.scale).toBeGreaterThanOrEqual(0.1);
  });
});

// ── pan ───────────────────────────────────────────────────────────────────────

describe('useCanvasTransform – pan (mouseDown / mouseMove / mouseUp)', () => {
  it('panning with mouseDown then mouseMove updates transform', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    // mouseDown at (200, 150): panStart = { x: 200-0, y: 150-0 } = { x: 200, y: 150 }
    act(() => { result.current.handleMouseDown({ button: 0, clientX: 200, clientY: 150 } as any); });
    // mouseMove to (220, 170): newX = 220-200=20, newY=170-150=20
    act(() => { result.current.handleMouseMove({ clientX: 220, clientY: 170 } as any, [], { current: null }); });
    expect(result.current.transformState.x).toBe(20);
    expect(result.current.transformState.y).toBe(20);
  });

  it('ignores right-click mouseDown (button !== 0)', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleMouseDown({ button: 2, clientX: 200, clientY: 150 } as any); });
    // Not panning → mouseMove should not update transform
    act(() => { result.current.handleMouseMove({ clientX: 300, clientY: 250 } as any, [], { current: null }); });
    expect(result.current.transformState.x).toBe(0);
    expect(result.current.transformState.y).toBe(0);
  });

  it('mouseUp stops panning', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleMouseDown({ button: 0, clientX: 200, clientY: 150 } as any); });
    act(() => { result.current.handleMouseUp(); });
    // Move after up → transform should not change
    act(() => { result.current.handleMouseMove({ clientX: 300, clientY: 250 } as any, [], { current: null }); });
    expect(result.current.transformState.x).toBe(0);
    expect(result.current.transformState.y).toBe(0);
  });
});

// ── hover detection ───────────────────────────────────────────────────────────

describe('useCanvasTransform – handleMouseMove hover detection', () => {
  // Node at (100,100), width=80, height=40 → hit x∈[60,140], y∈[80,120]
  // With identity transform and getBoundingClientRect()=all zeros: mouseWorld = clientXY

  it('sets hoveredNodeIdRef when mouse is inside a node', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const hoveredRef = { current: null as string | null };
    const node = makeNode();
    act(() => { result.current.handleMouseMove({ clientX: 100, clientY: 100 } as any, [node], hoveredRef); });
    expect(hoveredRef.current).toBe('n1');
  });

  it('clears hoveredNodeIdRef when mouse is outside all nodes', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const hoveredRef = { current: 'n1' as string | null };
    const node = makeNode();
    act(() => { result.current.handleMouseMove({ clientX: 500, clientY: 500 } as any, [node], hoveredRef); });
    expect(hoveredRef.current).toBeNull();
  });

  it('picks the first matching node', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const hoveredRef = { current: null as string | null };
    const nodeA = makeNode({ id: 'A', x: 100, y: 100 });
    const nodeB = makeNode({ id: 'B', x: 300, y: 300 });
    act(() => { result.current.handleMouseMove({ clientX: 100, clientY: 100 } as any, [nodeA, nodeB], hoveredRef); });
    expect(hoveredRef.current).toBe('A');
  });
});

// ── handleMouseLeave ──────────────────────────────────────────────────────────

describe('useCanvasTransform – handleMouseLeave', () => {
  it('clears hoveredNodeIdRef', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    const hoveredRef = { current: 'n1' as string | null };
    act(() => { result.current.handleMouseLeave(hoveredRef); });
    expect(hoveredRef.current).toBeNull();
  });

  it('stops panning', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.handleMouseDown({ button: 0, clientX: 200, clientY: 150 } as any); });
    act(() => { result.current.handleMouseLeave({ current: null }); });
    // After leave, mousemove should not update transform
    act(() => { result.current.handleMouseMove({ clientX: 300, clientY: 250 } as any, [], { current: null }); });
    expect(result.current.transformState.x).toBe(0);
  });
});

// ── fitToScreen ───────────────────────────────────────────────────────────────

describe('useCanvasTransform – fitToScreen', () => {
  it('does nothing when diagramSize is zero', () => {
    const canvas = makeCanvas();
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.fitToScreen(); });
    // diagramSizeRef is { w:0, h:0 } by default → early return, transform unchanged
    expect(result.current.transformState.scale).toBe(1);
  });

  it('computes scale to fit diagram into canvas', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.diagramSizeRef.current = { w: 400, h: 300 }; });
    act(() => { result.current.fitToScreen(); });
    // scaleX=(800-48)/400=1.88, scaleY=(600-48)/300=1.84 → fitScale=1.84
    expect(result.current.transformState.scale).toBeCloseTo(1.84, 1);
  });

  it('centres the diagram horizontally and vertically', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.diagramSizeRef.current = { w: 400, h: 300 }; });
    act(() => { result.current.fitToScreen(); });
    // fitX=(800-400*1.84)/2=32, fitY=(600-300*1.84)/2=24
    expect(result.current.transformState.x).toBeCloseTo(32, 0);
    expect(result.current.transformState.y).toBeCloseTo(24, 0);
  });

  it('caps scale at 2 even when diagram is tiny', () => {
    const canvas = makeCanvas(800, 600);
    const { result } = renderHook(() => useCanvasTransform({ current: canvas }));
    act(() => { result.current.diagramSizeRef.current = { w: 50, h: 50 }; });
    act(() => { result.current.fitToScreen(); });
    expect(result.current.transformState.scale).toBeLessThanOrEqual(2);
  });
});
