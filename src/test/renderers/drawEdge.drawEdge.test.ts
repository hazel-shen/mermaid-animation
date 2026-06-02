import { describe, it, expect, vi, beforeAll } from 'vitest';
import { drawEdge } from '../../utils/drawEdge';
import type { DiagramEdge, DiagramNode } from '../../types';

// Path2D is not implemented in jsdom; stub it so new Path2D(d) succeeds.
beforeAll(() => {
  if (typeof Path2D === 'undefined') {
    vi.stubGlobal('Path2D', class { constructor(_d: string) {} });
  }
});

const makeCtx = () => {
  const fakeGrad = { addColorStop: vi.fn() };
  const ctx = {
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    globalAlpha: 1,
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => fakeGrad),
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

const baseEdge = (overrides: Partial<DiagramEdge> = {}): DiagramEdge => ({
  id: `e-${Math.random()}`,
  pathD: 'M 10 20 L 90 80',
  stroke: '#6366f1',
  type: 'link',
  ...overrides,
});

const node = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
  id: 'n1', label: 'A', type: 'node', shape: 'roundRect',
  color: '#fff', stroke: '#333', x: 100, y: 80, width: 120, height: 60,
  ...overrides,
});

// ── stroke is called ─────────────────────────────────────────────────────────

describe('drawEdge – renders path', () => {
  it('calls ctx.stroke() to render the path', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge(), false);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ── edge color resolution ─────────────────────────────────────────────────────

describe('drawEdge – edge color', () => {
  it('uses explicit stroke when luminance > 0.1 (bright color)', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: '#6366f1' }), false);
    expect(ctx.strokeStyle).toBe('#6366f1');
  });

  it('does NOT use stroke when luminance < 0.1 (near-black default)', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: '#333333' }), false);
    expect(ctx.strokeStyle).not.toBe('#333333');
  });

  it('non-premium structural edge → gray fallback #9ca3af', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: '#333333', type: 'structural' }), false);
    expect(ctx.strokeStyle).toBe('#9ca3af');
  });

  it('premium structural edge → lighter gray #cbd5e1', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: '#333333', type: 'structural' }), true);
    expect(ctx.strokeStyle).toBe('#cbd5e1');
  });

  it('link edge with no meaningful stroke → #64748b', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: 'none', type: 'link' }), false);
    expect(ctx.strokeStyle).toBe('#64748b');
  });

  it('dark mode structural edge → #94a3b8', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: '#333333', type: 'structural' }), true, [], 'dark');
    expect(ctx.strokeStyle).toBe('#94a3b8');
  });

  it('dark mode link edge → #a5b4fc', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ stroke: 'none', type: 'link' }), false, [], 'dark');
    expect(ctx.strokeStyle).toBe('#a5b4fc');
  });
});

// ── dash style ────────────────────────────────────────────────────────────────

describe('drawEdge – line dash', () => {
  it('applies edge.dash when set', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ dash: [4, 4] }), false);
    const calls = (ctx.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([arg]) => JSON.stringify(arg) === JSON.stringify([4, 4]))).toBe(true);
  });

  it('uses [5,5] for structural edges', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ type: 'structural' }), false);
    const calls = (ctx.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([arg]) => JSON.stringify(arg) === JSON.stringify([5, 5]))).toBe(true);
  });

  it('uses [] for plain link edges', () => {
    const ctx = makeCtx();
    drawEdge(ctx, baseEdge({ type: 'link' }), false);
    const calls = (ctx.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
    // First relevant call (before stroke) should be []
    expect(calls.some(([arg]) => JSON.stringify(arg) === JSON.stringify([]))).toBe(true);
  });
});

// ── Sankey edges ──────────────────────────────────────────────────────────────

describe('drawEdge – Sankey', () => {
  it('sets globalAlpha to 0.5 during Sankey draw', () => {
    const ctx = makeCtx();
    let alphaDuringDraw = 1;
    (ctx.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      alphaDuringDraw = ctx.globalAlpha;
    });
    const edge = baseEdge({ sankeyFillPath: 'M 0 0 L 100 0' });
    drawEdge(ctx, edge, false);
    expect(alphaDuringDraw).toBe(0.5);
  });

  it('resets globalAlpha to 1 after Sankey draw', () => {
    const ctx = makeCtx();
    const edge = baseEdge({ sankeyFillPath: 'M 0 0 L 100 0' });
    drawEdge(ctx, edge, false);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('uses edge.lineWidth when set on Sankey edge', () => {
    const ctx = makeCtx();
    const edge = baseEdge({ sankeyFillPath: 'M 0 0 L 100 0', lineWidth: 20 });
    drawEdge(ctx, edge, false);
    expect(ctx.lineWidth).toBe(20);
  });

  it('defaults lineWidth to 4 when not set on Sankey edge', () => {
    const ctx = makeCtx();
    const edge = baseEdge({ sankeyFillPath: 'M 0 0 L 100 0' });
    drawEdge(ctx, edge, false);
    expect(ctx.lineWidth).toBe(4);
  });

  it('creates gradient when sankeyGradient is set', () => {
    const ctx = makeCtx();
    const edge = baseEdge({
      sankeyFillPath: 'M 10 20 L 90 80',
      sankeyGradient: ['#ff0000', '#0000ff'],
    });
    drawEdge(ctx, edge, false);
    expect(ctx.createLinearGradient).toHaveBeenCalled();
  });

  it('calls save() and restore() for Sankey edge', () => {
    const ctx = makeCtx();
    const edge = baseEdge({ sankeyFillPath: 'M 0 0 L 100 0' });
    drawEdge(ctx, edge, false);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

// ── cluster clip ──────────────────────────────────────────────────────────────

describe('drawEdge – cluster clip', () => {
  it('uses save/clip/restore when toNode is a cluster', () => {
    const ctx = makeCtx();
    const cluster = node({ id: 'c1', type: 'cluster' });
    const edge = baseEdge({ toNodeId: 'c1' });
    drawEdge(ctx, edge, false, [cluster]);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('uses save/clip/restore when fromNode is a cluster', () => {
    const ctx = makeCtx();
    const cluster = node({ id: 'c2', type: 'cluster' });
    const edge = baseEdge({ fromNodeId: 'c2' });
    drawEdge(ctx, edge, false, [cluster]);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it('does NOT clip when neither end is a cluster', () => {
    const ctx = makeCtx();
    const n = node({ id: 'n1', type: 'node' });
    const edge = baseEdge({ toNodeId: 'n1' });
    drawEdge(ctx, edge, false, [n]);
    expect(ctx.clip).not.toHaveBeenCalled();
  });
});
