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

// ── smoke tests: every shape renders without throwing ─────────────────────────

describe('drawNode – shape smoke tests', () => {
  const shapes: DiagramNode['shape'][] = [
    'roundRect', 'rect', 'circle', 'stadium', 'subroutine',
    'diamond', 'hexagon', 'note', 'forkJoin',
    'parallelogram', 'parallelogramAlt', 'trapezoid', 'trapezoidAlt', 'asymmetric',
    'endCircle', 'mergeCircle', 'reverseCircle', 'highlightRect',
    'cylinder', 'cloud', 'bang', 'actorMan', 'c4Person',
  ];

  for (const shape of shapes) {
    it(`does not throw for shape "${shape}"`, () => {
      const ctx = makeCtx();
      expect(() => drawNode(ctx, baseNode({ shape }), false, null, '#6366f1')).not.toThrow();
    });
  }

  it('does not throw for shape "pie" with pieWedge', () => {
    const ctx = makeCtx();
    const node = baseNode({
      shape: 'pie',
      pieWedge: { cx: 100, cy: 100, radius: 50, startAngle: 0, endAngle: Math.PI },
    });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });

  it('does not throw for shape "pie" without pieWedge (no-op)', () => {
    const ctx = makeCtx();
    expect(() => drawNode(ctx, baseNode({ shape: 'pie' }), false, null, '#6366f1')).not.toThrow();
  });
});

// ── shadow: hovered vs premium vs normal ─────────────────────────────────────

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

// ── cluster nodes ─────────────────────────────────────────────────────────────

describe('drawNode – cluster nodes', () => {
  it('renders dashed cluster (flowchart subgraph) without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ type: 'cluster', shape: 'rect', label: 'Group' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });

  it('renders roundRect cluster with label without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ type: 'cluster', shape: 'roundRect', label: 'State' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });

  it('renders roundRect cluster with empty label (concurrent region) without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ type: 'cluster', shape: 'roundRect', label: '' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });
});

// ── special nodeKind ──────────────────────────────────────────────────────────

describe('drawNode – nodeKind', () => {
  it('renders stepNum node without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ nodeKind: 'stepNum', label: '1', shape: 'circle', width: 24, height: 24 });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });

  it('renders activation node without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ nodeKind: 'activation', shape: 'rect' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });
});

// ── classLines nodes ──────────────────────────────────────────────────────────

describe('drawNode – classLines', () => {
  it('renders a node with classLines without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({
      classLines: [
        { text: 'MyClass', bold: true },
        { divider: true },
        { text: '+ name: String' },
      ],
    });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });
});

// ── multi-line labels ─────────────────────────────────────────────────────────

describe('drawNode – multi-line labels', () => {
  it('renders multi-line label without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ label: 'Line one\nLine two\nLine three' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });

  it('renders bold-marked label (**text**) without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ label: '**Important**' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });
});

// ── dark background ───────────────────────────────────────────────────────────

describe('drawNode – dark background', () => {
  it('renders dark-bg node without throwing', () => {
    const ctx = makeCtx();
    const node = baseNode({ color: '#0f172a' });
    expect(() => drawNode(ctx, node, false, null, '#6366f1')).not.toThrow();
  });
});
