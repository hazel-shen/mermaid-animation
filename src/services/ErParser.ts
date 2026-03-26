/**
 * ErParser: Parses Mermaid ER diagram SVG output.
 *
 * v10: entity boxes are g.er.entityBox with rect inside
 * v11: entity nodes are g.node[id^="entity-"] with path-based geometry (no rect)
 *      edges are path.relationshipLine inside g.edgePaths
 */
import type { DiagramNode, DiagramEdge, SeqLabel, ClassLine, ArrowMarker } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { extractComputedColors, extractComputedStroke, rectCenter, nextId } from '../utils/parser-base';

export const parseErNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];
  const seen = new Set<string>();

  // ── v11: g.node[id^="entity-"] with path-based geometry ──────────────────
  svgElement.querySelectorAll<SVGGElement>('g.node[id^="entity-"]').forEach(g => {
    const nodeId = g.id;
    if (seen.has(nodeId)) return;

    // Outline geometry: try anonymous child <g> + path first (entity with attributes),
    // then fall back to a direct <rect> (entity with no attributes, Mermaid v11).
    const anonG = g.querySelector<SVGGElement>(':scope > g:not([class]):not([id])');
    const outlinePath = anonG?.querySelector<SVGPathElement>('path')
      ?? g.querySelector<SVGPathElement>(':scope > path, :scope > g path');
    const directRect = !outlinePath
      ? g.querySelector<SVGRectElement>(':scope > rect')
      : null;

    let width: number, height: number;
    if (outlinePath) {
      const pathD = outlinePath.getAttribute('d') || '';
      const mMatch = pathD.match(/^M\s*([-\d.e+]+)\s+([-\d.e+]+)/);
      if (mMatch) {
        width  = Math.abs(parseFloat(mMatch[1])) * 2;
        height = Math.abs(parseFloat(mMatch[2])) * 2;
      } else {
        try {
          const bb = (outlinePath as SVGGraphicsElement).getBBox();
          width = bb.width; height = bb.height;
        } catch { return; }
      }
    } else if (directRect) {
      width  = parseFloat(directRect.getAttribute('width')  || '0');
      height = parseFloat(directRect.getAttribute('height') || '0');
    } else {
      return;
    }
    if (width <= 0 || height <= 0) return;

    const transform = getCumulativeTransform(g, svgElement);
    let cx = transform.x;
    let cy = transform.y;
    // For rect-based entities, getCumulativeTransform gives the g origin (top-left of rect),
    // so offset by half the rect dimensions to get the centre.
    if (directRect) {
      const rx = parseFloat(directRect.getAttribute('x') || '0');
      const ry = parseFloat(directRect.getAttribute('y') || '0');
      cx += rx + width / 2;
      cy += ry + height / 2;
    }

    const styleEl = outlinePath ?? directRect;
    const pathStyle = styleEl ? window.getComputedStyle(styleEl) : null;
    const color = (pathStyle?.fill && pathStyle.fill !== 'none' && pathStyle.fill !== 'rgb(0, 0, 0)')
      ? pathStyle.fill : (isPremium ? '#f0fdf4' : '#dcfce7');
    const stroke = (pathStyle?.stroke && pathStyle.stroke !== 'none')
      ? pathStyle.stroke : '#0c26e9';

    // Entity name
    const nameFo = g.querySelector<SVGForeignObjectElement>('g.label.name foreignObject, g[class*="label name"] foreignObject');
    const label = nameFo?.textContent?.trim() || nodeId.replace(/^entity-/, '').replace(/-\d+$/, '');

    // Attributes: each row has attribute-type, attribute-name, attribute-keys, attribute-comment
    const getTexts = (sel: string) =>
      Array.from(g.querySelectorAll<SVGForeignObjectElement>(`g.${sel} foreignObject, g[class*="${sel}"] foreignObject`))
        .map(fo => fo.textContent?.trim() || '');
    const types    = getTexts('attribute-type');
    const names    = getTexts('attribute-name');
    const keys     = getTexts('attribute-keys');

    const classLines: ClassLine[] = [{ text: label, bold: true }, { text: '', divider: true }];
    types.forEach((type, i) => {
      classLines.push({ erAttr: { type, name: names[i] || '', key: keys[i] || '' } });
    });

    seen.add(nodeId);
    nodes.push({ id: nodeId, label, type: 'node', shape: 'rect', x: cx, y: cy, width, height, color, stroke, classLines });
  });

  // ── v10 fallback: g.er.entityBox with rect ────────────────────────────────
  if (nodes.length === 0) {
    svgElement.querySelectorAll<SVGGElement>('g.er.entityBox, g[class*="entity"]').forEach(g => {
      const rect = g.querySelector<SVGRectElement>('rect');
      if (!rect) return;

      const geom = rectCenter(rect, svgElement);
      if (!geom) return;

      const { color, stroke } = extractComputedColors(rect, {
        color: isPremium ? '#f0fdf4' : '#dcfce7',
        stroke: '#0c26e9',
      });

      let label = '';
      const txt = g.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';

      const nodeId = g.id || nextId('er-entity');
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        nodes.push({ id: nodeId, label, type: 'node', shape: 'rect', x: geom.cx, y: geom.cy, width: geom.width, height: geom.height, color, stroke });
      }
    });
  }

  return nodes;
};

