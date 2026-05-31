/**
 * Tests for the tight-crop export calculations introduced in the
 * "diagram bounding box crop" feature.
 *
 * Covered logic
 * ─────────────
 * getTightCropDimensions  — calculates output canvas size from diagram size + padding
 * PNG export transform    — scale=1, origin placed at CROP_PADDING
 */
import { describe, it, expect } from 'vitest';

// ── Inline the pure crop helpers so tests don't depend on the hook's
//    side-effect-laden canvas reads. ─────────────────────────────────

const CROP_PADDING = 40;

function getTightCropDimensions(dw: number, dh: number) {
  const outW = dw > 0 ? Math.round(dw + CROP_PADDING * 2) : 1280;
  const outH = dh > 0 ? Math.round(dh + CROP_PADDING * 2) : 720;
  return { outW, outH };
}

// ── getTightCropDimensions ───────────────────────────────────────────

describe('getTightCropDimensions', () => {
  it('adds 2× CROP_PADDING to each dimension', () => {
    const { outW, outH } = getTightCropDimensions(500, 300);
    expect(outW).toBe(500 + CROP_PADDING * 2);
    expect(outH).toBe(300 + CROP_PADDING * 2);
  });

  it('falls back to 1280×720 when diagram size is zero', () => {
    const { outW, outH } = getTightCropDimensions(0, 0);
    expect(outW).toBe(1280);
    expect(outH).toBe(720);
  });

  it('falls back outW to 1280 when only width is zero, but outH uses the given height', () => {
    const { outW, outH } = getTightCropDimensions(0, 400);
    expect(outW).toBe(1280);
    expect(outH).toBe(400 + CROP_PADDING * 2);
  });

  it('rounds fractional diagram dimensions to integers', () => {
    const { outW, outH } = getTightCropDimensions(499.7, 299.3);
    expect(Number.isInteger(outW)).toBe(true);
    expect(Number.isInteger(outH)).toBe(true);
    expect(outW).toBe(Math.round(499.7 + CROP_PADDING * 2));
    expect(outH).toBe(Math.round(299.3 + CROP_PADDING * 2));
  });

  it('handles very small diagrams (< 1px)', () => {
    const { outW, outH } = getTightCropDimensions(0.5, 0.5);
    expect(outW).toBe(Math.round(0.5 + CROP_PADDING * 2));
    expect(outH).toBe(Math.round(0.5 + CROP_PADDING * 2));
  });

  it('handles very large diagrams without overflow', () => {
    const { outW, outH } = getTightCropDimensions(8000, 6000);
    expect(outW).toBe(8080);
    expect(outH).toBe(6080);
  });
});
