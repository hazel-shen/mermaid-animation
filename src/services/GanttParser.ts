/**
 * GanttParser: Parses Mermaid gantt / timeline SVG output.
 *
 * Gantt charts have no traditional "lines" — the animation strategy is:
 * - Treat each task bar (rect.task) as both a node AND generate a synthetic
 *   edge along its top surface so particles flow over the bars.
 * - Grid / tick lines are captured as structural edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { lineToPathD, extractComputedColors, rectCenter, parentLabel, nextId } from '../utils/parser-base';

const BAR_CLASSES = ['task', 'taskText', 'done', 'active', 'crit'];

const isTaskRect = (el: Element): boolean => {
  return BAR_CLASSES.some(cls => el.classList.contains(cls)) || el.tagName.toLowerCase() === 'rect';
};

export const parseGanttNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    if (!isTaskRect(rect)) return;
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    if (geom.width < 5 || geom.height < 5) return;
    if (geom.width > 5000 || geom.height > 500) return;

    const { color, stroke } = extractComputedColors(rect, { color: '#60a5fa', stroke: '#2563eb' });
    const label = parentLabel(rect);

    nodes.push({
      id: nextId('gantt-bar'),
      label,
      type: 'node',
      shape: 'roundRect',
      x: geom.cx, y: geom.cy,
      width: geom.width, height: geom.height,
      color, stroke,
    });
  });

  return nodes;
};

export const parseGanttEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // Generate particle-flow paths along the top of each task bar
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    if (!isTaskRect(rect)) return;
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    if (geom.width < 20 || geom.height < 5) return;
    if (geom.width > 5000) return;

    const x1 = geom.cx - geom.width / 2;
    const x2 = geom.cx + geom.width / 2;
    const y = geom.cy - geom.height / 2 + geom.height * 0.3;

    const style = window.getComputedStyle(rect);
    const stroke = (style.fill && style.fill !== 'none') ? style.fill : '#60a5fa';

    edges.push({
      id: nextId('gantt-flow'),
      pathD: `M ${x1} ${y} L ${x2} ${y}`,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  // Grid / tick lines as structural
  svgElement.querySelectorAll<SVGLineElement>('line.tick, line.grid, line[class*="tick"]').forEach(line => {
    const d = lineToPathD(line, svgElement);
    edges.push({
      id: nextId('gantt-tick'),
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
