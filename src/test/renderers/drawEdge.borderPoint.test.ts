import { describe, it, expect } from 'vitest';
import { borderPoint } from '../../utils/drawEdge';
import type { DiagramNode } from '../../types';

/** Build a minimal DiagramNode centred at (cx, cy) with given dimensions. */
const node = (
  shape: DiagramNode['shape'],
  cx = 0, cy = 0,
  width = 100, height = 40,
): DiagramNode => ({
  id: 'n', label: '', type: 'node',
  x: cx, y: cy, width, height,
  color: '#fff', stroke: '#333', shape,
});

const approx = (a: number, b: number) => Math.abs(a - b) < 0.5;

// ── asymmetric ────────────────────────────────────────────────────────────────
describe('borderPoint – asymmetric', () => {
  // Shape centred at (0,0), width=100 height=40
  // notch = hh*0.9 = 20*0.9 = 18  → notch point at (-50+18, 0) = (-32, 0)
  const n = node('asymmetric');

  it('angle=0 (right): hits flat right edge at x=+50', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=π (left): hits concave notch point at x=-32, y=0', () => {
    const pt = borderPoint(Math.PI, n);
    // notch point: cx - hw + notch = 0 - 50 + 18 = -32
    expect(approx(pt.x, -32)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=-π/2 (up): hits top edge at y=-20', () => {
    const pt = borderPoint(-Math.PI / 2, n);
    expect(approx(pt.y, -20)).toBe(true);
  });

  it('angle=π/2 (down): hits bottom edge at y=+20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
  });

  it('result is on the shape boundary (not inside bounding box left edge)', () => {
    // A ray going left from centre must NOT land at x=-50 (bounding box),
    // it should land at x=-32 (the notch).
    const pt = borderPoint(Math.PI, n);
    expect(pt.x).toBeGreaterThan(-50);
  });
});

// ── parallelogram ─────────────────────────────────────────────────────────────
describe('borderPoint – parallelogram [/text/]', () => {
  // width=100 height=40, skew = hh*0.6 = 20*0.6 = 12
  // tl=(−50+12,−20)=(−38,−20)  tr=(50,−20)
  // bl=(−50,20)                 br=(50−12,20)=(38,20)
  const n = node('parallelogram');

  it('angle=0 (right): hits right slanted edge, x < 50', () => {
    const pt = borderPoint(0, n);
    // Right side goes from (50,−20) to (38,20); ray y=0 hits midpoint x=44
    expect(pt.x).toBeLessThan(50);
    expect(approx(pt.x, 44)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=π (left): hits left slanted edge, x > −50', () => {
    const pt = borderPoint(Math.PI, n);
    // Left side goes from (−38,−20) to (−50,20); ray y=0 hits midpoint x=−44
    expect(pt.x).toBeGreaterThan(-50);
    expect(approx(pt.x, -44)).toBe(true);
  });

  it('angle=-π/2 (up): hits top edge at y=-20', () => {
    const pt = borderPoint(-Math.PI / 2, n);
    expect(approx(pt.y, -20)).toBe(true);
  });

  it('angle=π/2 (down): hits bottom edge at y=+20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
  });
});

// ── parallelogramAlt ──────────────────────────────────────────────────────────
describe('borderPoint – parallelogramAlt [\\text\\]', () => {
  // tl=(−50,−20) tr=(38,−20)  bl=(−38,20) br=(50,20)  (mirror of parallelogram)
  const n = node('parallelogramAlt');

  it('angle=0 (right): hits right slanted edge, x < 50', () => {
    const pt = borderPoint(0, n);
    expect(pt.x).toBeLessThan(50);
    expect(approx(pt.x, 44)).toBe(true);
  });

  it('angle=π (left): hits left slanted edge, x > −50', () => {
    const pt = borderPoint(Math.PI, n);
    expect(pt.x).toBeGreaterThan(-50);
    expect(approx(pt.x, -44)).toBe(true);
  });
});

// ── trapezoid ─────────────────────────────────────────────────────────────────
describe('borderPoint – trapezoid [/text\\]', () => {
  // tl=(−38,−20) tr=(38,−20)  bl=(−50,20) br=(50,20)  — top narrower
  const n = node('trapezoid');

  it('angle=0 (right): hits right slanted edge', () => {
    const pt = borderPoint(0, n);
    expect(pt.x).toBeLessThan(50);
  });

  it('angle=π (left): hits left slanted edge', () => {
    const pt = borderPoint(Math.PI, n);
    expect(pt.x).toBeGreaterThan(-50);
  });

  it('angle=π/2 (down): hits wider bottom edge at y=+20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });
});

// ── trapezoidAlt ──────────────────────────────────────────────────────────────
describe('borderPoint – trapezoidAlt [\\text/]', () => {
  // tl=(−50,−20) tr=(50,−20)  bl=(−38,20) br=(38,20)  — top wider
  const n = node('trapezoidAlt');

  it('angle=-π/2 (up): hits wider top edge at y=-20', () => {
    const pt = borderPoint(-Math.PI / 2, n);
    expect(approx(pt.y, -20)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });

  it('angle=π/2 (down): hits narrower bottom edge at y=+20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
  });
});

// ── rect (regression) ────────────────────────────────────────────────────────
describe('borderPoint – rect (regression, unchanged)', () => {
  const n = node('rect');

  it('angle=0: x=50', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=π/2: y=20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
  });
});
