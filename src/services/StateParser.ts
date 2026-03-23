/**
 * StateParser: Parses Mermaid stateDiagram SVG output.
 * State diagrams use .state rect/circle for nodes and .transition path for edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { extractComputedColors, rectCenter, parentLabel, extractEdgeStyle, nextId } from '../utils/parser-base';

export const parseStateNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Regular state boxes
  svgElement.querySelectorAll<SVGGElement>('g.stateGroup, g.state').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;

    const geom = rectCenter(rect, svgElement);
    if (!geom) return;

    const { color, stroke } = extractComputedColors(rect, {
      color: isPremium ? '#eff6ff' : '#dbeafe',
      stroke: isPremium ? '#3b82f6' : '#2563eb',
    });

    const label = parentLabel(rect);
    const nodeId = g.id || nextId('state');
    if (!nodes.some(n => n.id === nodeId)) {
      nodes.push({ id: nodeId, label, type: 'node', shape: 'roundRect', x: geom.cx, y: geom.cy, width: geom.width, height: geom.height, color, stroke });
    }
  });

  // Start/end circles (filled circles)
  svgElement.querySelectorAll<SVGCircleElement>('circle.start, circle.end, circle[class*="start"], circle[class*="end"]').forEach(circle => {
    const r = parseFloat(circle.getAttribute('r') || '10');
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const cx = tx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = ty + parseFloat(circle.getAttribute('cy') || '0');
    const isEnd = circle.classList.contains('end');
    nodes.push({
      id: nextId('state-terminal'),
      label: isEnd ? 'End' : 'Start',
      type: 'node',
      shape: 'circle',
      x: cx, y: cy, width: r * 2, height: r * 2,
      color: isEnd ? '#1e293b' : '#334155',
      stroke: '#0f172a',
    });
  });

  // Cluster / subState containers
  svgElement.querySelectorAll<SVGGElement>('g.cluster, g.compositeState').forEach(g => {
    const rect = g.querySelector<SVGRectElement>(':scope > rect');
    if (!rect) return;
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    nodes.push({
      id: nextId('state-cluster'),
      label: '',
      type: 'cluster',
      shape: 'rect',
      x: geom.cx, y: geom.cy, width: geom.width, height: geom.height,
      color: 'rgba(219,234,254,0.2)',
      stroke: '#3b82f6',
    });
  });

  return nodes;
};

export const parseStateEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  const processPath = (el: Element) => {
    const d = el.getAttribute('d') || '';
    if (!d || d.length <= 10) return;
    const { stroke, dash } = extractEdgeStyle(el, isPremium);

    edges.push({
      id: nextId('state-edge'),
      pathD: d,
      stroke,
      type: 'link',
      dash,
      hasArrow: el.getAttribute('marker-end') != null,
      noSnap: true,
    });
  };

  svgElement.querySelectorAll('.transition path, .edgePath path, path.transition').forEach(processPath);

  return edges;
};
