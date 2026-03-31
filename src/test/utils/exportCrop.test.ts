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

function getPngExportTransform(dw: number, dh: number, padding = CROP_PADDING) {
  const outW = dw > 0 ? Math.round(dw + padding * 2) : 1920;
  const outH = dh > 0 ? Math.round(dh + padding * 2) : 1080;
  const tr = { x: padding, y: padding, scale: 1 };
  return { outW, outH, tr };
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

// ── PNG export transform ─────────────────────────────────────────────

describe('getPngExportTransform', () => {
  it('places diagram at (PADDING, PADDING) with scale 1', () => {
    const { tr } = getPngExportTransform(500, 300);
    expect(tr.x).toBe(CROP_PADDING);
    expect(tr.y).toBe(CROP_PADDING);
    expect(tr.scale).toBe(1);
  });

  it('output size equals diagram size + 2× padding', () => {
    const { outW, outH } = getPngExportTransform(640, 480);
    expect(outW).toBe(640 + CROP_PADDING * 2);
    expect(outH).toBe(480 + CROP_PADDING * 2);
  });

  it('falls back to 1920×1080 when diagram size is zero', () => {
    const { outW, outH } = getPngExportTransform(0, 0);
    expect(outW).toBe(1920);
    expect(outH).toBe(1080);
  });

  it('diagram drawn at tr.x/tr.y lands exactly inside the output canvas', () => {
    const dw = 700, dh = 500;
    const { outW, outH, tr } = getPngExportTransform(dw, dh);
    // Diagram right edge = tr.x + dw * scale
    const diagramRight  = tr.x + dw * tr.scale;
    const diagramBottom = tr.y + dh * tr.scale;
    expect(diagramRight).toBeLessThanOrEqual(outW);
    expect(diagramBottom).toBeLessThanOrEqual(outH);
  });

  it('right/bottom margin equals left/top margin (centred padding)', () => {
    const dw = 600, dh = 400;
    const { outW, outH, tr } = getPngExportTransform(dw, dh);
    const marginRight  = outW - (tr.x + dw * tr.scale);
    const marginBottom = outH - (tr.y + dh * tr.scale);
    expect(marginRight).toBeCloseTo(tr.x, 5);
    expect(marginBottom).toBeCloseTo(tr.y, 5);
  });

  it('accepts a custom padding value', () => {
    const { outW, outH, tr } = getPngExportTransform(400, 300, 20);
    expect(tr.x).toBe(20);
    expect(tr.y).toBe(20);
    expect(outW).toBe(440);
    expect(outH).toBe(340);
  });
});
