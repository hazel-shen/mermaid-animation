/**
 * Returns the alpha channel of a CSS color string, or 1 when the color has
 * no explicit alpha (hex, rgb(), named colors).
 */
export const getAlpha = (colorStr: string): number => {
  const m = colorStr?.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/i);
  return m ? parseFloat(m[1]) : 1;
};

/**
 * Parses a CSS color string (hex, rgb, rgba, named) and returns perceived
 * luminance in [0, 1]. Returns 1 (light) for unrecognised formats.
 */
export const getLuminance = (colorStr: string): number => {
  if (!colorStr || colorStr === 'none' || colorStr === 'transparent') return 1;

  let r = 255, g = 255, b = 255;

  const rgbMatch = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    r = parseFloat(rgbMatch[1]);
    g = parseFloat(rgbMatch[2]);
    b = parseFloat(rgbMatch[3]);
  } else {
    let hex = colorStr.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }

  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

export const hexToRgba = (color: string, alpha: number): string => {
  color = color.trim();
  if (color.startsWith('#')) {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/[^,]+(?=\))/, ` ${alpha}`);
  }
  return color;
};
