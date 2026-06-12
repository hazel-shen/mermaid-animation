import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFrame } from '../../utils/canvasRenderer';
import type { RenderFrameOptions } from '../../utils/canvasRenderer';

vi.mock('../../utils/drawParticles', () => ({
  drawParticles: vi.fn(),
}));

import { drawParticles } from '../../utils/drawParticles';

const makeCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  ellipse: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  setLineDash: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'center' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextBaseline,
  shadowBlur: 0,
  shadowColor: '',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
}) as unknown as CanvasRenderingContext2D;

const baseOpts = (): RenderFrameOptions => ({
  nodes: [],
  edges: [],
  particles: [],
  seqLabels: [],
  isPremium: true,
  particleColor: '#ff0000',
  particleSpeed: 1,
  particleSize: 5,
  particleShape: 'circle',
  isRecording: false,
  hoveredNodeId: null,
  exportBg: 'solid',
});

const tr = { x: 0, y: 0, scale: 1 };
const offset = { x: 0, y: 0 };

beforeEach(() => {
  vi.mocked(drawParticles).mockClear();
});

// ── showParticles: false (static export) ─────────────────────────────

describe('renderFrame – showParticles: false (static export)', () => {
  it('does not call drawParticles when showParticles is false', () => {
    const ctx = makeCtx();
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...baseOpts(),
      showParticles: false,
    });
    expect(drawParticles).not.toHaveBeenCalled();
  });
});

// ── canvasBgMode (live canvas background) ────────────────────────────

describe('renderFrame – canvasBgMode', () => {
  const liveOpts = (): RenderFrameOptions => ({ ...baseOpts(), exportBg: undefined });

  it('fills #ffffff when canvasBgMode is "white"', () => {
    const ctx = makeCtx();
    let capturedFill = '';
    (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      capturedFill = ctx.fillStyle as string;
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...liveOpts(),
      canvasBgMode: 'white',
    });
    expect(capturedFill).toBe('#ffffff');
  });

  it('does not draw grid when canvasBgMode is "white"', () => {
    const ctx = makeCtx();
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...liveOpts(),
      isPremium: true,
      canvasBgMode: 'white',
    });
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('fills #f8fafc when canvasBgMode is "grid" (default)', () => {
    const ctx = makeCtx();
    let capturedFill = '';
    (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      capturedFill = ctx.fillStyle as string;
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...liveOpts(),
      isPremium: true,
      canvasBgMode: 'grid',
    });
    expect(capturedFill).toBe('#f8fafc');
  });

  it('fills #1e1e2e when canvasBgMode is "dark"', () => {
    const ctx = makeCtx();
    let capturedFill = '';
    (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      capturedFill = ctx.fillStyle as string;
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...liveOpts(),
      canvasBgMode: 'dark',
    });
    expect(capturedFill).toBe('#1e1e2e');
  });

  it('draws grid with light color when canvasBgMode is "dark"', () => {
    const ctx = makeCtx();
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...liveOpts(),
      isPremium: true,
      canvasBgMode: 'dark',
    });
    expect(ctx.strokeStyle).toBe('rgba(255,255,255,0.06)');
    expect(ctx.moveTo).toHaveBeenCalled();
  });
});

// ── dark mode: node color overrides ──────────────────────────────────

