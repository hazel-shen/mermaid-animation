import { getCumulativeTransform } from '../services/svgUtils';

// ─── Pattern A: extractComputedColors / extractComputedStroke ────────────────

/**
 * Extracts fill (color) and stroke from an element's computed style,
 * falling back to the provided defaults when the computed value is absent or 'none'.
 */
export const extractComputedColors = (
  el: Element,
  defaults: { color: string; stroke: string },
): { color: string; stroke: string } => {
  const style = window.getComputedStyle(el);
  const color  = (style.fill   && style.fill   !== 'none') ? style.fill   : defaults.color;
  const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : defaults.stroke;
  return { color, stroke };
};

/**
 * Extracts stroke from an element's computed style, falling back to the provided
 * default when the computed value is absent or 'none'.
 */
export const extractComputedStroke = (el: Element, fallback: string): string => {
  const style = window.getComputedStyle(el);
  return (style.stroke && style.stroke !== 'none') ? style.stroke : fallback;
};

// ─── Pattern A (null-returning variant, for GenericParser) ───────────────────

/**
 * Returns the computed fill of an element, or null if absent/transparent.
 * Falls back to the fill attribute before returning null.
 * Used when null is semantically meaningful (e.g. edge vs node detection).
 */
export const computedFill = (el: Element): string | null => {
  const style = window.getComputedStyle(el);
  if (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)') return style.fill;
  const attr = el.getAttribute('fill');
  return (attr && attr !== 'none') ? attr : null;
};

/**
 * Returns the computed stroke of an element, or null if absent/transparent.
 * Falls back to the stroke attribute before returning null.
 */
export const computedStroke = (el: Element): string | null => {
  const style = window.getComputedStyle(el);
  if (style.stroke && style.stroke !== 'none' && style.stroke !== 'rgba(0, 0, 0, 0)') return style.stroke;
  const attr = el.getAttribute('stroke');
  return (attr && attr !== 'none') ? attr : null;
};

// ─── Pattern C: lineToPathD ──────────────────────────────────────────────────

/**
 * Converts a SVG <line> element into an absolute `M x1 y1 L x2 y2` path string,
 * applying the element's cumulative ancestor transforms so the result is in
 * SVG root coordinates.
 */
export const lineToPathD = (line: Element, svgElement: SVGSVGElement): string => {
  const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
  const x1 = parseFloat(line.getAttribute('x1') || '0') + tx;
  const y1 = parseFloat(line.getAttribute('y1') || '0') + ty;
  const x2 = parseFloat(line.getAttribute('x2') || '0') + tx;
  const y2 = parseFloat(line.getAttribute('y2') || '0') + ty;
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

// ─── Pattern B + F: rectCenter ───────────────────────────────────────────────

export interface RectCenter {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Computes the SVG-root-coordinate centre and dimensions of a graphics element
 * by calling getBBox() and applying the cumulative ancestor transform.
 * Returns null if getBBox throws (hidden element) or the element has zero size.
 *
 * Combines patterns B (BBox + transform → centre) and F (try/catch getBBox).
 */
export const rectCenter = (
  el: SVGGraphicsElement,
  svgElement: SVGSVGElement,
): RectCenter | null => {
  try {
    const bbox = el.getBBox();
    if (bbox.width <= 0 || bbox.height <= 0) return null;
    const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
    return {
      cx: tx + bbox.x + bbox.width / 2,
      cy: ty + bbox.y + bbox.height / 2,
      width: bbox.width,
      height: bbox.height,
    };
  } catch {
    return null;
  }
};

// ─── Pattern D: parentLabel ──────────────────────────────────────────────────

/**
 * Finds the first <text> element inside el.parentElement and returns its
 * trimmed textContent, or '' if not found.
 *
 * Replaces the repeated:
 *   const parentG = el.parentElement;
 *   let label = '';
 *   if (parentG) { const txt = parentG.querySelector('text'); if (txt) label = ...; }
 */
export const parentLabel = (el: Element): string =>
  el.parentElement?.querySelector('text')?.textContent?.trim() ?? '';

// ─── Pattern E: extractEdgeStyle ─────────────────────────────────────────────

/**
 * Reads stroke colour and dash pattern from an element's computed style,
 * falling back to a default stroke colour when the computed value is absent.
 *
 * Replaces the identical first ~10 lines of processEdge() that appeared in
 * FlowchartParser, SequenceParser, and StateParser.
 */
export const extractEdgeStyle = (
  el: Element,
  isPremium: boolean,
): { stroke: string; dash: number[] | undefined } => {
  const style = window.getComputedStyle(el);
  const stroke = (style.stroke && style.stroke !== 'none')
    ? style.stroke
    : (isPremium ? '#94a3b8' : '#333');
  let dash: number[] | undefined;
  if (style.strokeDasharray && style.strokeDasharray !== 'none') {
    const vals = style.strokeDasharray.split(',').map(n => parseFloat(n));
    if (vals.some(v => v > 0)) dash = vals;
  }
  return { stroke, dash };
};

// ─── Pattern G: nextId ───────────────────────────────────────────────────────

/**
 * Sequential, deterministic ID generator.
 * Replaces Math.random() IDs that made diffs and unit tests non-reproducible.
 *
 * Call resetIdCounter() at the start of each parse (or in test beforeEach)
 * to get stable, predictable IDs within a session.
 */
let _idSeq = 0;
export const nextId = (prefix: string): string => `${prefix}-${++_idSeq}`;
export const resetIdCounter = (): void => { _idSeq = 0; };
