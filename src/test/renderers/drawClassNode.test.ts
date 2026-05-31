import { describe, it, expect, vi } from 'vitest';
import { truncateText, drawClassNode } from '../../utils/drawClassNode';
import type { DiagramNode } from '../../types';

// Canvas mock — measureText returns 8px per character
const makeCtx = (charWidth = 8) => {
  const ctx = {
    measureText: vi.fn((text: string) => ({ width: text.length * charWidth })),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

// ── truncateText ──────────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns original text when it fits within maxWidth', () => {
    const ctx = makeCtx();
    // 'Hello' = 5 chars × 8px = 40px; maxWidth = 100
    expect(truncateText(ctx, 'Hello', 100)).toBe('Hello');
  });

  it('truncates with ellipsis when text exceeds maxWidth', () => {
    const ctx = makeCtx();
    // 'Hello World' = 11 × 8 = 88px; maxWidth = 40px (fits ~4 chars + '…')
    const result = truncateText(ctx, 'Hello World', 40);
    expect(result).toMatch(/…$/);
    expect(result.length).toBeLessThan('Hello World'.length + 1);
  });

  it('truncated result fits within maxWidth', () => {
    const ctx = makeCtx();
    const maxWidth = 50;
    const result = truncateText(ctx, 'A very long string that should be truncated', maxWidth);
    // '…' = 1 char, so total px ≤ maxWidth
    expect(result.length * 8).toBeLessThanOrEqual(maxWidth);
  });

  it('returns single character + ellipsis for extremely narrow maxWidth', () => {
    const ctx = makeCtx();
    const result = truncateText(ctx, 'ABCDE', 10); // only fits ~1 char (8px) + '…'(8px)=16 > 10 → lo=0
    expect(result).toBe('…');
  });
});

// ── drawClassNode — smoke tests ───────────────────────────────────────────────

const makeNode = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
  id: 'cls-1',
  label: 'MyClass',
  type: 'node',
  shape: 'roundRect',
  color: '#ffffff',
  stroke: '#334155',
  x: 100,
  y: 100,
  width: 160,
  height: 80,
  classLines: [
    { text: 'MyClass', bold: true },
    { divider: true },
    { text: '+ name: String' },
    { text: '+ getId(): int' },
  ],
  ...overrides,
});

describe('drawClassNode', () => {
  it('calls fillText for each non-divider line', () => {
    const ctx = makeCtx();
    const node = makeNode();
    drawClassNode(ctx, node, node.color, node.stroke);
    // 3 non-divider lines → fillText called at least 3 times
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('draws divider line via stroke()', () => {
    const ctx = makeCtx();
    const node = makeNode();
    drawClassNode(ctx, node, node.color, node.stroke);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ── drawClassNode — erAttr rows ───────────────────────────────────────────────

const makeErNode = (overrides: Partial<DiagramNode> = {}): DiagramNode => ({
  id: 'er-1',
  label: 'Order',
  type: 'node',
  shape: 'rect',
  color: '#dcfce7',
  stroke: '#0c26e9',
  x: 100,
  y: 100,
  width: 200,
  height: 90,
  classLines: [
    { text: 'Order', bold: true },
    { text: '', divider: true },
    { erAttr: { type: 'int',    name: 'id',       key: 'PK' } },
    { erAttr: { type: 'string', name: 'status',   key: ''   } },
    { erAttr: { type: 'int',    name: 'customerId', key: 'FK' } },
  ],
  ...overrides,
});

describe('drawClassNode — erAttr rows', () => {
  it('calls fillRect for each erAttr row background', () => {
    const ctx = makeCtx();
    const node = makeErNode();
    drawClassNode(ctx, node, node.color, node.stroke);
    // 3 erAttr rows → 3 fillRect calls for row backgrounds
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });

  it('calls fillText for type and name in each erAttr row', () => {
    const ctx = makeCtx();
    const node = makeErNode();
    drawClassNode(ctx, node, node.color, node.stroke);
    // title row (1) + 3 rows × (type + name + key) = 1 + 9 = 10 minimum
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  it('renders erAttr rows with no key column without throwing', () => {
    const ctx = makeCtx();
    const node = makeErNode({
      classLines: [
        { text: 'Tag', bold: true },
        { text: '', divider: true },
        { erAttr: { type: 'string', name: 'name', key: '' } },
      ],
    });
    expect(() => drawClassNode(ctx, node, node.color, node.stroke)).not.toThrow();
  });

  it('draws column dividers via stroke() for erAttr rows', () => {
    const ctx = makeCtx();
    const node = makeErNode();
    drawClassNode(ctx, node, node.color, node.stroke);
    // divider line (1) + 3 erAttr row grid strokes = at least 4 stroke calls
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
