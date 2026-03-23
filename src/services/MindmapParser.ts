/**
 * MindmapParser: Parses Mermaid mindmap SVG output.
 *
 * Mindmaps have a root node and branches radiating outward.
 * The parser captures both the node shapes and the connecting paths.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { lineToPathD, extractComputedColors, extractComputedStroke, rectCenter, nextId } from '../utils/parser-base';

export const parseMindmapNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Root and branch sections
  svgElement.querySelectorAll<SVGGElement>('g.mindmap-node, g[class*="mindmap"]').forEach(g => {
    const shapeEl = g.querySelector<SVGGraphicsElement>('rect, circle, ellipse, polygon');
    if (!shapeEl) return;

    const geom = rectCenter(shapeEl, svgElement);
    if (!geom) return;

    const { color, stroke } = extractComputedColors(shapeEl, {
      color: isPremium ? '#ede9fe' : '#ddd6fe',
      stroke: '#7c3aed',
    });
    const tag = shapeEl.tagName.toLowerCase();

    let label = '';
    const txt = g.querySelector<SVGTextElement>('text');
    if (txt) label = txt.textContent?.trim() || '';

    nodes.push({
      id: g.id || nextId('mindmap'),
      label,
      type: 'node',
      shape: tag === 'circle' || tag === 'ellipse' ? 'circle' : 'roundRect',
      x: geom.cx, y: geom.cy,
      width: geom.width, height: geom.height,
      color, stroke,
    });
  });

  return nodes;
};

export const parseMindmapEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGPathElement>('path.edge, path[class*="mindmap"], path.mindmap-edge').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d || d.length <= 5) return;

    const stroke = extractComputedStroke(path, isPremium ? '#a78bfa' : '#7c3aed');

    edges.push({
      id: nextId('mindmap-edge'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  // Generic lines as fallback
  svgElement.querySelectorAll<SVGLineElement>('line').forEach(line => {
    // Length check uses raw attributes — translation does not change line length.
    const rawX1 = parseFloat(line.getAttribute('x1') || '0');
    const rawY1 = parseFloat(line.getAttribute('y1') || '0');
    const rawX2 = parseFloat(line.getAttribute('x2') || '0');
    const rawY2 = parseFloat(line.getAttribute('y2') || '0');
    if (Math.hypot(rawX2 - rawX1, rawY2 - rawY1) < 10) return;
    const stroke = extractComputedStroke(line, isPremium ? '#a78bfa' : '#7c3aed');
    edges.push({ id: nextId('mindmap-line'), pathD: lineToPathD(line, svgElement), stroke, type: 'link' });
  });

  return edges;
};
