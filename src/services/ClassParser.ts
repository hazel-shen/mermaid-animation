/**
 * ClassParser: Parses Mermaid class diagram SVG output.
 * Class diagrams use .classGroup for nodes and .relation path for edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';

export const parseClassNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.classGroup, g.cluster').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;

    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;
      if (bbox.width <= 0 || bbox.height <= 0) return;

      const style = window.getComputedStyle(rect);
      const color = (style.fill && style.fill !== 'none') ? style.fill : (isPremium ? '#f8fafc' : '#fff');
      const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#94a3b8' : '#333');

      // Class name is in the first text element
      let label = '';
      const texts = g.querySelectorAll<SVGTextElement>('text');
      if (texts.length > 0) label = texts[0].textContent?.trim() || '';

      const nodeId = g.id || `class-${Math.random()}`;
      if (!nodes.some(n => n.id === nodeId)) {
        nodes.push({ id: nodeId, label, type: 'node', shape: 'rect', x: cx, y: cy, width: bbox.width, height: bbox.height, color, stroke });
      }
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parseClassEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>('.relation, path.relation, line.relation').forEach(el => {
    const tag = el.tagName.toLowerCase();
    let d = '';
    const style = window.getComputedStyle(el);
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#94a3b8' : '#333');

    if (tag === 'path') {
      d = el.getAttribute('d') || '';
    } else if (tag === 'line') {
      const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
      const x1 = parseFloat(el.getAttribute('x1') || '0') + tx;
      const y1 = parseFloat(el.getAttribute('y1') || '0') + ty;
      const x2 = parseFloat(el.getAttribute('x2') || '0') + tx;
      const y2 = parseFloat(el.getAttribute('y2') || '0') + ty;
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (d && d.length > 10) {
      edges.push({
        id: `class-edge-${Math.random()}`,
        pathD: d,
        stroke,
        type: 'link',
        hasArrow: el.getAttribute('marker-end') != null,
      });
    }
  });

  // Also capture edgePath elements (mermaid v10 class diagrams)
  svgElement.querySelectorAll<SVGPathElement>('.edgePath path, path.edge-thickness-normal').forEach(el => {
    const d = el.getAttribute('d') || '';
    if (d && d.length > 10) {
      const style = window.getComputedStyle(el);
      const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#94a3b8' : '#333');
      edges.push({
        id: `class-edge-${Math.random()}`,
        pathD: d,
        stroke,
        type: 'link',
        hasArrow: el.getAttribute('marker-end') != null,
      });
    }
  });

  return edges;
};
