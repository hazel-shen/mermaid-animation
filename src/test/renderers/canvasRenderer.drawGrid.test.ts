import { describe, it, expect, vi } from 'vitest';
import { drawGrid } from '../../utils/canvasRenderer';

const makeCtx = () => ({
  strokeStyle: '' as string | CanvasGradient | CanvasPattern,
  lineWidth: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
}) as unknown as CanvasRenderingContext2D;

describe('drawGrid', () => {
  it('calls stroke() to render lines', () => {
    const ctx = makeCtx();
    drawGrid(ctx, 800, 600);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('sets strokeStyle to low-opacity dark color', () => {
    const ctx = makeCtx();
    drawGrid(ctx, 800, 600);
    expect(ctx.strokeStyle).toBe('rgba(0,0,0,0.05)');
  });

  it('sets lineWidth to 1', () => {
    const ctx = makeCtx();
    drawGrid(ctx, 800, 600);
    expect(ctx.lineWidth).toBe(1);
  });

  it('calls moveTo and lineTo to build line paths', () => {
    const ctx = makeCtx();
    drawGrid(ctx, 800, 600);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
  });

  it('draws more lines for a larger canvas', () => {
    const ctxSmall = makeCtx();
    const ctxLarge = makeCtx();
    drawGrid(ctxSmall, 100, 100);
    drawGrid(ctxLarge, 1000, 1000);
    const small = (ctxSmall.moveTo as ReturnType<typeof vi.fn>).mock.calls.length;
    const large = (ctxLarge.moveTo as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(large).toBeGreaterThan(small);
  });

  it('does not throw for zero-size canvas', () => {
    const ctx = makeCtx();
    expect(() => drawGrid(ctx, 0, 0)).not.toThrow();
  });
});
