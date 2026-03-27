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
  const fill = style.fill;
  const palette = BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length];
  if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)') return palette;
  const isWhite = /rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)|#fff|#ffffff/i.test(fill);
  return isWhite ? palette : fill;
};

// ─── Nodes ────────────────────────────────────────────────────────────────────

export const parseGitGraphNodes = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // ── 0. Pre-collect commit label & tag texts keyed by circle position ────────
  // We do this first so we can attach the text to each node as metadata.

  // Helper: nearest-circle match by weighted (x-heavy) distance
  const circleScore = (cx: number, cy: number, lx: number, ly: number) =>
    Math.abs(cx - lx) * 2 + Math.abs(cy - ly) * 0.3;

  // Gather raw circle positions (pre-transform) for matching
  const rawCircles: { cx: number; cy: number }[] = [];
  svgElement.querySelectorAll<SVGCircleElement>('circle[class*="commit"]').forEach(circle => {
    if ((circle.getAttribute('class') || '').includes('commit-merge')) return;
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    rawCircles.push({
      cx: tx + parseFloat(circle.getAttribute('cx') || '0'),
      cy: ty + parseFloat(circle.getAttribute('cy') || '0'),
    });
  });
  svgElement.querySelectorAll<SVGRectElement>('rect[class*="commit-highlight"]').forEach(rect => {
    if ((rect.getAttribute('class') || '').includes('-inner')) return;
    const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
    const rw = parseFloat(rect.getAttribute('width') || '20');
    const rh = parseFloat(rect.getAttribute('height') || '20');
    rawCircles.push({
      cx: tx + parseFloat(rect.getAttribute('x') || '0') + rw / 2,
      cy: ty + parseFloat(rect.getAttribute('y') || '0') + rh / 2,
    });
  });

  // Build commitLabel map: circleIdx → label text
  const labelBkgs = Array.from(svgElement.querySelectorAll<SVGRectElement>(
    'g.commit-labels rect.commit-label-bkg, rect.commit-label-bkg, rect[class*="commit-label-bkg"]'
  ));
  const labelTexts = Array.from(svgElement.querySelectorAll<SVGTextElement>(
    'g.commit-labels text.commit-label, text.commit-label, text[class*="commit-label"]'
  ));
  const commitLabelByIdx = new Map<number, string>();
  const claimedForLabel = new Set<number>();
  labelTexts.forEach((text, i) => {
    const txt = text.textContent?.trim();
    if (!txt) return;
    const bkg = labelBkgs[i];
    let lx: number, ly: number;
    if (bkg) {
      const { x: bx, y: by } = getCumulativeTransform(bkg, svgElement);
      lx = bx + parseFloat(bkg.getAttribute('x') || '0') + parseFloat(bkg.getAttribute('width') || '0') / 2;
      ly = by + parseFloat(bkg.getAttribute('y') || '0');
    } else {
      const { x: tx, y: ty } = getCumulativeTransform(text, svgElement);
      lx = tx + parseFloat(text.getAttribute('x') || '0');
      ly = ty + parseFloat(text.getAttribute('y') || '0');
    }
    let bestIdx = -1, bestScore = Infinity;
    rawCircles.forEach(({ cx, cy }, idx) => {
      if (claimedForLabel.has(idx)) return;
      const s = circleScore(cx, cy, lx, ly);
      if (s < bestScore) { bestScore = s; bestIdx = idx; }
    });
    if (bestIdx >= 0) { claimedForLabel.add(bestIdx); commitLabelByIdx.set(bestIdx, txt); }
  });

  // Build tagLabel map: circleIdx → tag text
  const tagByIdx = new Map<number, string>();
  svgElement.querySelectorAll<SVGTextElement>('text.tag-label, text[class*="tag-label"]').forEach(txt => {
    const text = txt.textContent?.trim();
    if (!text) return;
    const { x: tx, y: ty } = getCumulativeTransform(txt, svgElement);
    const lx = tx + parseFloat(txt.getAttribute('x') || '0');
    const ly = ty + parseFloat(txt.getAttribute('y') || '0');
    let bestIdx = -1, bestScore = Infinity;
    rawCircles.forEach(({ cx, cy }, idx) => {
      const s = circleScore(cx, cy, lx, ly);
      if (s < bestScore) { bestScore = s; bestIdx = idx; }
    });
    if (bestIdx >= 0) tagByIdx.set(bestIdx, text);
  });

  // ── 1. Collect all commit circles ─────────────────────────────────────────
  const mergePositions = new Set<string>();
  svgElement.querySelectorAll<SVGCircleElement>(
    'circle.commit-merge, circle[class*="commit-merge"]'
  ).forEach(circle => {
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const cx = Math.round(tx + parseFloat(circle.getAttribute('cx') || '0'));
    const cy = Math.round(ty + parseFloat(circle.getAttribute('cy') || '0'));
    mergePositions.add(`${cx},${cy}`);
  });

  let circleInsertIdx = 0;
  svgElement.querySelectorAll<SVGCircleElement>(
    'circle[class*="commit"]'
  ).forEach(circle => {
    const cls = circle.getAttribute('class') || '';
    if (cls.includes('commit-merge')) return;

    const branchIdx = branchIdxFromClass(cls);
    const { x: tx, y: ty } = getCumulativeTransform(circle, svgElement);
    const rRaw = parseFloat(circle.getAttribute('r') || '10');
    const r = Math.max(rRaw, 10) * 1.4;
    const cx = tx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = ty + parseFloat(circle.getAttribute('cy') || '0');
    const color = circleColor(circle, branchIdx);

    const isMerge   = mergePositions.has(`${Math.round(cx)},${Math.round(cy)}`);
    const isReverse = cls.includes('commit-reverse');

    let shape: DiagramNode['shape'] = 'circle';
    if (isMerge)   shape = 'mergeCircle';
    if (isReverse) shape = 'reverseCircle';

    const myIdx = circleInsertIdx++;
    nodes.push({
      id: nextId(isMerge ? 'git-merge' : isReverse ? 'git-reverse' : 'git-commit'),
      label: '',
      type: 'node',
      shape,
      x: cx, y: cy,
      width: r * 2, height: r * 2,
      color,
      stroke: color,
      gitCommitLabel: commitLabelByIdx.get(myIdx),
      gitTagLabel: tagByIdx.get(myIdx),
    });
  });

  // ── HIGHLIGHT commits ──────────────────────────────────────────────────────
  const highlightSeen = new Set<string>();
  svgElement.querySelectorAll<SVGRectElement>('rect[class*="commit-highlight"]').forEach(rect => {
    const cls = rect.getAttribute('class') || '';
    if (cls.includes('-inner')) return;
    const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
    const rx = tx + parseFloat(rect.getAttribute('x') || '0');
    const ry = ty + parseFloat(rect.getAttribute('y') || '0');
    const rw = parseFloat(rect.getAttribute('width') || '20');
    const rh = parseFloat(rect.getAttribute('height') || '20');
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const key = `${Math.round(cx)},${Math.round(cy)}`;
    if (highlightSeen.has(key)) return;
    highlightSeen.add(key);

    const branchIdx = branchIdxFromClass(cls);
    const color = circleColor(rect, branchIdx);
    const size = Math.max(rw, rh) * 1.4;
    const myIdx = circleInsertIdx++;

    nodes.push({
      id: nextId('git-highlight'),
      label: '',
      type: 'node',
      shape: 'highlightRect',
      x: cx, y: cy,
      width: size, height: size,
      color,
      stroke: color,
      gitCommitLabel: commitLabelByIdx.get(myIdx),
      gitTagLabel: tagByIdx.get(myIdx),
    });
  });

  // ── 2. Branch label pills ──────────────────────────────────────────────────
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

    edges.push({
      id: nextId('git-lifeline'),
      pathD: d,
      stroke: '#9ca3af',
      type: 'structural',
      hasArrow: false,
      dash: [8, 6],
      lineWidth: 4,
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
    const palette = BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length];
    const computed = extractComputedStroke(path, palette);
    const isWhite = /rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)|#fff|#ffffff/i.test(computed);
    const stroke = isWhite ? palette : computed;

    edges.push({
      id: nextId('git-arrow'),
      pathD: d,
      stroke,
      type: 'link',
      hasArrow: false,
      lineWidth: 4,
    });
  });

  return edges;
};

