import { describe, it, expect } from 'vitest';
import { getLuminance } from '../../utils/colorUtils';

describe('getLuminance', () => {
  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns 1 for empty string', () => {
    expect(getLuminance('')).toBe(1);
  });

  it('returns 1 for "none"', () => {
    expect(getLuminance('none')).toBe(1);
  });

  it('returns 1 for "transparent"', () => {
    expect(getLuminance('transparent')).toBe(1);
  });

  // ── Hex colours ───────────────────────────────────────────────────────────

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
    // WCAG relative luminance: 0.2126 * 1 + 0 + 0
    expect(getLuminance('#ff0000')).toBeCloseTo(0.2126, 3);
  });

  it('returns ~0.7152 for pure green (#00ff00)', () => {
    expect(getLuminance('#00ff00')).toBeCloseTo(0.7152, 3);
  });

  it('returns ~0.0722 for pure blue (#0000ff)', () => {
    expect(getLuminance('#0000ff')).toBeCloseTo(0.0722, 3);
  });

  // ── rgb() / rgba() colours ────────────────────────────────────────────────

  it('returns 0 for rgb(0,0,0)', () => {
    expect(getLuminance('rgb(0,0,0)')).toBe(0);
  });

  it('returns 1 for rgb(255,255,255)', () => {
    expect(getLuminance('rgb(255,255,255)')).toBeCloseTo(1, 5);
  });

  it('handles spaces in rgb()', () => {
    expect(getLuminance('rgb( 255 , 255 , 255 )')).toBeCloseTo(1, 5);
  });

  it('ignores alpha channel in rgba() — luminance is the same as rgb()', () => {
    const opaque = getLuminance('rgb(100,149,237)');
    const semitrans = getLuminance('rgba(100,149,237,0.5)');
    expect(opaque).toBeCloseTo(semitrans, 5);
  });

  // ── Dark / light threshold behaviour ─────────────────────────────────────

  it('dark colour (#1e293b) has luminance below 0.35', () => {
    expect(getLuminance('#1e293b')).toBeLessThan(0.35);
  });

  it('light colour (#f1f5f9) has luminance above 0.35', () => {
    expect(getLuminance('#f1f5f9')).toBeGreaterThan(0.35);
  });

  it('returns 1 for unrecognised format (falls back to white)', () => {
    // No hex and no rgb() match → r=g=b=255 → luminance = 1
    expect(getLuminance('cornflowerblue')).toBeCloseTo(1, 5);
  });
});
