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
import { nextId, applyTranslateToPathD } from '../utils/parser-base';
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
/**
 * Resolves a node bar's fill color, with multiple fallback strategies:
 * 1. Computed fill from CSS (most reliable when CSS vars are resolved)
 * 2. Inline `fill` attribute on the element
 * 3. Inline `style` attribute parsed for fill
 * 4. `fill` on the parent <g> element
 * Returns null if all strategies fail or color is near-white/transparent.
 */
function resolveNodeFill(rect: SVGRectElement): string | null {
  const style = window.getComputedStyle(rect);
  const computedFill = style.fill;

  const isUsable = (c: string | null | undefined): c is string =>
    !!c && c !== 'none' && c !== 'rgba(0, 0, 0, 0)' && getLuminance(c) <= 0.92;

  // Strategy 1: computed style fill
  if (isUsable(computedFill)) return computedFill;

  // Strategy 2: fill attribute directly on rect
  const fillAttr = rect.getAttribute('fill');
  if (isUsable(fillAttr)) return fillAttr;

  // Strategy 3: parse inline style attribute
  const styleAttr = rect.getAttribute('style') || '';
  const styleMatch = styleAttr.match(/fill\s*:\s*([^;]+)/i);
  if (styleMatch) {
    const val = styleMatch[1].trim();
    if (isUsable(val)) return val;
  }

  // Strategy 4: fill attribute on the parent <g>
  const parentFill = rect.parentElement?.getAttribute('fill');
  if (isUsable(parentFill)) return parentFill;

  return null;
}

export const parseSankeyNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    if (w <= 0 || h <= 0) return;

    // Mermaid sankey node bars are always narrow (width ≤ 15px).
    // Skip wide rects that are diagram backgrounds or other shapes.
    if (w > 15) return;

    const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
    const bx = parseFloat(rect.getAttribute('x') || '0');
    const by = parseFloat(rect.getAttribute('y') || '0');

    const resolvedFill = resolveNodeFill(rect);

    // If fill is still unresolvable, collect the node with a sentinel color.
    // parseSankeyEdges will later derive the correct color from flow bands.
    const color = resolvedFill ?? '__unresolved__';

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

// ─── Post-process: infer node colors from flow band gradients ────────────────

/**
 * Extracts source and target X coordinates from a Mermaid sankey band path.
 *
 * A sankey band is an open path shaped like a ribbon:
 *   M sx topY  C ... C  tx topY    ← top edge: source right → target left
 *   C ... C    tx botY             ← vertical drop at target
 *   C ... C    sx botY             ← bottom edge: target left → source right (reversed)
 *
 * So the path starts at the source node's RIGHT edge (sx) and the midpoint of
 * all coordinates is the target node's LEFT edge (tx).  The final coordinates
 * land back at the source — pathEndX would wrongly return sx.
 *
 * Strategy: tokenise the path, collect all X values (every first number in each
 * M/C/L coordinate pair), then split at the median X.  Coordinates below the
 * median belong to the source side; coordinates above belong to the target side.
 * The minimum X among all tokens = source right edge; the maximum X = target left edge.
 */
function parseSankeyBandX(d: string): { sourceX: number; targetX: number } {
  const tokens = d.match(/[MmLlCcSsQqTtAaHhVvZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!tokens) return { sourceX: NaN, targetX: NaN };

  const xValues: number[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) { i++; continue; }
    xValues.push(parseFloat(t));
    i += 2; // skip paired Y
  }

  if (xValues.length === 0) return { sourceX: NaN, targetX: NaN };

  // Source right edge = leftmost X cluster; target left edge = rightmost X cluster.
  // Use min/max — the band starts and ends at source X, but the middle visits target X.
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  return { sourceX: minX, targetX: maxX };
}

/**
 * For any node whose color is `'__unresolved__'`, infers the color from the
 * flow bands (edges) that connect to it.
 *
 * Each band's `pathD` spans from the source node's RIGHT edge (sourceX)
 * to the target node's LEFT edge (targetX).
 * `sankeyGradient[0]` = source color, `sankeyGradient[1]` = target color.
 *
 * We build a map of nodeCenterX → color, keyed by the node's center X,
 * by matching sourceX ≈ node.x + node.width/2 and targetX ≈ node.x - node.width/2.
 */
export const inferSankeyNodeColors = (
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): DiagramNode[] => {
  const TOLERANCE = 30; // px

  // xColor: maps node center X → inferred color
  const xColor = new Map<number, string>();

  for (const edge of edges) {
    const grad = edge.sankeyGradient;
    if (!grad) continue;
    const [c0, c1] = grad;
    const { sourceX, targetX } = parseSankeyBandX(edge.pathD);

    for (const node of nodes) {
      const rightEdge = node.x + node.width / 2;
      const leftEdge  = node.x - node.width / 2;

      if (!isNaN(sourceX) && Math.abs(rightEdge - sourceX) < TOLERANCE) {
        if (!xColor.has(node.x)) xColor.set(node.x, c0);
      }
      if (!isNaN(targetX) && Math.abs(leftEdge - targetX) < TOLERANCE) {
        if (!xColor.has(node.x)) xColor.set(node.x, c1);
      }
    }
  }

  return nodes.map(node => {
    if (node.color !== '__unresolved__') return node;
    const inferred = xColor.get(node.x);
    return { ...node, color: inferred ?? '#94a3b8', stroke: inferred ?? '#94a3b8' };
  });
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
      return (_match: string, letter: string, num: string) => {
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