// ─── Snap commit arrows to commit node borders ────────────────────────────────

/**
 * After both nodes and edges are parsed, attach fromNodeId / toNodeId to
 * each commit-arrow edge so drawEdge can snap the arrowhead to the circle
 * border instead of drawing it at the path endpoint (which is the circle centre).
 */
export const snapGitArrowsToNodes = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  const commitNodes = nodes.filter(n =>
    n.shape === 'circle' || n.shape === 'mergeCircle' ||
    n.shape === 'reverseCircle' || n.shape === 'highlightRect'
  );
  if (commitNodes.length === 0) return edges;

  const nearest = (x: number, y: number): DiagramNode =>
    commitNodes.reduce((best, n) => {
      return Math.hypot(n.x - x, n.y - y) < Math.hypot(best.x - x, best.y - y) ? n : best;
    });

  const startPt = (d: string) => {
    const m = d.match(/M\s*([-+]?[\d.e]+)\s+([-+]?[\d.e]+)/i);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  };
  const endPt = (d: string) => {
    const m = d.match(/[MLCSQTA][^MLCSQTAZHV]*$/i);
    if (!m) return null;
    const nums = [...m[0].matchAll(/[-+]?[\d.]+(?:e[-+]?\d+)?/g)].map(n => parseFloat(n[0]));
    return nums.length >= 2 ? { x: nums[nums.length - 2], y: nums[nums.length - 1] } : null;
  };

  return edges.map(edge => {
    if (!edge.id.startsWith('git-arrow')) return edge;
    const sp = startPt(edge.pathD);
    const ep = endPt(edge.pathD);
    return {
      ...edge,
      fromNodeId: sp ? nearest(sp.x, sp.y).id : undefined,
      toNodeId:   ep ? nearest(ep.x, ep.y).id : undefined,
    };
  });
};

