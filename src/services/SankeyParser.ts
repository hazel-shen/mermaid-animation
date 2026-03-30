/**
 * SankeyParser: Parses Mermaid sankey-beta SVG output.
 *
 * Mermaid sankey-beta renders with D3-sankey:
 *  - Nodes  : <rect> elements (narrow vertical bars)
 *  - Links  : open <path> elements with large stroke-width (band thickness ∝ flow value)
 *             The stroke references a <linearGradient> in <defs> for source→target colouring.
 *  - Labels : <text> elements (node names, positioned beside the bars)
 */
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { nextId, extractComputedColors, applyTranslateToPathD } from '../utils/parser-base';
import { getLuminance } from '../utils/colorUtils';

// ─── Gradient resolution ─────────────────────────────────────────────────────

/**
 * Resolves a CSS color value to [stop0Color, stop1Color].
 *
 * If the value is a `url("#gradientId")` reference, looks up the <linearGradient>
 * in the SVG <defs> and returns the first and last stop colors.
 * If it's a plain color, returns it twice (uniform gradient).
 * Returns null if the reference cannot be resolved.
 */
function resolveGradientStops(
  svgElement: SVGSVGElement,
  colorValue: string,
): [string, string] | null {
  const gradRef = colorValue.match(/url\(["']?#([^"')]+)["']?\)/);
  if (!gradRef) {
    // Plain solid color
    return [colorValue, colorValue];
  }

  const gradientId = gradRef[1];
  const gradient = svgElement.querySelector(`#${CSS.escape(gradientId)}`);
  if (!gradient) return null;

  const stops = gradient.querySelectorAll('stop');
  if (stops.length === 0) return null;

  const stopColor = (stop: Element): string => {
    // stop-color can be on style or as attribute
    const s = window.getComputedStyle(stop);
    return stop.getAttribute('stop-color') || s.stopColor || '#64748b';
  };

  const c0 = stopColor(stops[0]);
  const c1 = stopColor(stops[stops.length - 1]);
  return [c0, c1];
}

// ─── Public parse functions ───────────────────────────────────────────────────

/**
 * Parses Sankey node bars (narrow vertical <rect> elements).
 */
export const parseSankeyNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    if (w <= 0 || h <= 0) return;

    // Sankey node bars are narrow: height clearly exceeds width.
    // Skip wide/square rects that are likely diagram backgrounds.
    if (h < w * 1.5) return;

    const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
    const bx = parseFloat(rect.getAttribute('x') || '0');
    const by = parseFloat(rect.getAttribute('y') || '0');

    const { color } = extractComputedColors(rect, { color: '#94a3b8', stroke: '#ffffff' });

    // Skip node bars that resolved to near-white — they are unresolvable CSS
    // colors that would appear as opaque white rectangles over the flow bands.
    if (getLuminance(color) > 0.85) return;

    nodes.push({
      id: nextId('sankey-node'),
      label: '',
      type: 'node',
      shape: 'rect',
      x: bx + tx + w / 2,
      y: by + ty + h / 2,
      width: w,
      height: h,
      color,
      stroke: color,
    });
  });

  return nodes;
};

/**
 * Parses Sankey flow bands (open bezier <path> elements with large stroke-width).
 *
 * For each link:
 *  - pathD          = the bezier path for particle animation + band rendering
 *  - sankeyFillPath = same as pathD (signals Sankey rendering mode in drawEdge)
 *  - sankeyGradient = [sourceColor, targetColor] resolved from the SVG linearGradient
 *  - lineWidth      = stroke-width (the band thickness)
 *  - stroke         = source color (fallback when gradient unavailable)
 */
export const parseSankeyEdges = (svgElement: SVGSVGElement): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>('path').forEach(path => {
    const rawD = path.getAttribute('d') || '';
    if (!rawD || rawD.length < 20) return;

    // Sankey links are open paths — skip closed shapes (markers, etc.)
    if (/Z/i.test(rawD)) return;

    const style = window.getComputedStyle(path);
    const strokeWidth = parseFloat(style.strokeWidth || '0');
    if (strokeWidth < 1) return;

    // The stroke value is typically url("#linearGradient-N")
    const rawStroke = (style.stroke && style.stroke !== 'none' && style.stroke !== 'rgba(0, 0, 0, 0)')
      ? style.stroke : null;
    const rawFill = (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)')
      ? style.fill : null;
    const rawColor = rawStroke || rawFill;
    if (!rawColor) return;

    const stops = resolveGradientStops(svgElement, rawColor);
    if (!stops) return;

    const [color0, color1] = stops;

    const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
    const d = applyTranslateToPathD(rawD, tx, ty);

    edges.push({
      id: nextId('sankey-link'),
      pathD: d,
      stroke: color0,           // source color as fallback
      type: 'link',
      lineWidth: strokeWidth,
      sankeyFillPath: d,        // presence triggers Sankey rendering in drawEdge
      sankeyGradient: [color0, color1],
    });
  });

  return edges;
};

