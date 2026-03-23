import { describe, it, expect } from 'vitest';
import { parseSegment, tokenisePath, getPathEnd, getPathStart } from '../../utils/pathUtils';

describe('parseSegment', () => {
  it('parses a Move command', () => {
    expect(parseSegment('M 100 200')).toEqual({ cmd: 'M', nums: [100, 200] });
  });

  it('parses a Line command', () => {
    expect(parseSegment('L 50 75')).toEqual({ cmd: 'L', nums: [50, 75] });
  });

  it('parses a Cubic Bezier with comma-separated values', () => {
    expect(parseSegment('C 10,20 30,40 50,60')).toEqual({
      cmd: 'C',
      nums: [10, 20, 30, 40, 50, 60],
    });
  });

  it('normalises lowercase command to uppercase', () => {
    expect(parseSegment('m 5 10').cmd).toBe('M');
  });

  it('returns cmd "Z" for a close-path command', () => {
    expect(parseSegment('Z').cmd).toBe('Z');
  });
});

describe('tokenisePath', () => {
  it('splits a simple M+L path into two segments', () => {
    const segs = tokenisePath('M 0 0 L 100 100');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatch(/^M/i);
    expect(segs[1]).toMatch(/^L/i);
  });

  it('splits a M+C+L path into three segments', () => {
    const segs = tokenisePath('M 0 0 C 10 10 20 20 30 30 L 50 50');
    expect(segs).toHaveLength(3);
  });

  it('returns empty array for an empty string', () => {
    expect(tokenisePath('')).toEqual([]);
  });

  it('handles leading/trailing whitespace', () => {
    const segs = tokenisePath('  M 0 0 L 10 10  ');
    expect(segs).toHaveLength(2);
  });
});

describe('getPathEnd', () => {
  it('returns null for a single-segment path', () => {
    expect(getPathEnd('M 0 0')).toBeNull();
  });

  it('extracts endpoint and angle from a M+L path', () => {
    // Horizontal line going right → angle ≈ 0
    const result = getPathEnd('M 0 0 L 100 0');
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(100);
    expect(result!.y).toBeCloseTo(0);
    expect(result!.angle).toBeCloseTo(0);
  });

  it('extracts endpoint from a M+C path', () => {
    // C ends at the last two numbers
    const result = getPathEnd('M 0 0 C 10 0 90 0 100 0');
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(100);
    expect(result!.y).toBeCloseTo(0);
  });

  it('returns correct angle for a downward line', () => {
    // Vertical downward → angle ≈ π/2
    const result = getPathEnd('M 0 0 L 0 100');
    expect(result).not.toBeNull();
    expect(result!.angle).toBeCloseTo(Math.PI / 2);
  });

  it('returns null when the last segment has zero length', () => {
    // Degenerate L with same start/end point
    const result = getPathEnd('M 0 0 L 0 0');
    expect(result).toBeNull();
  });
});

describe('getPathStart', () => {
  it('returns null for a single-segment path', () => {
    expect(getPathStart('M 0 0')).toBeNull();
  });

  it('extracts start point from a M+L path', () => {
    const result = getPathStart('M 0 0 L 100 0');
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0);
    expect(result!.y).toBeCloseTo(0);
  });

  it('angle is reversed (π offset) so marker points back toward source', () => {
    // Horizontal rightward path: atan2(0,100)=0, then +π → angle ≈ π
    const result = getPathStart('M 0 0 L 100 0');
    expect(result!.angle).toBeCloseTo(Math.PI);
  });

  it('extracts start point from a M+C path using first control point for tangent', () => {
    const result = getPathStart('M 0 0 C 50 0 50 100 100 100');
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0);
    expect(result!.y).toBeCloseTo(0);
  });

  it('returns null when first segment is not M', () => {
    expect(getPathStart('L 0 0 L 100 100')).toBeNull();
  });
});
