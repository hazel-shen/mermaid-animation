import { describe, it, expect, vi } from 'vitest';
import { truncateText, drawClassNode } from '../utils/drawClassNode';
import type { DiagramNode } from '../types';

// Canvas mock — measureText returns 8px per character
const makeCtx = (charWidth = 8) => {
  const ctx = {
    measureText: vi.fn((text: string) => ({ width: text.length * charWidth })),
    fillText: vi.fn(),
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

  it('handles empty string without throwing', () => {
    const ctx = makeCtx();
    expect(() => truncateText(ctx, '', 100)).not.toThrow();
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
  it('renders without throwing for a typical class node', () => {
    const ctx = makeCtx();
    const node = makeNode();
    expect(() => drawClassNode(ctx, node, node.color, node.stroke)).not.toThrow();
  });

  it('renders without throwing when classLines is empty', () => {
    const ctx = makeCtx();
    const node = makeNode({ classLines: [] });
    expect(() => drawClassNode(ctx, node, node.color, node.stroke)).not.toThrow();
  });

  it('renders without throwing for a dark background', () => {
    const ctx = makeCtx();
    const node = makeNode({ color: '#1e293b' });
    expect(() => drawClassNode(ctx, node, node.color, node.stroke)).not.toThrow();
  });

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
