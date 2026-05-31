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
