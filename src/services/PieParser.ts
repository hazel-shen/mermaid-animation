/**
 * PieParser: Parses Mermaid pie chart SVG output.
 *
 * Pie charts have wedge <path> elements. We treat each wedge as a node
 * and generate arc-following particle edges along the outer circumference.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';

export const parsePieNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Each pie wedge is a <path> inside a <g> with class "pieCircle" or similar
  svgElement.querySelectorAll<SVGPathElement>('path.pieCircle, path[class*="slice"], g.pie path').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d) return;

    try {
      const bbox = (path as SVGGraphicsElement).getBBox();
      const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const style = window.getComputedStyle(path);
      const color = (style.fill && style.fill !== 'none') ? style.fill : '#818cf8';
      const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : '#fff';

      // Try to get the label from sibling text
      const parentG = path.parentElement;
      let label = '';
      if (parentG) {
        const txt = parentG.querySelector<SVGTextElement>('text');
        if (txt) label = txt.textContent?.trim() || '';
      }

      if (bbox.width > 0 && bbox.height > 0) {
        nodes.push({
          id: `pie-slice-${Math.random()}`,
          label,
          type: 'node',
          shape: 'circle',
          x: cx, y: cy,
          width: bbox.width, height: bbox.height,
          color, stroke,
        });
      }
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parsePieEdges = (svgElement: SVGSVGElement): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // Use the wedge paths themselves as particle tracks
  svgElement.querySelectorAll<SVGPathElement>('path.pieCircle, path[class*="slice"], g.pie path').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (d.length < 10) return;

    const style = window.getComputedStyle(path);
    const stroke = (style.fill && style.fill !== 'none') ? style.fill : '#818cf8';

    edges.push({
      id: `pie-edge-${Math.random()}`,
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  return edges;
};