// ─── Branch spacing expansion ─────────────────────────────────────────────────

/**
 * Mermaid hardcodes:
 *   - Branch row gap : ~90px  (50 + 40 for rotateCommitLabel)
 *   - Commit step    : ~40px  (COMMIT_STEP)
 *
 * We post-process all coordinates:
 *   Y axis — remap discrete branch rows to TARGET_BRANCH_GAP apart.
 *   X axis — reassign each "commit column" (unique SVG X rounded to SNAP)
 *            so adjacent columns are at least MIN_COL_GAP apart, with
 *            extra padding derived from the measured pixel width of the
 *            commit-ID label at that column.
 */
const TARGET_BRANCH_GAP = 120; // px between adjacent branch rows
const MIN_COL_GAP       = 90;  // minimum px between adjacent commit columns
const LABEL_FONT        = '11px sans-serif'; // must match SeqLabel fontSize in parseGitGraphLabels
const LABEL_PAD         = 24;  // extra px added to measured label width for breathing room
const SNAP              = 12;  // px tolerance for grouping coords into same branch/column

// ── Canvas text measurement ───────────────────────────────────────────────────

let _measureCtx: CanvasRenderingContext2D | null = null;
const measureText = (text: string, font = LABEL_FONT): number => {
  if (!_measureCtx) {
    const c = document.createElement('canvas');
    _measureCtx = c.getContext('2d');
  }
  if (!_measureCtx) return text.length * 7; // fallback
  _measureCtx.font = font;
  return _measureCtx.measureText(text).width;
};

// ── Y remap ──────────────────────────────────────────────────────────────────