// ─── Post-process Y-scaling ───────────────────────────────────────────────────

/**
 * Scales only the Y coordinates of an SVG path string (M/C/L commands).
 * X coordinates and lineWidth are left unchanged, so band widths stay the same.
 */
function scaleSankeyPathY(d: string, scaleY: number, originY: number): string {
  // Replace every coordinate pair (x y) in M, L, C commands.
  // We walk through tokens: command letters trigger x/y alternation.
  return d.replace(
    /([MLCSQTAZmlcsqtaz])|([+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)/g,
    (() => {
      let expectX = false; // next number is X?
      let cmd = '';
      return (match: string, letter: string, num: string) => {
        if (letter !== undefined) {
          cmd = letter.toUpperCase();
          // After M or L: alternating X, Y pairs
          // After C: X1,Y1, X2,Y2, X,Y triplets (same alternation)
          // For Z: no coords
          expectX = (cmd === 'M' || cmd === 'L' || cmd === 'C' || cmd === 'S' || cmd === 'Q');
          return letter;
        }
        // It's a number
        if (cmd === 'M' || cmd === 'L' || cmd === 'C' || cmd === 'S' || cmd === 'Q') {
          if (expectX) {
            expectX = false; // next is Y
            return num; // X unchanged
          } else {
            expectX = true; // next is X again
            const y = parseFloat(num);
            return String((y - originY) * scaleY + originY);
          }
        }
        return num;
      };
    })(),
  );
}

/**
 * Post-processes parsed Sankey layout to spread nodes apart vertically
 * when the diagram is dense, WITHOUT changing link band widths.
 *
 * @param nodes   parsed node bars
 * @param edges   parsed flow bands
 * @param labels  parsed text labels
 * @param minSpacingPerNode  minimum vertical pixels allocated per node (default 20)
 */
export const scaleSankeyLayout = (
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  labels: SeqLabel[],
): { nodes: DiagramNode[]; edges: DiagramEdge[]; labels: SeqLabel[] } => {
  if (nodes.length === 0) return { nodes, edges, labels };

  const ys = nodes.map(n => n.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const currentExtent = maxY - minY;
  if (currentExtent <= 0) return { nodes, edges, labels };

  // Density measure: total vertical space occupied by all bands.
  // Each band's stroke-width represents actual pixel thickness on the canvas.
  // We want the layout to be at least 1.8× the total stacked band thickness
  // (to leave breathing room between flows), and at least 60 px per node.
  const totalFlowThickness = edges.reduce((s, e) => s + (e.lineWidth ?? 4), 0);
  const targetHeight = Math.max(
    nodes.length * 60,          // minimum 60 px per node bar
    totalFlowThickness * 1.8,   // 80% headroom above total band thickness
    currentExtent,              // never shrink the layout
  );
  const scaleY = targetHeight / currentExtent;

  if (scaleY <= 1.05) return { nodes, edges, labels }; // already spread enough

  const scaledNodes = nodes.map(n => ({
    ...n,
    y: (n.y - minY) * scaleY + minY,
    // height stays the same (node bar height)
  }));

  const scaledEdges = edges.map(e => ({
    ...e,
    pathD: scaleSankeyPathY(e.pathD, scaleY, minY),
    sankeyFillPath: e.sankeyFillPath
      ? scaleSankeyPathY(e.sankeyFillPath, scaleY, minY)
      : e.sankeyFillPath,
    // lineWidth unchanged — band widths stay the same
  }));

  const scaledLabels = labels.map(l => ({
    ...l,
    y: (l.y - minY) * scaleY + minY,
  }));

  return { nodes: scaledNodes, edges: scaledEdges, labels: scaledLabels };
};

/**
 * Parses Sankey node name labels (<text> elements).
 */
export const parseSankeyLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGTextElement>('text').forEach(t => {
    const text = t.textContent?.trim();
    if (!text) return;

    try {
      const bbox = t.getBBox();
      if (bbox.height <= 0 || bbox.width <= 0) return;

      const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
      const style = window.getComputedStyle(t);
      const color = (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)')
        ? style.fill : '#1e293b';

      const anchor = (t.getAttribute('text-anchor') || style.textAnchor || 'start').toLowerCase();
      const align: CanvasTextAlign = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';

      let x = bbox.x + tx;
      if (anchor === 'middle') x += bbox.width / 2;
      else if (anchor === 'end') x += bbox.width;

      const y = bbox.y + ty + bbox.height * 0.6;

      labels.push({
        x,
        y,
        text,
        fontSize: Math.max(10, bbox.height * 0.85),
        bold: false,
        color,
        align,
      });
    } catch { /* ignore hidden / zero-size text */ }
  });

  return labels;
};
