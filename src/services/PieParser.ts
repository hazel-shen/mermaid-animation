/**
 * PieParser: Parses Mermaid pie chart SVG output.
 *
 * Pie charts have wedge <path> elements. We treat each wedge as a node
 * and generate arc-following particle edges along the outer circumference.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { extractComputedColors, rectCenter, parentLabel, nextId } from '../utils/parser-base';

export const parsePieNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Each pie wedge is a <path> inside a <g> with class "pieCircle" or similar
  svgElement.querySelectorAll<SVGPathElement>('path.pieCircle, path[class*="slice"], g.pie path').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d) return;

    const geom = rectCenter(path as SVGGraphicsElement, svgElement);
    if (!geom) return;

    const { color, stroke } = extractComputedColors(path, { color: '#818cf8', stroke: '#fff' });
    const label = parentLabel(path);

    nodes.push({
      id: nextId('pie-slice'),
      label,
      type: 'node',
      shape: 'circle',
      x: geom.cx, y: geom.cy,
      width: geom.width, height: geom.height,
      color, stroke,
    });
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
      id: nextId('pie-edge'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  return edges;
};
