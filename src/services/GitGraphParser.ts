/**
 * GitGraphParser: Parses Mermaid gitGraph SVG output.
 *
 * Git graphs have commit circles and branch lines.
 * Commit dots → nodes, branch/merge paths → particle edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, extractComputedColors, extractComputedStroke, rectCenter, parentLabel, nextId } from '../utils/parser-base';

export const parseGitGraphNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Commit circles
  svgElement.querySelectorAll<SVGCircleElement>('circle.commit, circle[class*="commit"]').forEach(circle => {
    const r = parseFloat(circle.getAttribute('r') || '10');
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const cx = tx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = ty + parseFloat(circle.getAttribute('cy') || '0');

    const { color, stroke } = extractComputedColors(circle, {
      color: isPremium ? '#6366f1' : '#4f46e5',
      stroke: '#312e81',
    });

    const label = parentLabel(circle);

    nodes.push({
      id: nextId('git-commit'),
      label,
      type: 'node',
      shape: 'circle',
      x: cx, y: cy,
      width: r * 2, height: r * 2,
      color, stroke,
    });
  });

  // Branch labels (rect backgrounds)
  svgElement.querySelectorAll<SVGRectElement>('rect.branchLabel, rect[class*="branchLabelContainer"]').forEach(rect => {
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;

    const style = window.getComputedStyle(rect);
    const color = (style.fill && style.fill !== 'none') ? style.fill : '#e0e7ff';
    const label = parentLabel(rect);

    nodes.push({
      id: nextId('git-branch'),
      label,
      type: 'node',
      shape: 'roundRect',
      x: geom.cx, y: geom.cy,
      width: geom.width, height: geom.height,
      color,
      stroke: '#818cf8',
    });
  });

  return nodes;
};

export const parseGitGraphEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // Branch lines and merge paths
  svgElement.querySelectorAll<SVGPathElement>('.branch-line, path.branch, path[class*="branch"], path[class*="commit"]').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d || d.length <= 5) return;

    const stroke = extractComputedStroke(path, isPremium ? '#818cf8' : '#6366f1');

    edges.push({
      id: nextId('git-edge'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  // Also grab lines connecting commits
  svgElement.querySelectorAll<SVGLineElement>('line[class*="branch"], line.commit-line').forEach(line => {
    const stroke = extractComputedStroke(line, isPremium ? '#818cf8' : '#6366f1');
    edges.push({ id: nextId('git-line'), pathD: lineToPathD(line, svgElement), stroke, type: 'link' });
  });

  return edges;
};