const buildYRemap = (commitNodes: DiagramNode[]): ((y: number) => number) => {
  if (commitNodes.length === 0) return y => y;
  const levels: number[] = [];
  for (const y of commitNodes.map(n => n.y)) {
    if (!levels.some(l => Math.abs(l - y) < SNAP)) levels.push(y);
  }
  levels.sort((a, b) => a - b);
  if (levels.length < 2) return y => y;
  const base = levels[0]!;
  return (y: number) => {
    const closestIdx = levels.reduce((best, l, i) =>
      Math.abs(l - y) < Math.abs(levels[best]! - y) ? i : best, 0);
    return closestIdx * TARGET_BRANCH_GAP + base + (y - levels[closestIdx]!);
  };
};

// ── X remap — text-aware column layout ───────────────────────────────────────

const buildXRemap = (commitNodes: DiagramNode[]): ((x: number) => number) => {
  if (commitNodes.length === 0) return x => x;

  // Group commits into columns by their original X (±SNAP)
  const cols: { origX: number; label: string }[] = [];
  for (const n of commitNodes) {
    const existing = cols.find(c => Math.abs(c.origX - n.x) < SNAP);
    if (existing) {
      // Keep the longest label for this column
      const lbl = n.gitCommitLabel || n.gitTagLabel || '';
      if (lbl.length > existing.label.length) existing.label = lbl;
    } else {
      cols.push({ origX: n.x, label: n.gitCommitLabel || n.gitTagLabel || '' });
    }
  }
  cols.sort((a, b) => a.origX - b.origX);

  // Assign new X positions: first column stays in place, each subsequent
  // column is placed at least MIN_COL_GAP away, or further if the previous
  // column's label would overlap.
  const originX = cols[0]!.origX;
  const newXs: number[] = [originX];
  for (let i = 1; i < cols.length; i++) {
    const prev = cols[i - 1]!;
    const labelW = measureText(prev.label) + LABEL_PAD;
    const minGap = Math.max(MIN_COL_GAP, labelW);
    newXs.push(newXs[i - 1]! + minGap);
  }

  // Build interpolation: given any original x, find its column and return new x.
  // Sub-column offsets (e.g. connector bend points between columns) are scaled
  // proportionally in the gap between the two neighbouring columns.
  return (x: number): number => {
    // Exact column match
    const exactIdx = cols.findIndex(c => Math.abs(c.origX - x) < SNAP);
    if (exactIdx >= 0) return newXs[exactIdx]!;

    // Between two columns — interpolate
    for (let i = 0; i < cols.length - 1; i++) {
      const lo = cols[i]!, hi = cols[i + 1]!;
      if (x > lo.origX - SNAP && x < hi.origX + SNAP) {
        const t = (x - lo.origX) / (hi.origX - lo.origX);
        return newXs[i]! + t * (newXs[i + 1]! - newXs[i]!);
      }
    }
    // Before first or after last column: linear extrapolation
    if (x <= cols[0]!.origX) {
      const scale = cols.length > 1
        ? (newXs[1]! - newXs[0]!) / (cols[1]!.origX - cols[0]!.origX)
        : 1;
      return newXs[0]! + (x - cols[0]!.origX) * scale;
    }
    const last = cols.length - 1;
    const scale = last > 0
      ? (newXs[last]! - newXs[last - 1]!) / (cols[last]!.origX - cols[last - 1]!.origX)
      : 1;
    return newXs[last]! + (x - cols[last]!.origX) * scale;
  };
};

// ── Path coordinate remapping ─────────────────────────────────────────────────

/**
 * Remap every coordinate in a path d-string, converting Bézier curve commands
 * (C, S, Q) to straight L segments using only their final endpoint.
 * Mermaid's gitGraph paths are orthogonal metro lines — the curves are purely
 * cosmetic corner-rounds. After non-uniform X remapping the control points
 * would distort badly, so we discard them entirely.
 */
