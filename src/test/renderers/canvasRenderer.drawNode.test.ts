import { describe, it, expect, vi } from 'vitest';
import { drawNode } from '../../utils/canvasRenderer';
import type { DiagramNode } from '../../types';

const makeCtx = () => {
  const ctx = {
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    globalAlpha: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

const baseNode = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
  id: 'n1',
  label: 'Test',
  type: 'node',
  shape: 'roundRect',
  color: '#ffffff',
  stroke: '#334155',
  x: 100,
  y: 100,
  width: 120,
  height: 60,
  ...overrides,
});

// ── shadow: hovered vs normal ─────────────────────────────────────────────────

describe('drawNode – shadow state', () => {
  it('applies particle-color shadow when node is hovered', () => {
    const ctx = makeCtx();
    let shadowDuringDraw = '';
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      shadowDuringDraw = ctx.shadowColor;
    });
    drawNode(ctx, baseNode({ id: 'n1' }), false, 'n1', '#6366f1');
    expect(shadowDuringDraw).toBe('#6366f1');
  });

  it('resets shadowBlur to 0 after drawing', () => {
    const ctx = makeCtx();
    drawNode(ctx, baseNode(), false, null, '#6366f1');
    expect(ctx.shadowBlur).toBe(0);
  });
});

// ── stroke color: hovered node ────────────────────────────────────────────────

describe('drawNode – hovered stroke', () => {
  it('uses particleColor as strokeStyle when hovered (roundRect)', () => {
    const ctx = makeCtx();
    drawNode(ctx, baseNode({ id: 'target' }), false, 'target', '#ff0000');
    expect(ctx.strokeStyle).toBe('#ff0000');
  });

  it('uses node.stroke when not hovered', () => {
    const ctx = makeCtx();
    drawNode(ctx, baseNode({ stroke: '#abc123' }), false, null, '#ff0000');
    expect(ctx.strokeStyle).toBe('#abc123');
  });
});

// ── cluster (subgraph) label rendering ───────────────────────────────────────

describe('drawNode – cluster label', () => {
  const captureFillAtFillText = (ctx: CanvasRenderingContext2D): () => string => {
    let captured = '';
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      captured = ctx.fillStyle as string;
    });
    return () => captured;
  };

  const clusterNode = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
    id: 'sg1',
    label: '應用服務',
    type: 'cluster',
    shape: 'rect',
    color: '#2a2a3e',
    stroke: '#6366f1',
    x: 200,
    y: 200,
    width: 300,
    height: 200,
    ...overrides,
  });

  it('uses labelColor when provided (dark-mode override: #e2e8f0)', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    drawNode(ctx, clusterNode({ labelColor: '#e2e8f0' }), false, null, '#6366f1');
    expect(getFill()).toBe('#e2e8f0');
  });

  it('falls back to light auto-color on dark cluster background when labelColor is absent', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    // color '#2a2a3e' has luminance < 0.35 → should pick '#f1f5f9'
    drawNode(ctx, clusterNode(), false, null, '#6366f1');
    expect(getFill()).toBe('#f1f5f9');
  });

  it('falls back to dark auto-color on light cluster background when labelColor is absent', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    drawNode(ctx, clusterNode({ color: '#ffffff' }), false, null, '#6366f1');
    expect(getFill()).toBe('#334155');
  });
});

// ── label color: labelColor field ─────────────────────────────────────────────

describe('drawNode – label color', () => {
  const captureFillAtFillText = (ctx: CanvasRenderingContext2D): () => string => {
    let captured = '';
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      captured = ctx.fillStyle as string;
    });
    return () => captured;
  };

  it('uses labelColor when provided, regardless of background luminance', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    // White background would normally produce dark (#1e293b) auto-color;
    // labelColor should override it.
    drawNode(ctx, baseNode({ color: '#ffffff', labelColor: '#185FA5' }), false, null, '#6366f1');
    expect(getFill()).toBe('#185FA5');
  });

  it('falls back to dark auto-color (#1e293b) on light background when labelColor is absent', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    drawNode(ctx, baseNode({ color: '#ffffff' }), false, null, '#6366f1');
    expect(getFill()).toBe('#1e293b');
  });

  it('falls back to light auto-color (#f1f5f9) on dark background when labelColor is absent', () => {
    const ctx = makeCtx();
    const getFill = captureFillAtFillText(ctx);
    drawNode(ctx, baseNode({ color: '#0f172a' }), false, null, '#6366f1');
    expect(getFill()).toBe('#f1f5f9');
  });
});
