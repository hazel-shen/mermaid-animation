/**
 * Tests for the Particle class.
 *
 * jsdom does not implement SVG geometry APIs, so we mock document.createElementNS
 * to return a fake SVGPathElement with predictable getTotalLength / getPointAtLength.
 *
 * Virtual path: M 0,0 L 100,0  (horizontal line, length=100)
 *   getPointAtLength(d) → { x: d, y: 0 }
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Particle } from '../../utils/particle';

const TOTAL_LENGTH = 100;

let mockGetTotalLength: ReturnType<typeof vi.fn>;
let mockGetPointAtLength: ReturnType<typeof vi.fn>;
let originalCreateElementNS: typeof document.createElementNS;

beforeEach(() => {
  mockGetTotalLength = vi.fn(() => TOTAL_LENGTH);
  mockGetPointAtLength = vi.fn((d: number) => ({ x: d, y: 0 }));

  originalCreateElementNS = document.createElementNS.bind(document);
  vi.spyOn(document, 'createElementNS').mockImplementation((ns, tag) => {
    if (tag === 'path') {
      return {
        setAttribute: vi.fn(),
        getTotalLength: mockGetTotalLength,
        getPointAtLength: mockGetPointAtLength,
      } as unknown as Element;
    }
    return originalCreateElementNS(ns, tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Particle – construction', () => {
  it('samples 100 points during construction', () => {
    new Particle('M 0,0 L 100,0');
    expect(mockGetTotalLength).toHaveBeenCalledTimes(1);
    expect(mockGetPointAtLength).toHaveBeenCalledTimes(100);
  });

  it('does not retain a DOM reference after construction (pathElement is null)', () => {
    const p = new Particle('M 0,0 L 100,0');
    expect(p.pathElement).toBeNull();
  });

  it('samples the first point at length 0', () => {
    new Particle('M 0,0 L 100,0');
    expect(mockGetPointAtLength).toHaveBeenCalledWith(0);
  });

  it('samples the last point at full length', () => {
    new Particle('M 0,0 L 100,0');
    expect(mockGetPointAtLength).toHaveBeenCalledWith(TOTAL_LENGTH);
  });

  it('returns (0,0) for an invalid path (getTotalLength throws)', () => {
    mockGetTotalLength.mockImplementationOnce(() => { throw new Error('no geometry'); });
    const p = new Particle('INVALID');
    expect(p.getPosition()).toEqual({ x: 0, y: 0 });
  });

  it('returns (0,0) when path length is 0', () => {
    mockGetTotalLength.mockReturnValueOnce(0);
    const p = new Particle('M 0,0');
    expect(p.getPosition()).toEqual({ x: 0, y: 0 });
  });
});

describe('Particle – getPosition()', () => {
  it('returns start point when progress=0', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0;
    const pos = p.getPosition();
    expect(pos.x).toBeCloseTo(0, 1);
    expect(pos.y).toBeCloseTo(0, 1);
  });

  it('returns end point when progress=1', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 1;
    const pos = p.getPosition();
    expect(pos.x).toBeCloseTo(100, 1);
    expect(pos.y).toBeCloseTo(0, 1);
  });

  it('returns midpoint when progress=0.5 (linear interpolation)', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0.5;
    const pos = p.getPosition();
    expect(pos.x).toBeCloseTo(50, 0);
    expect(pos.y).toBeCloseTo(0, 1);
  });

  it('interpolates smoothly between adjacent samples', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0.1;
    const pos1 = p.getPosition();
    p.progress = 0.101;
    const pos2 = p.getPosition();
    expect(pos2.x).toBeGreaterThan(pos1.x);
  });
});

describe('Particle – update()', () => {
  it('advances progress by speed each call', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0;
    const speed = p.speed;
    p.update(1);
    expect(p.progress).toBeCloseTo(speed, 6);
  });

  it('wraps progress back to near 0 when it exceeds 1', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0.999;
    p.update(1);
    expect(p.progress).toBeLessThan(0.1);
  });

  it('respects the speed multiplier', () => {
    const p = new Particle('M 0,0 L 100,0');
    p.progress = 0;
    const speed = p.speed;
    p.update(3);
    expect(p.progress).toBeCloseTo(speed * 3, 6);
  });
});
