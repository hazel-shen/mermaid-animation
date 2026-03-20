/**
 * MindmapParser: Parses Mermaid mindmap SVG output.
 *
 * Mindmaps have a root node and branches radiating outward.
 * The parser captures both the node shapes and the connecting paths.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';

export const parseMindmapNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Root and branch sections
  svgElement.querySelectorAll<SVGGElement>('g.mindmap-node, g[class*="mindmap"]').forEach(g => {
    const shapeEl = g.querySelector<SVGGraphicsElement>('rect, circle, ellipse, polygon');
    if (!shapeEl) return;

    try {
      const bbox = shapeEl.getBBox();
      const { x: tx, y: ty } = getCumulativeTransform(shapeEl, svgElement);
      if (bbox.width <= 0 || bbox.height <= 0) return;

      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const style = window.getComputedStyle(shapeEl);
      const color = (style.fill && style.fill !== 'none') ? style.fill : (isPremium ? '#ede9fe' : '#ddd6fe');
      const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : '#7c3aed';
      const tag = shapeEl.tagName.toLowerCase();

      let label = '';
      const txt = g.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';

      nodes.push({
        id: g.id || `mindmap-${Math.random()}`,
        label,
        type: 'node',
        shape: tag === 'circle' || tag === 'ellipse' ? 'circle' : 'roundRect',
        x: cx, y: cy,
        width: bbox.width, height: bbox.height,
        color, stroke,
      });
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parseMindmapEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>('path.edge, path[class*="mindmap"], path.mindmap-edge').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d || d.length <= 5) return;

    const style = window.getComputedStyle(path);
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#a78bfa' : '#7c3aed');

    edges.push({
      id: `mindmap-edge-${Math.random()}`,
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  // Generic lines as fallback
  svgElement.querySelectorAll<SVGLineElement>('line').forEach(line => {
    const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
    const x1 = parseFloat(line.getAttribute('x1') || '0') + tx;
    const y1 = parseFloat(line.getAttribute('y1') || '0') + ty;
    const x2 = parseFloat(line.getAttribute('x2') || '0') + tx;
    const y2 = parseFloat(line.getAttribute('y2') || '0') + ty;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 10) return;
    const style = window.getComputedStyle(line);
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#a78bfa' : '#7c3aed');
    edges.push({ id: `mindmap-line-${Math.random()}`, pathD: `M ${x1} ${y1} L ${x2} ${y2}`, stroke, type: 'link' });
  });

  return edges;
};
