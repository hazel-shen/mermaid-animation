import { describe, it, expect, vi } from 'vitest';
import { markerSetback, drawArrowMarker } from '../../utils/arrowMarkers';

// ── markerSetback ─────────────────────────────────────────────────────────────

describe('markerSetback', () => {
  it('returns 20 for composition (filled diamond)', () => {
    expect(markerSetback('composition')).toBe(20);
  });

  it('returns 12 for extension (hollow triangle)', () => {
    expect(markerSetback('extension')).toBe(12);
  });

  it('returns 0 for dependency (open arrow — no fill gap needed)', () => {
    expect(markerSetback('dependency')).toBe(0);
  });

  it('returns 10 for default (generic filled triangle)', () => {
    expect(markerSetback('default')).toBe(10);
  });

  it('returns 10 for undefined (falls through to default)', () => {
    expect(markerSetback(undefined)).toBe(10);
  });

  it('returns 0 for erOne (tick marker — path already ends at node border)', () => {
    expect(markerSetback('erOne')).toBe(0);
  });

  it('returns 10 for circle (diameter 2R=10 — line stops at left edge of circle)', () => {
    expect(markerSetback('circle')).toBe(10);
  });
});

// ── drawArrowMarker — "none" no-op ────────────────────────────────────────────

const makeCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  setLineDash: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
}) as unknown as CanvasRenderingContext2D;

describe('drawArrowMarker', () => {
  it('does nothing for marker "none"', () => {
    const ctx = makeCtx();
    drawArrowMarker(ctx, 'none', 0, 0, 0, '#000', '#fff');
    expect((ctx.save as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});
