/**
 * borderPoint coverage for shapes not covered by drawEdge.borderPoint.test.ts:
 * - ellipse branch: circle, cloud, bang
 * - L1-norm branch: diamond
 * - rect fallback: roundRect, stadium, note, hexagon, subroutine, cylinder
 */
import { describe, it, expect } from 'vitest';
import { borderPoint } from '../../utils/drawEdge';
import type { DiagramNode } from '../../types';

const node = (
  shape: DiagramNode['shape'],
  cx = 0, cy = 0,
  width = 100, height = 40,
): DiagramNode => ({
  id: 'n', label: '', type: 'node',
  x: cx, y: cy, width, height,
  color: '#fff', stroke: '#333', shape,
});

const approx = (a: number, b: number, tol = 0.5) => Math.abs(a - b) < tol;

// ── ellipse branch: circle ────────────────────────────────────────────────────

describe('borderPoint – circle (ellipse formula)', () => {
  const n = node('circle', 0, 0, 100, 100); // rx = ry = 50

  it('angle=0 (right): x = +50, y ≈ 0', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=π (left): x = -50, y ≈ 0', () => {
    const pt = borderPoint(Math.PI, n);
    expect(approx(pt.x, -50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=-π/2 (up): y = -50', () => {
    const pt = borderPoint(-Math.PI / 2, n);
    expect(approx(pt.y, -50)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });

  it('angle=π/2 (down): y = +50', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 50)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });

  it('point lies on the ellipse surface', () => {
    for (const angle of [0.1, 0.7, 1.3, 2.0, 2.8, 4.0, 5.5]) {
      const { x, y } = borderPoint(angle, n);
      const hw = 50, hh = 50;
      // (x/hw)^2 + (y/hh)^2 ≈ 1
      expect((x / hw) ** 2 + (y / hh) ** 2).toBeCloseTo(1, 1);
    }
  });
});

// ── ellipse branch: cloud / bang ──────────────────────────────────────────────

describe('borderPoint – cloud (ellipse formula)', () => {
  const n = node('cloud', 0, 0, 120, 60); // hw=60, hh=30

  it('angle=0: x = +60', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 60)).toBe(true);
  });

  it('angle=π/2: y = +30', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 30)).toBe(true);
  });

  it('non-axis angle: lies on ellipse', () => {
    const angle = Math.PI / 4;
    const { x, y } = borderPoint(angle, n);
    expect((x / 60) ** 2 + (y / 30) ** 2).toBeCloseTo(1, 1);
  });
});

describe('borderPoint – bang (ellipse formula)', () => {
  const n = node('bang', 0, 0, 80, 80); // hw=hh=40

  it('angle=0: x = +40', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 40)).toBe(true);
  });

  it('angle=π: x = -40', () => {
    const pt = borderPoint(Math.PI, n);
    expect(approx(pt.x, -40)).toBe(true);
  });
});

// ── L1-norm branch: diamond ───────────────────────────────────────────────────

describe('borderPoint – diamond (L1-norm formula)', () => {
  // width=100, height=40 → hw=50, hh=20
  const n = node('diamond');

  it('angle=0 (right): x = hw = +50', () => {
    const pt = borderPoint(0, n);
    expect(approx(pt.x, 50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=π (left): x = -hw = -50', () => {
    const pt = borderPoint(Math.PI, n);
    expect(approx(pt.x, -50)).toBe(true);
    expect(approx(pt.y, 0)).toBe(true);
  });

  it('angle=-π/2 (up): y = -hh = -20', () => {
    const pt = borderPoint(-Math.PI / 2, n);
    expect(approx(pt.y, -20)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });

  it('angle=π/2 (down): y = +hh = +20', () => {
    const pt = borderPoint(Math.PI / 2, n);
    expect(approx(pt.y, 20)).toBe(true);
    expect(approx(pt.x, 0)).toBe(true);
  });

  it('45° diagonal: point lies on diamond edge (|x|/hw + |y|/hh = 1)', () => {
    const pt = borderPoint(Math.PI / 4, n);
    const hw = 50, hh = 20;
    expect(Math.abs(pt.x) / hw + Math.abs(pt.y) / hh).toBeCloseTo(1, 2);
  });
});

// ── rect fallback: various shapes that share the rectangular border ───────────

describe('borderPoint – rect-fallback shapes', () => {
  // All these shapes fall through to the default rectangle calculation:
  // t = min(hw / |dx|, hh / |dy|)
  const rectLike: DiagramNode['shape'][] = [
    'roundRect', 'stadium', 'note', 'hexagon', 'subroutine', 'cylinder', 'forkJoin',
  ];

  for (const shape of rectLike) {
    describe(`shape: ${shape}`, () => {
      const n = node(shape); // width=100, height=40 → hw=50, hh=20

      it('angle=0 (right): x ≈ +50', () => {
        const pt = borderPoint(0, n);
        expect(approx(pt.x, 50)).toBe(true);
        expect(approx(pt.y, 0)).toBe(true);
      });

      it('angle=π/2 (down): y ≈ +20', () => {
        const pt = borderPoint(Math.PI / 2, n);
        expect(approx(pt.y, 20)).toBe(true);
        expect(approx(pt.x, 0)).toBe(true);
      });
    });
  }
});
