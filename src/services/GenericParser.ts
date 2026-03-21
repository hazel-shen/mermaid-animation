/**
 * GenericParser: DFS-based fallback parser for unsupported diagram types.
 * Recursively scans all SVG elements with stroke/fill to extract edges and nodes.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';

const SKIP_TAGS = new Set(['defs', 'marker', 'symbol', 'style', 'title', 'desc', 'clippath', 'lineargradient', 'radialgradient', 'filter', 'fegaussianblur', 'feflood', 'feblend', 'fecomposite']);

const getComputedFill = (el: Element): string | null => {
  const style = window.getComputedStyle(el);
  if (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)') return style.fill;
  const attr = el.getAttribute('fill');
  if (attr && attr !== 'none') return attr;
  return null;
};

const getComputedStroke = (el: Element): string | null => {
  const style = window.getComputedStyle(el);
  if (style.stroke && style.stroke !== 'none' && style.stroke !== 'rgba(0, 0, 0, 0)') return style.stroke;
  const attr = el.getAttribute('stroke');
  if (attr && attr !== 'none') return attr;
  return null;
};

const buildPathFromLine = (el: Element, svgElement: SVGSVGElement): string => {
  const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
  const x1 = parseFloat(el.getAttribute('x1') || '0') + tx;
  const y1 = parseFloat(el.getAttribute('y1') || '0') + ty;
  const x2 = parseFloat(el.getAttribute('x2') || '0') + tx;
  const y2 = parseFloat(el.getAttribute('y2') || '0') + ty;
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

const buildPathFromPolyline = (el: Element, svgElement: SVGSVGElement): string => {
  const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
  const pts = (el.getAttribute('points') || '').trim().split(/\s+|,/).map(Number);
  if (pts.length < 4) return '';
  let d = '';
  for (let i = 0; i < pts.length - 1; i += 2) {
    d += `${i === 0 ? 'M' : 'L'} ${pts[i] + tx} ${pts[i + 1] + ty} `;
  }
  return d.trim();
};

export interface GenericParseResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export const parseGeneric = (svgElement: SVGSVGElement, isPremium: boolean): GenericParseResult => {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const seenPaths = new Set<string>();

  const dfs = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (tag === 'path') {
      const d = el.getAttribute('d') || '';
      if (d.length > 10 && !seenPaths.has(d)) {
        const stroke = getComputedStroke(el);
        const fill = getComputedFill(el);
        const hasArrow = el.getAttribute('marker-end') != null ||
          (window.getComputedStyle(el).markerEnd || '') !== 'none';

        if (stroke && !fill) {
          seenPaths.add(d);
          edges.push({
            id: `gen-edge-${Math.random()}`,
            pathD: d,
            stroke: stroke,
            type: 'link',
            hasArrow,
            noSnap: true,
          });
        }
      }
    } else if (tag === 'line') {
      const d = buildPathFromLine(el, svgElement);
      if (d && !seenPaths.has(d)) {
        const stroke = getComputedStroke(el) || (isPremium ? '#94a3b8' : '#333');
        seenPaths.add(d);
        edges.push({
          id: `gen-edge-${Math.random()}`,
          pathD: d,
          stroke,
          type: 'link',
          hasArrow: el.getAttribute('marker-end') != null ||
            (window.getComputedStyle(el).markerEnd || '') !== 'none',
          noSnap: true,
        });
      }
    } else if (tag === 'polyline') {
      const d = buildPathFromPolyline(el, svgElement);
      if (d && !seenPaths.has(d)) {
        const stroke = getComputedStroke(el) || (isPremium ? '#94a3b8' : '#333');
        seenPaths.add(d);
        edges.push({
          id: `gen-edge-${Math.random()}`,
          pathD: d,
          stroke,
          type: 'link',
          hasArrow: el.getAttribute('marker-end') != null ||
            (window.getComputedStyle(el).markerEnd || '') !== 'none',
          noSnap: true,
        });
      }
    } else if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
      const fill = getComputedFill(el);
      const stroke = getComputedStroke(el);
      if (!fill && !stroke) {
        for (let i = 0; i < el.children.length; i++) dfs(el.children[i]);
        return;
      }

      try {
        const rect = (el as SVGGraphicsElement).getBBox();
        const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
        const cx = tx + rect.x + rect.width / 2;
        const cy = ty + rect.y + rect.height / 2;
        if (rect.width > 0 && rect.height > 0 && rect.width < 2000 && rect.height < 2000) {
          const parentG = el.parentElement;
          let label = '';
          if (parentG) {
            const txt = parentG.querySelector('text');
            if (txt) label = txt.textContent?.trim() || '';
          }
          nodes.push({
            id: `gen-node-${Math.random()}`,
            label,
            type: 'node',
            shape: tag === 'circle' || tag === 'ellipse' ? 'circle' : 'roundRect',
            x: cx,
            y: cy,
            width: rect.width,
            height: rect.height,
            color: fill || 'rgba(255,255,255,0.8)',
            stroke: stroke || '#333',
          });
        }
      } catch {
        // getBBox can fail for hidden elements
      }
    }

    for (let i = 0; i < el.children.length; i++) dfs(el.children[i]);
  };

  dfs(svgElement);

  return { nodes, edges };
};
