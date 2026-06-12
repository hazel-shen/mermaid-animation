import { describe, it, expect } from 'vitest';
import { getLuminance, hexToRgba } from '../../utils/colorUtils';

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

describe('hexToRgba', () => {
  it('converts a 6-digit hex color to rgba with the given alpha', () => {
    expect(hexToRgba('#3b82f6', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
  });

  it('handles uppercase hex digits', () => {
    expect(hexToRgba('#FF0000', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('converts black and white', () => {
    expect(hexToRgba('#000000', 0.2)).toBe('rgba(0, 0, 0, 0.2)');
    expect(hexToRgba('#ffffff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(hexToRgba('  #000000  ', 1)).toBe('rgba(0, 0, 0, 1)');
  });

  // FlowchartParser.ts:38 defaults cluster color to '#fff' in non-premium mode,
  // so 3-digit shorthand reaches hexToRgba whenever the computed fill is
  // none/black. Previously this produced invalid CSS: rgba(255, 15, NaN, …).
  it('expands 3-digit hex shorthand (#fff)', () => {
    expect(hexToRgba('#fff', 0.05)).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('expands mixed 3-digit hex shorthand (#f90)', () => {
    expect(hexToRgba('#f90', 1)).toBe('rgba(255, 153, 0, 1)');
  });

  it('supports alpha 0 (fully transparent)', () => {
    expect(hexToRgba('#123456', 0)).toBe('rgba(18, 52, 86, 0)');
  });

  it('adds an alpha channel to an rgb() color', () => {
    expect(hexToRgba('rgb(10, 20, 30)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
  });

  it('replaces the alpha of an existing rgba() color', () => {
    expect(hexToRgba('rgba(10, 20, 30, 0.9)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
  });

  it('returns named colors unchanged (cannot convert without a lookup table)', () => {
    expect(hexToRgba('cornflowerblue', 0.5)).toBe('cornflowerblue');
  });

  // FlowchartParser.ts:207 calls hexToRgba(color, 0.05) on subgraph fills —
  // this is the in-production combination, so pin it down explicitly.
  it('handles the low-alpha subgraph-fill case used by FlowchartParser', () => {
    expect(hexToRgba('#e8f5e9', 0.05)).toBe('rgba(232, 245, 233, 0.05)');
  });
});
