/**
 * GitGraphParser: Parses Mermaid gitGraph SVG output.
 *
 * Git graphs have commit circles and branch lines.
 * Commit dots → nodes, branch/merge paths → particle edges.
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, extractComputedColors, extractComputedStroke } from '../utils/parser-base';

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

    // Try to get commit label
    let label = '';
    const parentG = circle.parentElement;
    if (parentG) {
      const txt = parentG.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';
    }

    nodes.push({
      id: `git-commit-${Math.random()}`,
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
    try {
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      const bbox = rect.getBBox();
      if (bbox.width <= 0 || bbox.height <= 0) return;

      const cx = tx + bbox.x + bbox.width / 2;
      const cy = ty + bbox.y + bbox.height / 2;

      const style = window.getComputedStyle(rect);
      const color = (style.fill && style.fill !== 'none') ? style.fill : '#e0e7ff';

      let label = '';
      const parentG = rect.parentElement;
      if (parentG) {
        const txt = parentG.querySelector<SVGTextElement>('text');
        if (txt) label = txt.textContent?.trim() || '';
      }

      nodes.push({
        id: `git-branch-${Math.random()}`,
        label,
        type: 'node',
        shape: 'roundRect',
        x: cx, y: cy,
        width: bbox.width, height: bbox.height,
        color,
        stroke: '#818cf8',
      });
    } catch { /* getBBox can fail */ }
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
      id: `git-edge-${Math.random()}`,
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  // Also grab lines connecting commits
  svgElement.querySelectorAll<SVGLineElement>('line[class*="branch"], line.commit-line').forEach(line => {
    const stroke = extractComputedStroke(line, isPremium ? '#818cf8' : '#6366f1');
    edges.push({ id: `git-line-${Math.random()}`, pathD: lineToPathD(line, svgElement), stroke, type: 'link' });
  });

  return edges;
};
