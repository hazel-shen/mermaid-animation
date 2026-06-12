/**
 * Tests for the tight-crop export calculations introduced in the
 * "diagram bounding box crop" feature.
 *
 * Covered logic
 * ─────────────
 * getTightCropDimensions  — calculates output canvas size from diagram size + padding
 */
import { describe, it, expect } from 'vitest';
import { CROP_PADDING, getTightCropDimensions } from '../../hooks/useMediaRecorder';

// The hook reads diagram size from a React ref; structurally a ref is just
// { current }, so tests can build one without rendering anything.
const sizeRef = (w: number, h: number) => ({ current: { w, h } });

describe('getTightCropDimensions', () => {
  // Pin the padding value with a literal: export output dimensions are part of
  // the user-visible contract, so changing CROP_PADDING should fail loudly here
  // rather than silently resize every exported GIF/MP4.
  it('uses 40px crop padding', () => {
    expect(CROP_PADDING).toBe(40);
  });

  it('adds 2× CROP_PADDING to each dimension', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(500, 300));
    expect(outW).toBe(580);
    expect(outH).toBe(380);
  });

  it('falls back to 1280×720 when diagram size is zero', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(0, 0));
    expect(outW).toBe(1280);
    expect(outH).toBe(720);
  });

  it('falls back outW to 1280 when only width is zero, but outH uses the given height', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(0, 400));
    expect(outW).toBe(1280);
    expect(outH).toBe(400 + CROP_PADDING * 2);
  });

  it('rounds fractional diagram dimensions to integers', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(499.7, 299.3));
    expect(Number.isInteger(outW)).toBe(true);
    expect(Number.isInteger(outH)).toBe(true);
    expect(outW).toBe(Math.round(499.7 + CROP_PADDING * 2));
    expect(outH).toBe(Math.round(299.3 + CROP_PADDING * 2));
  });

  it('handles very small diagrams (< 1px)', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(0.5, 0.5));
    expect(outW).toBe(Math.round(0.5 + CROP_PADDING * 2));
    expect(outH).toBe(Math.round(0.5 + CROP_PADDING * 2));
  });

  it('handles very large diagrams without overflow', () => {
    const { outW, outH } = getTightCropDimensions(sizeRef(8000, 6000));
    expect(outW).toBe(8080);
    expect(outH).toBe(6080);
  });
});
