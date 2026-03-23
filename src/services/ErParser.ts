/**
 * ErParser: Parses Mermaid ER diagram SVG output.
 *
 * ER diagrams have entity boxes and relation paths connecting them.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { extractComputedColors, extractComputedStroke } from '../utils/parser-base';

export const parseErNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Entity groups
  svgElement.querySelectorAll<SVGGElement>('g.er.entityBox, g[class*="entity"]').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;

    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width <= 0 || bbox.height <= 0) return;

      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const { color, stroke } = extractComputedColors(rect, {
        color: isPremium ? '#f0fdf4' : '#dcfce7',
        stroke: '#16a34a',
      });

      let label = '';
      const txt = g.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';

      const nodeId = g.id || `er-entity-${Math.random()}`;
      if (!nodes.some(n => n.id === nodeId)) {
        nodes.push({ id: nodeId, label, type: 'node', shape: 'rect', x: cx, y: cy, width: bbox.width, height: bbox.height, color, stroke });
      }
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parseErEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>('.er.relationshipLine, path[class*="relationship"], path.er').forEach(el => {
    const d = el.getAttribute('d') || '';
    if (!d || d.length <= 10) return;

    const stroke = extractComputedStroke(el, isPremium ? '#94a3b8' : '#333');

    edges.push({
      id: `er-edge-${Math.random()}`,
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: el.getAttribute('marker-end') != null,
      noSnap: true,
    });
  });

  return edges;
};
