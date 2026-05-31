import { describe, it, expect } from 'vitest';
import { getLuminance } from '../../utils/colorUtils';

describe('getLuminance', () => {
  it('returns 1 for empty string', () => {
    expect(getLuminance('')).toBe(1);
  });

  it('returns 0 for black (#000000)', () => {
    expect(getLuminance('#000000')).toBe(0);
  });

  it('returns 1 for white (#ffffff)', () => {
    expect(getLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('handles 3-digit hex shorthand (#fff)', () => {
    expect(getLuminance('#fff')).toBeCloseTo(1, 5);
  });

  it('handles 3-digit hex shorthand (#000)', () => {
    expect(getLuminance('#000')).toBe(0);
  });

  it('returns ~0.2126 for pure red (#ff0000)', () => {
    expect(getLuminance('#ff0000')).toBeCloseTo(0.2126, 3);
  });

  it('returns ~0.7152 for pure green (#00ff00)', () => {
    expect(getLuminance('#00ff00')).toBeCloseTo(0.7152, 3);
  });

  it('returns ~0.0722 for pure blue (#0000ff)', () => {
    expect(getLuminance('#0000ff')).toBeCloseTo(0.0722, 3);
  });

  it('returns 0 for rgb(0,0,0)', () => {
    expect(getLuminance('rgb(0,0,0)')).toBe(0);
  });

  it('returns 1 for rgb(255,255,255)', () => {
    expect(getLuminance('rgb(255,255,255)')).toBeCloseTo(1, 5);
  });

  it('ignores alpha channel in rgba() — luminance is the same as rgb()', () => {
    const opaque = getLuminance('rgb(100,149,237)');
    const semitrans = getLuminance('rgba(100,149,237,0.5)');
    expect(opaque).toBeCloseTo(semitrans, 5);
  });

  it('returns 1 for unrecognised format (falls back to white)', () => {
    expect(getLuminance('cornflowerblue')).toBeCloseTo(1, 5);
  });
});