const remapPathCoords = (
  d: string,
  remapX: (x: number) => number,
  remapY: (y: number) => number,
): string => {
  const tokens = d.match(/[MmLlCcSsQqTtAaHhVvZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!tokens) return d;

  const out: string[] = [];
  let i = 0;
  const num = (off = 0) => parseFloat(tokens[i + off]!);

  while (i < tokens.length) {
    const cmd = tokens[i++];

    if (cmd === 'M' || cmd === 'L' || cmd === 'm' || cmd === 'l') {
      // x y pairs
      out.push(cmd === 'm' || cmd === 'l' ? cmd : cmd);
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        const x = num(); const y = num(1);
        out.push(`${cmd === 'M' || cmd === 'L' ? remapX(x) : x} ${cmd === 'M' || cmd === 'L' ? remapY(y) : y}`);
        i += 2;
      }
    } else if (cmd === 'C') {
      // 6 numbers: cp1x cp1y cp2x cp2y x y — keep only endpoint as L
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        const x = num(4); const y = num(5);
        out.push(`L ${remapX(x)} ${remapY(y)}`);
        i += 6;
      }
    } else if (cmd === 'S') {
      // 4 numbers: cp2x cp2y x y
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        const x = num(2); const y = num(3);
        out.push(`L ${remapX(x)} ${remapY(y)}`);
        i += 4;
      }
    } else if (cmd === 'Q') {
      // 4 numbers: cpx cpy x y
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        const x = num(2); const y = num(3);
        out.push(`L ${remapX(x)} ${remapY(y)}`);
        i += 4;
      }
    } else if (cmd === 'H') {
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        out.push(`H ${remapX(num())}`);
        i += 1;
      }
    } else if (cmd === 'V') {
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        out.push(`V ${remapY(num())}`);
        i += 1;
      }
    } else if (cmd === 'Z' || cmd === 'z') {
      out.push(cmd);
    } else {
      // Pass-through (relative commands, A, etc.)
      out.push(cmd);
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]!)) {
        out.push(tokens[i++]!);
      }
    }
  }

  return out.join(' ');
};

// ── Public API ────────────────────────────────────────────────────────────────

export const expandGitBranchSpacing = (
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  labels: SeqLabel[],
): { nodes: DiagramNode[]; edges: DiagramEdge[]; labels: SeqLabel[] } => {
  const commitNodes = nodes.filter(n =>
    n.shape === 'circle' || n.shape === 'mergeCircle' ||
    n.shape === 'reverseCircle' || n.shape === 'highlightRect'
  );

  const remapY = buildYRemap(commitNodes);
  const remapX = buildXRemap(commitNodes);

  const newNodes = nodes.map(n => {
    if (n.shape === 'roundRect') return { ...n, y: remapY(n.y) }; // branch pills: Y only
    return { ...n, x: remapX(n.x), y: remapY(n.y) };
  });

  // Remap all edge paths so they share the same coordinate space as the expanded nodes.
  // git-arrow paths will be completely rebuilt by regenGitArrowPaths anyway, but we
  // still remap them here so snapGitArrowsToNodes can correctly find the nearest node
  // (both path endpoints and node positions must be in the same coordinate space).
  const newEdges = edges.map(e => ({ ...e, pathD: remapPathCoords(e.pathD, remapX, remapY) }));

  const newLabels = labels.map(l => ({ ...l, x: remapX(l.x), y: remapY(l.y) }));

  return { nodes: newNodes, edges: newEdges, labels: newLabels };
};

/**
 * After nodes have been repositioned AND edges have been snapped to nodes,
 * regenerate each git-arrow pathD as a clean orthogonal L-path between the
 * two node centres. This avoids all the remapping distortion from Mermaid's
 * original Bézier paths.
 *
 * Routing rule (metro style):
 *   - Same Y (same branch): horizontal line  M x1 y  L x2 y
 *   - Different Y          : elbow at mid-X  M x1 y1 L mx y1 L mx y2 L x2 y2
 */