/** Map a Mermaid ER marker-end/start URL to an ArrowMarker type. */
const erMarkerToType = (attr: string | null): ArrowMarker => {
  if (!attr) return 'none';
  // v11: camelCase  url(#mermaid-hidden-N_er-zeroOrMoreEnd)
  // v10: UPPER_CASE url(#ZERO_OR_MORE_END)
  const lower = attr.toLowerCase();
  if (lower.includes('zeroormore') || lower.includes('zero_or_more') || lower.includes('zero-or-more')) return 'erZeroOrMany';
  if (lower.includes('oneormore')  || lower.includes('one_or_more')  || lower.includes('one-or-more'))  return 'erMany';
  if (lower.includes('zeroorone')  || lower.includes('zero_or_one')  || lower.includes('zero-or-one'))  return 'erZeroOrOne';
  if (lower.includes('onlyone')    || lower.includes('only_one')     || lower.includes('only-one'))      return 'erOne';
  if (attr.includes('url(')) return 'erOne';
  return 'none';
};

/** Find the node whose bounding box contains or is closest to (px, py). */
const nearestNode = (px: number, py: number, nodes: DiagramNode[]): DiagramNode | undefined =>
  nodes.reduce<{ node?: DiagramNode; dist: number }>(
    (best, n) => {
      // Use distance to node centre — path endpoints near a border are still
      // closer to their own node's centre than to any other node's centre.
      const d = Math.hypot(n.x - px, n.y - py);
      return d < best.dist ? { node: n, dist: d } : best;
    },
    { dist: Infinity },
  ).node;

export const parseErEdges = (svgElement: SVGSVGElement, isPremium: boolean, nodes: DiagramNode[] = []): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>(
    'path.relationshipLine, .er.relationshipLine, path[class*="relationship"], path.er'
  ).forEach(el => {
    const d = el.getAttribute('d') || '';
    if (!d || d.length <= 10) return;

    const stroke = extractComputedStroke(el, isPremium ? '#94a3b8' : '#333');

    const arrowEnd   = erMarkerToType(el.getAttribute('marker-end'));
    const arrowStart = erMarkerToType(el.getAttribute('marker-start'));

    // Resolve node ids so drawEdge can snap markers exactly to the box border.
    // ER paths already terminate near the border but may be off by a few pixels
    // on diagonal edges (Mermaid reserves space for its own SVG markers).
    // markerSetback for all er* markers is 0, so only tipEnd/tipStart positions
    // are adjusted — the path itself is never modified.
    let toNodeId: string | undefined;
    let fromNodeId: string | undefined;
    if (nodes.length > 0) {
      const segs = d.trim().match(/[MLCQTSAZ][^MLCQTSAZ]*/gi) || [];
      const firstNums = (segs[0] || '').slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      const lastSeg   = segs[segs.length - 1] || '';
      const lastNums  = lastSeg.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (firstNums.length >= 2)
        fromNodeId = nearestNode(firstNums[0], firstNums[1], nodes)?.id;
      if (lastNums.length >= 2)
        toNodeId = nearestNode(lastNums[lastNums.length - 2], lastNums[lastNums.length - 1], nodes)?.id;
    }

    edges.push({
      id: nextId('er-edge'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: arrowEnd !== 'none' || arrowStart !== 'none',
      arrowEnd:   arrowEnd   !== 'none' ? arrowEnd   : undefined,
      arrowStart: arrowStart !== 'none' ? arrowStart : undefined,
      toNodeId,
      fromNodeId,
    });
  });

  return edges;
};

export const parseErEdgeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.edgeLabel').forEach(g => {
    const text = g.querySelector('foreignObject')?.textContent?.trim() || '';
    if (!text) return;
    try {
      const bbox = (g as SVGGraphicsElement).getBBox();
      const ctm  = (g as SVGGraphicsElement).getCTM();
      const svgCtm = svgElement.getCTM();
      if (!ctm || !svgCtm) return;
      const m = svgCtm.inverse().multiply(ctm);
      const cx = m.a * (bbox.x + bbox.width  / 2) + m.c * (bbox.y + bbox.height / 2) + m.e;
      const cy = m.b * (bbox.x + bbox.width  / 2) + m.d * (bbox.y + bbox.height / 2) + m.f;
      labels.push({ x: cx, y: cy, text, fontSize: 12, bold: false, color: '#374151', align: 'center', bgColor: '#ffffff' });
    } catch { /* skip */ }
  });

  return labels;
};
