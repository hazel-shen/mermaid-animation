/**
 * GanttParser: Parses Mermaid gantt / timeline SVG output.
 *
 * Gantt charts have no traditional "lines" — the animation strategy is:
 * - Treat each task bar (rect.task) as both a node AND generate a synthetic
 *   edge along its top surface so particles flow over the bars.
 * - Grid / tick lines are captured as structural edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, extractComputedColors } from '../utils/parser-base';

const BAR_CLASSES = ['task', 'taskText', 'done', 'active', 'crit'];

const isTaskRect = (el: Element): boolean => {
  return BAR_CLASSES.some(cls => el.classList.contains(cls)) || el.tagName.toLowerCase() === 'rect';
};

export const parseGanttNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    if (!isTaskRect(rect)) return;
    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width < 5 || bbox.height < 5) return;
      if (bbox.width > 5000 || bbox.height > 500) return;

      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const { color, stroke } = extractComputedColors(rect, { color: '#60a5fa', stroke: '#2563eb' });

      // Try to find adjacent text label
      const parentG = rect.parentElement;
      let label = '';
      if (parentG) {
        const txt = parentG.querySelector<SVGTextElement>('text');
        if (txt) label = txt.textContent?.trim() || '';
      }

      nodes.push({
        id: `gantt-bar-${Math.random()}`,
        label,
        type: 'node',
        shape: 'roundRect',
        x: cx, y: cy,
        width: bbox.width, height: bbox.height,
        color, stroke,
      });
    } catch { /* getBBox can fail */ }
  });

  return nodes;
};

export const parseGanttEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // Generate particle-flow paths along the top of each task bar
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    if (!isTaskRect(rect)) return;
    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width < 20 || bbox.height < 5) return;
      if (bbox.width > 5000) return;

      const x1 = tx + bbox.x;
      const x2 = tx + bbox.x + bbox.width;
      const y = ty + bbox.y + bbox.height * 0.3;

      const style = window.getComputedStyle(rect);
      const stroke = (style.fill && style.fill !== 'none') ? style.fill : '#60a5fa';

      edges.push({
        id: `gantt-flow-${Math.random()}`,
        pathD: `M ${x1} ${y} L ${x2} ${y}`,
        stroke,
        type: 'link',
        hasArrow: false,
      });
    } catch { /* getBBox can fail */ }
  });

  // Grid / tick lines as structural
  svgElement.querySelectorAll<SVGLineElement>('line.tick, line.grid, line[class*="tick"]').forEach(line => {
    const d = lineToPathD(line, svgElement);
    edges.push({
      id: `gantt-tick-${Math.random()}`,
      pathD: d,
      stroke: isPremium ? '#e2e8f0' : '#ddd',
      type: 'structural',
    });
  });

  return edges;
};

// Timeline uses a similar bar-based structure
export const parseTimelineNodes = parseGanttNodes;
export const parseTimelineEdges = parseGanttEdges;