export const regenGitArrowPaths = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  return edges.map(edge => {
    if (!edge.id.startsWith('git-arrow')) return edge;
    const from = edge.fromNodeId ? nodeById.get(edge.fromNodeId) : undefined;
    const to   = edge.toNodeId   ? nodeById.get(edge.toNodeId)   : undefined;
    if (!from || !to) return edge;

    const x1 = from.x, y1 = from.y;
    const x2 = to.x,   y2 = to.y;

    let pathD: string;
    const CORNER_R = 14;
    if (Math.abs(y1 - y2) < 4) {
      // Same branch: straight horizontal
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (y2 > y1) {
      // Branch-off (going down then horizontal):
      // vertical down from parent commit, rounded corner, then horizontal to first commit
      const r = Math.min(CORNER_R, (y2 - y1) / 2, Math.abs(x2 - x1) / 2);
      const sx = Math.sign(x2 - x1) || 1;
      pathD = `M ${x1} ${y1} L ${x1} ${y2 - r} Q ${x1} ${y2} ${x1 + sx * r} ${y2} L ${x2} ${y2}`;
    } else {
      // Merge (horizontal then going up):
      // horizontal to merge commit X, rounded corner, then vertical up to destination branch
      const r = Math.min(CORNER_R, Math.abs(x2 - x1) / 2, (y1 - y2) / 2);
      const sx = Math.sign(x2 - x1) || 1;
      pathD = `M ${x1} ${y1} L ${x2 - sx * r} ${y1} Q ${x2} ${y1} ${x2} ${y1 - r} L ${x2} ${y2}`;
    }

    return { ...edge, pathD };
  });
};

// ─── Commit ID labels ─────────────────────────────────────────────────────────

/**
 * Derives SeqLabel positions from already-expanded DiagramNodes.
 * Label text was attached to each node as gitCommitLabel / gitTagLabel
 * during parseGitGraphNodes, so we no longer need the raw SVG here.
 *
 * Layout rules (all measured from the node centre, post-expansion):
 *   • Commit-ID label : starts LABEL_BELOW px below the node, rotated.
 *   • Tag label       : starts TAG_ABOVE  px above the node, rotated.
 *   • When both exist : commit-ID is pushed an extra LINE_STEP down.
 */
export const parseGitGraphLabels = (_svgElement: SVGSVGElement, expandedNodes?: DiagramNode[]): SeqLabel[] => {
  if (!expandedNodes) return [];

  const labels: SeqLabel[] = [];
  const ROTATION   = -Math.PI / 5.5;
  const LINE_STEP  = 22;
  const LATERAL    = LINE_STEP * 0.5;  // slight leftward nudge so text clears the node
  const LABEL_BELOW = LINE_STEP;        // gap from node bottom edge to first label line
  const TAG_ABOVE   = 10;              // gap from node top edge to tag label

  const commitNodes = expandedNodes.filter(n =>
    n.shape === 'circle' || n.shape === 'mergeCircle' ||
    n.shape === 'reverseCircle' || n.shape === 'highlightRect'
  );

  for (const n of commitNodes) {
    const r = n.width / 2;
    const hasLabel = !!n.gitCommitLabel;
    const hasTag   = !!n.gitTagLabel;

    if (hasLabel) {
      const extraGap = hasTag ? LINE_STEP : 0;
      labels.push({
        x: n.x - LATERAL,
        y: n.y + r + LABEL_BELOW + extraGap,
        text: n.gitCommitLabel!,
        fontSize: 11,
        bold: false,
        color: '#475569',
        align: 'left',
        rotation: ROTATION,
      });
    }

    if (hasTag) {
      labels.push({
        x: n.x - LATERAL,
        y: n.y - r - TAG_ABOVE,
        text: n.gitTagLabel!,
        fontSize: 11,
        bold: false,
        color: '#1e293b',
        align: 'left',
        rotation: ROTATION,
        bgColor: 'rgba(241,245,249,0.92)',
      });
    }
  }

  return labels;
};
