/**
 * GitGraphParser: Parses Mermaid gitGraph SVG output into DiagramNodes and DiagramEdges.
 *
 * Actual Mermaid v11 gitGraph SVG structure (confirmed via inspection):
 *
 *   <svg>
 *     <style />
 *     <g>                                    <!-- root wrapper with translate -->
 *       <g>                                  <!-- branches group (unnamed) -->
 *         <line class="branch branch0" />    <!-- dashed branch lifeline -->
 *         <rect class="branchLabelBkg label0" />
 *         <g class="branchLabel">
 *           <g class="label branch-label0">
 *             <text>main</text>
 *           </g>
 *         </g>
 *         <line class="branch branch1" />
 *         <rect class="branchLabelBkg label1" />
 *         <g class="branchLabel">
 *           <g class="label branch-label1">
 *             <text>feat</text>
 *           </g>
 *         </g>
 *       </g>
 *       <g class="commit-arrows">
 *         <path class="arrow arrow1" />      <!-- connector between commits -->
 *       </g>
 *       <g class="commit-bullets">
 *         <circle class="commit A commit0" />          <!-- regular commit -->
 *         <circle class="commit C commit0" />          <!-- merge: outer ring -->
 *         <circle class="commit commit-merge C commit0" /> <!-- merge: inner -->
 *       </g>
 *       <g class="commit-labels">
 *         <g>
 *           <rect class="commit-label-bkg" />
 *           <text class="commit-label">A</text>
 *         </g>
 *       </g>
 *     </g>
 *   </svg>
 *
 * Branch colors: commit circles carry class "commitN" (0-indexed) mapping to
 * CSS variables --git0…--git7. We read computed fill/stroke from the element.
 */

import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import {
  extractComputedStroke,
  applyTranslateToPathD,
  nextId,
} from '../utils/parser-base';

// Default branch palette matching Mermaid theme:'base' git0-git7 CSS vars
const BRANCH_PALETTE = [
  '#2166f3', // git0 – main (blue)
  '#e6a817', // git1 – yellow/amber
  '#6db33f', // git2 – green
  '#e05d44', // git3 – red/coral
  '#8338ec', // git4 – purple
  '#fb5607', // git5 – orange
  '#3a86ff', // git6 – light blue
  '#ff006e', // git7 – pink
];

/** Extract branch-index from a "commitN" class token. */
const branchIdxFromClass = (cls: string): number => {
  const m = cls.match(/\bcommit(\d+)\b/);
  return m ? parseInt(m[1], 10) : 0;
};

/** Read the computed fill, falling back to palette by branch index. */
const circleColor = (el: Element, branchIdx: number): string => {
  const style = window.getComputedStyle(el);
  if (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)') return style.fill;
  return BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length];
};

// ─── Nodes ────────────────────────────────────────────────────────────────────

export const parseGitGraphNodes = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // ── 1. Collect all commit circles ─────────────────────────────────────────
  // Regular commits:  circle.commit (no "commit-merge" in class)
  // Merge outer ring: circle.commit (same position as a commit-merge circle)
  // Merge inner fill: circle.commit.commit-merge (skip — outer ring handles rendering)
  //
  // Strategy: build a set of (cx,cy) positions for merge-inner circles,
  // then any outer circle at the same position is a merge commit.
  // This is robust against multi-word commit IDs in the class attribute.

  const mergePositions = new Set<string>();
  svgElement.querySelectorAll<SVGCircleElement>(
    'circle.commit-merge, circle[class*="commit-merge"]'
  ).forEach(circle => {
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const cx = Math.round(tx + parseFloat(circle.getAttribute('cx') || '0'));
    const cy = Math.round(ty + parseFloat(circle.getAttribute('cy') || '0'));
    mergePositions.add(`${cx},${cy}`);
  });

  // Outer circles (regular + merge outer ring) — exclude commit-merge class
  svgElement.querySelectorAll<SVGCircleElement>(
    'circle.commit, circle[class*=" commit"]'
  ).forEach(circle => {
    const cls = circle.getAttribute('class') || '';
    if (cls.includes('commit-merge')) return; // skip inner merge circle

    const branchIdx = branchIdxFromClass(cls);
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const r = parseFloat(circle.getAttribute('r') || '10');
    const cx = tx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = ty + parseFloat(circle.getAttribute('cy') || '0');
    const color = circleColor(circle, branchIdx);

    const isMerge = mergePositions.has(`${Math.round(cx)},${Math.round(cy)}`);

    nodes.push({
      id: nextId(isMerge ? 'git-merge' : 'git-commit'),
      label: '',
      type: 'node',
      shape: isMerge ? 'mergeCircle' : 'circle',
      x: cx, y: cy,
      width: r * 2, height: r * 2,
      color,
      stroke: color,
    });
  });

  // ── 2. Branch label pills (branchLabelBkg rect + branchLabel text) ─────────
  // rect.branchLabelBkg and g.branchLabel are siblings; pair them by index
  const branchLabelBkgs = Array.from(
    svgElement.querySelectorAll<SVGRectElement>('rect.branchLabelBkg, rect[class*="branchLabelBkg"]')
  );
  const branchLabelGs = Array.from(
    svgElement.querySelectorAll<SVGGElement>('g.branchLabel, g[class="branchLabel"]')
  );

  branchLabelBkgs.forEach((rect, idx) => {
    const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
    const rx = tx + parseFloat(rect.getAttribute('x') || '0');
    const ry = ty + parseFloat(rect.getAttribute('y') || '0');
    const rw = parseFloat(rect.getAttribute('width') || '80');
    const rh = parseFloat(rect.getAttribute('height') || '24');

    const labelG = branchLabelGs[idx];
    const text = labelG?.querySelector<SVGTextElement>('text');
    const label = text?.textContent?.trim() ?? '';

    const style = window.getComputedStyle(rect);
    const fill = (style.fill && style.fill !== 'none' && style.fill !== 'rgba(0, 0, 0, 0)')
      ? style.fill
      : BRANCH_PALETTE[idx % BRANCH_PALETTE.length];

    nodes.push({
      id: nextId('git-branch-label'),
      label,
      type: 'node',
      shape: 'roundRect',
      x: rx + rw / 2,
      y: ry + rh / 2,
      width: rw,
      height: rh,
      color: fill,
      stroke: fill,
    });
  });

  return nodes;
};

