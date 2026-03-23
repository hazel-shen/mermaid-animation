import { describe, it, expect, vi } from 'vitest';
import { markerSetback, drawArrowMarker } from '../../utils/arrowMarkers';
import type { ArrowMarker } from '../../types';

// ── markerSetback ─────────────────────────────────────────────────────────────

describe('markerSetback', () => {
  it('returns 20 for composition (filled diamond)', () => {
    expect(markerSetback('composition')).toBe(20);
  });

  it('returns 20 for aggregation (hollow diamond)', () => {
    expect(markerSetback('aggregation')).toBe(20);
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
});

// ── drawArrowMarker — smoke tests ─────────────────────────────────────────────

const makeCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  setLineDash: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
}) as unknown as CanvasRenderingContext2D;

const MARKERS: ArrowMarker[] = ['extension', 'composition', 'aggregation', 'dependency', 'default'];

describe('drawArrowMarker', () => {
  it('does nothing for marker "none"', () => {
    const ctx = makeCtx();
    drawArrowMarker(ctx, 'none', 0, 0, 0, '#000', '#fff');
    expect((ctx.save as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  MARKERS.forEach(marker => {
    it(`draws "${marker}" without throwing`, () => {
      const ctx = makeCtx();
      expect(() => drawArrowMarker(ctx, marker, 100, 100, 0, '#64748b', '#fff')).not.toThrow();
    });

    it(`"${marker}" calls ctx.save and ctx.restore`, () => {
      const ctx = makeCtx();
      drawArrowMarker(ctx, marker, 0, 0, 0, '#000', '#fff');
      expect((ctx.save as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
      expect((ctx.restore as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });
  });
});
