/**
 * GenericParser: DFS-based fallback parser for unsupported diagram types.
 * Recursively scans all SVG elements with stroke/fill to extract edges and nodes.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, computedFill, computedStroke, rectCenter, parentLabel, nextId } from '../utils/parser-base';

const SKIP_TAGS = new Set(['defs', 'marker', 'symbol', 'style', 'title', 'desc', 'clippath', 'lineargradient', 'radialgradient', 'filter', 'fegaussianblur', 'feflood', 'feblend', 'fecomposite']);


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
        const stroke = computedStroke(el);
        const fill = computedFill(el);
        const hasArrow = el.getAttribute('marker-end') != null ||
          (window.getComputedStyle(el).markerEnd || '') !== 'none';

        if (stroke && !fill) {
          seenPaths.add(d);
          edges.push({
            id: nextId('gen-edge'),
            pathD: d,
            stroke: stroke,
            type: 'link',
            hasArrow,
            noSnap: true,
          });
        }
      }
    } else if (tag === 'line') {
      const d = lineToPathD(el, svgElement);
      if (d && !seenPaths.has(d)) {
        const stroke = computedStroke(el) || (isPremium ? '#94a3b8' : '#333');
        seenPaths.add(d);
        edges.push({
          id: nextId('gen-edge'),
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
        const stroke = computedStroke(el) || (isPremium ? '#94a3b8' : '#333');
        seenPaths.add(d);
        edges.push({
          id: nextId('gen-edge'),
          pathD: d,
          stroke,
          type: 'link',
          hasArrow: el.getAttribute('marker-end') != null ||
            (window.getComputedStyle(el).markerEnd || '') !== 'none',
          noSnap: true,
        });
      }
    } else if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
      const fill = computedFill(el);
      const stroke = computedStroke(el);
      if (!fill && !stroke) {
        for (let i = 0; i < el.children.length; i++) dfs(el.children[i]);
        return;
      }

      const geom = rectCenter(el as SVGGraphicsElement, svgElement);
      if (geom && geom.width < 2000 && geom.height < 2000) {
        nodes.push({
          id: nextId('gen-node'),
          label: parentLabel(el),
          type: 'node',
          shape: tag === 'circle' || tag === 'ellipse' ? 'circle' : 'roundRect',
          x: geom.cx,
          y: geom.cy,
          width: geom.width,
          height: geom.height,
          color: fill || 'rgba(255,255,255,0.8)',
          stroke: stroke || '#333',
        });
      }
    }

    for (let i = 0; i < el.children.length; i++) dfs(el.children[i]);
  };

  dfs(svgElement);

  return { nodes, edges };
};