// ─── Edges ────────────────────────────────────────────────────────────────────

export const parseGitGraphEdges = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];
  const seenD = new Set<string>();

  // ── 1. Branch lifelines: line.branch ──────────────────────────────────────
  svgElement.querySelectorAll<SVGLineElement>('line.branch, line[class*="branch"]').forEach(line => {
    const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
    const x1 = parseFloat(line.getAttribute('x1') || '0') + tx;
    const y1 = parseFloat(line.getAttribute('y1') || '0') + ty;
    const x2 = parseFloat(line.getAttribute('x2') || '0') + tx;
    const y2 = parseFloat(line.getAttribute('y2') || '0') + ty;
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    if (seenD.has(d)) return;
    seenD.add(d);

    const cls = line.getAttribute('class') || '';
    const idxM = cls.match(/\bbranch(\d+)\b/);
    const branchIdx = idxM ? parseInt(idxM[1], 10) : 0;
    const stroke = extractComputedStroke(line, BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length]);

    edges.push({
      id: nextId('git-lifeline'),
      pathD: d,
      stroke,
      type: 'structural',
      hasArrow: false,
      dash: [6, 4],
    });
  });

  // ── 2. Commit connector arrows: g.commit-arrows > path.arrow ──────────────
  svgElement.querySelectorAll<SVGPathElement>(
    'g.commit-arrows path, path.arrow, path[class*="arrow"]'
  ).forEach(path => {
    const rawD = path.getAttribute('d') || '';
    if (!rawD || rawD.length <= 4) return;

    const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
    const d = applyTranslateToPathD(rawD, tx, ty);
    if (seenD.has(d)) return;
    seenD.add(d);

    const cls = path.getAttribute('class') || '';
    const idxM = cls.match(/\barrow(\d+)\b/);
    const branchIdx = idxM ? parseInt(idxM[1], 10) : 0;
    const stroke = extractComputedStroke(path, BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length]);

    edges.push({
      id: nextId('git-arrow'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
    });
  });

  return edges;
};

// ─── Commit ID labels ─────────────────────────────────────────────────────────

export const parseGitGraphLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  // Build a lookup: commit circle positions keyed by rounded "cx,cy" in SVG space.
  // We'll use these to anchor each label's rotation pivot exactly at the commit dot.
  const commitCircles = Array.from(
    svgElement.querySelectorAll<SVGCircleElement>('circle.commit')
  ).filter(c => !(c.getAttribute('class') || '').includes('commit-merge'));

  // For each non-merge commit circle, record its world-space (cx, cy) and radius.
  const circlePositions: { cx: number; cy: number; r: number }[] = commitCircles.map(circle => {
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    return {
      cx: tx + parseFloat(circle.getAttribute('cx') || '0'),
      cy: ty + parseFloat(circle.getAttribute('cy') || '0'),
      r:  parseFloat(circle.getAttribute('r') || '10'),
    };
  });

  // Mermaid generates one text.commit-label per commit circle, in the same order.
  // We pair them by index and use the circle's world-space cx/cy as the pivot.
  const labelTexts = Array.from(svgElement.querySelectorAll<SVGTextElement>(
    'g.commit-labels text.commit-label, text.commit-label, text[class*="commit-label"]'
  ));

  labelTexts.forEach((text, idx) => {
    const txt = text.textContent?.trim();
    if (!txt) return;

    // Pair by index with the circle positions array (both are in DOM order)
    const cp = circlePositions[idx];
    if (!cp) return;

    const { cx: pivotX, cy: pivotY, r: radius } = cp;

    // Anchor directly below the circle. Renderer: translate(x,y) → rotate(-PI/4) → fillText(0,0).
    // The text tip lands at (x,y) and reads diagonally upper-right.
    const GAP = 30;
    // Shift anchor left by half-gap to move text down-left along the -45° axis
    const LATERAL = GAP * 0.5;
    labels.push({
      x: pivotX - LATERAL,
      y: pivotY + radius + GAP,
      text: txt,
      fontSize: 11,
      bold: false,
      color: '#475569',
      align: 'left',
      rotation: -Math.PI / 5.5,
    });
  
  });

  return labels;
};
