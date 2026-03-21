/**
 * StateParser: Parses Mermaid stateDiagram SVG output.
 * State diagrams use .state rect/circle for nodes and .transition path for edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';

export const parseStateNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Regular state boxes
  svgElement.querySelectorAll<SVGGElement>('g.stateGroup, g.state').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;

    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width <= 0 || bbox.height <= 0) return;

      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const style = window.getComputedStyle(rect);
      const color = (style.fill && style.fill !== 'none') ? style.fill : (isPremium ? '#eff6ff' : '#dbeafe');
      const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#3b82f6' : '#2563eb');

      let label = '';
      const txt = g.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';

      const nodeId = g.id || `state-${Math.random()}`;
      if (!nodes.some(n => n.id === nodeId)) {
        nodes.push({ id: nodeId, label, type: 'node', shape: 'roundRect', x: cx, y: cy, width: bbox.width, height: bbox.height, color, stroke });
      }
    } catch { /* getBBox can fail */ }
  });

  // Start/end circles (filled circles)
  svgElement.querySelectorAll<SVGCircleElement>('circle.start, circle.end, circle[class*="start"], circle[class*="end"]').forEach(circle => {
    const r = parseFloat(circle.getAttribute('r') || '10');
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const cx = tx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = ty + parseFloat(circle.getAttribute('cy') || '0');
    const isEnd = circle.classList.contains('end');
    nodes.push({
      id: `state-terminal-${Math.random()}`,
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
    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width <= 0 || bbox.height <= 0) return;
      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;
      nodes.push({
        id: `state-cluster-${Math.random()}`,
        label: '',
        type: 'cluster',
        shape: 'rect',
        x: cx, y: cy, width: bbox.width, height: bbox.height,
        color: 'rgba(219,234,254,0.2)',
        stroke: '#3b82f6',
      });
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parseStateEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  const processPath = (el: Element) => {
    const d = el.getAttribute('d') || '';
    if (!d || d.length <= 10) return;
    const style = window.getComputedStyle(el);
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#94a3b8' : '#333');
    const dashArr = style.strokeDasharray;
    const dash = (dashArr && dashArr !== 'none')
      ? dashArr.split(',').map(n => parseFloat(n)).filter(v => v > 0)
      : undefined;

    edges.push({
      id: `state-edge-${Math.random()}`,
      pathD: d,
      stroke,
      type: 'link',
      dash: dash?.length ? dash : undefined,
      hasArrow: el.getAttribute('marker-end') != null,
      noSnap: true,
    });
  };

  svgElement.querySelectorAll('.transition path, .edgePath path, path.transition').forEach(processPath);

  return edges;
};