describe('renderFrame – dark mode node color overrides', () => {
  const darkOpts = (): RenderFrameOptions => ({
    ...baseOpts(),
    exportBg: undefined,
    canvasBgMode: 'dark',
  });

  const makeNode = (overrides = {}) => ({
    id: 'n1',
    label: 'Test',
    type: 'node' as const,
    shape: 'roundRect' as const,
    color: '#fde8c8',
    stroke: '#b08020',
    x: 100, y: 100, width: 120, height: 60,
    ...overrides,
  });

  it('overrides light node fill to #2a2a3e in dark mode', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode()],
    });
    expect(fillHistory).toContain('#2a2a3e');
  });

  it('does not override node fill in light (grid) mode', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...baseOpts(),
      exportBg: undefined,
      canvasBgMode: 'grid',
      nodes: [makeNode()],
    });
    expect(fillHistory).toContain('#fde8c8');
    expect(fillHistory).not.toContain('#2a2a3e');
  });

  it('does not override already-dark node fill in dark mode', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode({ color: '#0f172a' })],
    });
    expect(fillHistory).not.toContain('#2a2a3e');
  });

  it('does not override pie wedge colors in dark mode (data colors must be preserved)', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode({ shape: 'pie', color: '#a78bfa', pieWedge: { cx: 100, cy: 100, radius: 80, startAngle: 0, endAngle: Math.PI } })],
    });
    expect(fillHistory).toContain('#a78bfa');
    expect(fillHistory).not.toContain('#2a2a3e');
  });

  it('forces labelColor to #faf9e6 so text stays visible on dark node fill', () => {
    const ctx = makeCtx();
    const fillTextColors: string[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillTextColors.push(ctx.fillStyle as string);
    });
    // Node has a deep-dark labelColor that would be invisible on #2a2a3e bg
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode({ labelColor: '#1e293b' })],
    });
    expect(fillTextColors).toContain('#faf9e6');
    expect(fillTextColors).not.toContain('#1e293b');
  });

  // ── preserveColor: section-palette nodes bypass dark-mode override ────────

  it('does NOT override node fill when preserveColor=true (mindmap/gantt palette)', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode({ color: '#bbf7d0', stroke: '#16a34a', preserveColor: true })],
    });
    expect(fillHistory).toContain('#bbf7d0');
    expect(fillHistory).not.toContain('#2a2a3e');
  });

  it('still overrides light node fill when preserveColor is absent', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeNode({ color: '#bbf7d0', stroke: '#16a34a' })],
    });
    expect(fillHistory).toContain('#2a2a3e');
    expect(fillHistory).not.toContain('#bbf7d0');
  });
});

// ── dark mode: cluster color overrides ───────────────────────────────

describe('renderFrame – dark mode cluster color overrides', () => {
  const darkOpts = (): RenderFrameOptions => ({
    ...baseOpts(),
    exportBg: undefined,
    canvasBgMode: 'dark',
  });

  const makeCluster = (overrides = {}) => ({
    id: 'sg1',
    label: '應用服務',
    type: 'cluster' as const,
    shape: 'rect' as const,
    color: '#ffffff',
    stroke: '#94a3b8',
    x: 300, y: 300, width: 400, height: 200,
    ...overrides,
  });

  it('overrides cluster fill to #2a2a3e in dark mode (flowchart subgraph)', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeCluster()],
    });
    expect(fillHistory).toContain('#2a2a3e');
  });

  it('does NOT override cluster fill when preserveColor=true (gantt section band)', () => {
    const ctx = makeCtx();
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      nodes: [makeCluster({ color: 'rgba(191,219,254,0.25)', preserveColor: true })],
    });
    expect(fillHistory).toContain('rgba(191,219,254,0.25)');
    expect(fillHistory).not.toContain('#2a2a3e');
  });
});

// ── dark mode: label background translucency ─────────────────────────

describe('renderFrame – dark mode label backgrounds', () => {
  const darkOpts = (): RenderFrameOptions => ({
    ...baseOpts(),
    exportBg: undefined,
    canvasBgMode: 'dark',
  });

  const makeLabel = (bgColor: string) => ({
    x: 100, y: 100, text: '呼叫', fontSize: 12, bold: false,
    color: '#333333', align: 'center' as const, bgColor,
  });

  const fillsOf = (ctx: CanvasRenderingContext2D) => {
    const fillHistory: string[] = [];
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillHistory.push(ctx.fillStyle as string);
    });
    return fillHistory;
  };

  it('keeps the label translucency when swapping light bg to dark (C4 halo)', () => {
    const ctx = makeCtx();
    const fillHistory = fillsOf(ctx);
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      seqLabels: [makeLabel('rgba(255,255,255,0.5)')],
    });
    expect(fillHistory).toContain('rgba(42,42,62,0.5)');
  });

  it('swaps opaque light bg to opaque dark (flowchart edge labels)', () => {
    const ctx = makeCtx();
    const fillHistory = fillsOf(ctx);
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...darkOpts(),
      seqLabels: [makeLabel('#ffffff')],
    });
    expect(fillHistory).toContain('rgba(42,42,62,1)');
  });

  it('leaves label bg untouched in light mode', () => {
    const ctx = makeCtx();
    const fillHistory = fillsOf(ctx);
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...baseOpts(),
      exportBg: undefined,
      canvasBgMode: 'grid',
      seqLabels: [makeLabel('rgba(255,255,255,0.5)')],
    });
    expect(fillHistory).toContain('rgba(255,255,255,0.5)');
  });
});
