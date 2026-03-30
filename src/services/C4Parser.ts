import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import {
  lineToPathD,
  extractEdgeStyle,
  extractComputedColors,
  rectCenter,
  applyTranslateToPathD,
  nextId,
} from '../utils/parser-base';

// ── helpers ───────────────────────────────────────────────────────────────────

/** True if el is a descendant of any g.person-man (C4 element node) */
const insidePersonMan = (el: Element): boolean => !!el.closest('g.person-man');

/** True if el is a direct child of a boundary group (rect with stroke-dasharray sibling) */
const insideBoundaryGroup = (el: Element): boolean => {
  const parentG = el.parentElement;
  if (!parentG) return false;
  return !!parentG.querySelector(':scope > rect[stroke-dasharray]');
};

// ── Nodes ─────────────────────────────────────────────────────────────────────

/**
 * Parses C4 diagram nodes from Mermaid-rendered SVG.
 *
 * Mermaid C4 SVG structure:
 * - All C4 elements (Person, System, Container, etc.) → <g class="person-man">
 *   - Person/Person_Ext: contains <image> + <rect>
 *   - SystemDb / ContainerDb: contains 2+ <path> elements (cylinder)
 *   - Others (System, Container, Component): contains <rect>
 * - Boundaries (Enterprise_Boundary, System_Boundary, etc.): unnamed <g>
 *   containing <rect stroke-dasharray="...">
 *
 * Returns boundaries first (rendered as cluster background layer), then elements.
 */
export const parseC4Nodes = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // --- 1. Boundaries → cluster nodes (background layer) --------------------
  const seenBoundary = new Set<Element>();

  svgElement.querySelectorAll<SVGRectElement>('rect[stroke-dasharray]').forEach(rect => {
    if (insidePersonMan(rect)) return;

    const parentG = rect.parentElement;
    if (!parentG || seenBoundary.has(parentG)) return;
    seenBoundary.add(parentG);

    // Read dimensions from SVG attributes directly
    const bw = parseFloat(rect.getAttribute('width') || '0');
    const bh = parseFloat(rect.getAttribute('height') || '0');
    const bx = parseFloat(rect.getAttribute('x') || '0');
    const by = parseFloat(rect.getAttribute('y') || '0');
    if (bw <= 0 || bh <= 0) return;
    const { x: btx, y: bty } = getCumulativeTransform(rect, svgElement);

    // Boundary title: first direct-child text element
    const label = Array.from(parentG.querySelectorAll<SVGTextElement>(':scope > text'))
      .map(t => t.textContent?.trim() ?? '')
      .find(Boolean) ?? '';

    const fill = rect.getAttribute('fill') ?? 'none';
    const strokeColor = rect.getAttribute('stroke') ?? '#888888';

    nodes.push({
      id: parentG.id || nextId('c4-boundary'),
      label,
      type: 'cluster',
      shape: 'rect',
      x: btx + bx + bw / 2,
      y: bty + by + bh / 2,
      width: bw,
      height: bh,
      color: fill === 'none' ? 'rgba(128,128,128,0.04)' : fill,
      stroke: strokeColor,
    });
  });

  // --- 2. C4 elements → regular nodes --------------------------------------
  svgElement.querySelectorAll<SVGGElement>('g.person-man').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    const hasImage = !!g.querySelector('image');
    // Direct-child paths only (avoids nested group path conflicts)
    const directPaths = Array.from(g.querySelectorAll<SVGPathElement>(':scope > path'));

    // Shape detection:
    //   Person / Person_Ext → c4Person (box + person silhouette icon)
    //   SystemDb / ContainerDb → cylinder (2+ direct paths, no rect)
    //   Everything else (System, Container, Component) → roundRect
    let shape: DiagramNode['shape'];
    if (hasImage) {
      shape = 'c4Person';
    } else if (directPaths.length >= 2 && !rect) {
      shape = 'cylinder';
    } else {
      shape = 'roundRect';
    }

    // Read rect dimensions directly from SVG attributes to avoid getBBox()
    // returning unexpected values (e.g. when the rect is inside a transformed group).
    // Fall back to the first path element for cylinder shapes.
    let cx: number, cy: number, width: number, height: number;

    if (rect) {
      const rw = parseFloat(rect.getAttribute('width') || '0');
      const rh = parseFloat(rect.getAttribute('height') || '0');
      const rx = parseFloat(rect.getAttribute('x') || '0');
      const ry = parseFloat(rect.getAttribute('y') || '0');
      if (rw <= 0 || rh <= 0) return;
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      cx = tx + rx + rw / 2;
      cy = ty + ry + rh / 2;
      width = rw;
      height = rh;
    } else if (directPaths.length > 0) {
      const geom = rectCenter(directPaths[0] as SVGGraphicsElement, svgElement);
      if (!geom) return;
      ({ cx, cy, width, height } = geom);
    } else {
      return;
    }

    // Colors from the rect or first path
    const colorEl = (rect ?? directPaths[0]) as Element;
    const defaultFill = '#1168bd';
    const { color, stroke } = extractComputedColors(colorEl, { color: defaultFill, stroke: '#073b6f' });

    // Label: prefer bold text (the element name), fall back to first text
    const allTexts = Array.from(g.querySelectorAll<SVGTextElement>('text'));
    let label = '';
    for (const t of allTexts) {
      const fw = parseFloat(window.getComputedStyle(t).fontWeight) || 400;
      if (fw >= 600) { label = t.textContent?.trim() ?? ''; break; }
    }
    if (!label) label = allTexts[0]?.textContent?.trim() ?? '';

    nodes.push({
      id: g.id || nextId('c4'),
      label,
      type: 'node',
      shape,
      x: cx,
      y: cy,
      width,
      height,
      color,
      stroke,
    });
  });

  console.log('[C4Parser] nodes parsed:', nodes.length, nodes.map(n => ({ id: n.id, label: n.label, shape: n.shape, x: n.x, y: n.y, w: n.width, h: n.height })));
  return nodes;
};

// ── Edges ─────────────────────────────────────────────────────────────────────

/**
 * Parses C4 relationship lines from Mermaid-rendered SVG.
 *
 * Mermaid renders relationships as:
 * - <line marker-end="..."> for the first Rel()
 * - <path marker-end="..."> for subsequent Rel() / BiRel() (quadratic Bézier)
 *
 * BiRel() additionally sets marker-start for the reverse arrowhead.
 */
export const parseC4Edges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  const pushEdge = (pathD: string, el: Element, hasStart: boolean) => {
    const { stroke, dash } = extractEdgeStyle(el, isPremium);
    edges.push({
      id: nextId('c4-edge'),
      pathD,
      stroke,
      type: 'link',
      dash,
      hasArrow: true,
      arrowEnd: 'default',
      arrowStart: hasStart ? 'default' : undefined,
    });
  };

  // Debug: log all lines and paths with their marker attributes
  const allLines = Array.from(svgElement.querySelectorAll<SVGLineElement>('line'));
  const allPaths = Array.from(svgElement.querySelectorAll<SVGPathElement>('path'));
  console.log('[C4Parser] lines found:', allLines.length);
  allLines.forEach((l, i) => {
    console.log(`  line[${i}] marker-end="${l.getAttribute('marker-end')}" marker-start="${l.getAttribute('marker-start')}" insidePersonMan=${insidePersonMan(l)} x1=${l.getAttribute('x1')} y1=${l.getAttribute('y1')} x2=${l.getAttribute('x2')} y2=${l.getAttribute('y2')}`);
  });
  console.log('[C4Parser] paths found:', allPaths.length);
  allPaths.forEach((p, i) => {
    console.log(`  path[${i}] marker-end="${p.getAttribute('marker-end')}" marker-start="${p.getAttribute('marker-start')}" insidePersonMan=${insidePersonMan(p)} d="${p.getAttribute('d')?.slice(0, 40)}"`);
  });

  // <line> elements with marker — first Rel() in the diagram
  svgElement.querySelectorAll<SVGLineElement>('line').forEach(line => {
    if (insidePersonMan(line)) return;
    const hasEnd   = !!line.getAttribute('marker-end');
    const hasStart = !!line.getAttribute('marker-start');
    if (!hasEnd && !hasStart) return;
    pushEdge(lineToPathD(line, svgElement), line, hasStart);
  });

  // <path> elements with marker — subsequent / curved relationships
  svgElement.querySelectorAll<SVGPathElement>('path').forEach(path => {
    if (insidePersonMan(path)) return;
    const hasEnd   = !!path.getAttribute('marker-end');
    const hasStart = !!path.getAttribute('marker-start');
    if (!hasEnd && !hasStart) return;
    const d = path.getAttribute('d') ?? '';
    if (d.length <= 5) return;
    const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
    pushEdge(applyTranslateToPathD(d, tx, ty), path, hasStart);
  });

  console.log('[C4Parser] edges parsed:', edges.length, edges);
  return edges;
};

// ── Snap edges to node borders ────────────────────────────────────────────────

/**
 * Attach fromNodeId / toNodeId to each C4 edge by matching path endpoints
 * to the nearest node. This lets drawEdge snap arrowheads to the exact node
 * border instead of drawing them at the raw SVG coordinates (which would be
 * covered by the node box drawn on top).
 */
export const snapC4EdgesToNodes = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  const nonCluster = nodes.filter(n => n.type !== 'cluster');
  if (nonCluster.length === 0) return edges;

  /**
   * Find the node whose bounding box contains (x, y), with a small tolerance.
   * Falls back to the nearest node if it is within 60px of (x, y).
   * Returns undefined when no node is a plausible match — this prevents
   * misidentifying a mid-diagram point as a node endpoint.
   */
  const findNode = (x: number, y: number): DiagramNode | undefined => {
    const TOL = 12; // px — bounding-box containment tolerance
    const contained = nonCluster.find(n =>
      Math.abs(x - n.x) <= n.width  / 2 + TOL &&
      Math.abs(y - n.y) <= n.height / 2 + TOL
    );
    if (contained) return contained;

    // Fallback: nearest centre within 60px (catches border-ending paths)
    const THRESHOLD = 60;
    let best: DiagramNode | undefined;
    let bestDist = THRESHOLD;
    for (const n of nonCluster) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  };

  const startPt = (d: string) => {
    const m = d.match(/M\s*([-+]?[\d.e]+)[,\s]+([-+]?[\d.e]+)/i);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  };
  const endPt = (d: string) => {
    const m = d.match(/[MLCSQTA][^MLCSQTAZHV]*$/i);
    if (!m) return null;
    const nums = [...m[0].matchAll(/[-+]?[\d.]+(?:e[-+]?\d+)?/g)].map(n => parseFloat(n[0]));
    return nums.length >= 2 ? { x: nums[nums.length - 2], y: nums[nums.length - 1] } : null;
  };

  return edges.map(edge => {
    const sp = startPt(edge.pathD);
    const ep = endPt(edge.pathD);
    const fromNode = sp ? findNode(sp.x, sp.y) : undefined;
    const toNode   = ep ? findNode(ep.x, ep.y) : undefined;
    return {
      ...edge,
      fromNodeId: fromNode?.id,
      toNodeId:   toNode?.id,
    };
  });
};

// ── Layout: expand node spacing inside boundaries ────────────────────────────

/**
 * Post-processes C4 node positions so that nodes inside a boundary cluster
 * have a minimum horizontal and vertical gap between them.
 *
 * Mermaid's dagre layout often packs nodes too tightly when the System_Boundary
 * contains many elements. This expands positions in-place and widens the
 * cluster rectangles to match.
 *
 * Also updates all seqLabel positions (passed in as a mutable array) so that
 * <<type>> / description text stays anchored to the moved nodes.
 */
export const expandC4NodeSpacing = (nodes: DiagramNode[]): DiagramNode[] => {
  const MIN_H_GAP = 32; // minimum horizontal gap between node edges
  const MIN_V_GAP = 24; // minimum vertical gap between node edges

  const clusters = nodes.filter(n => n.type === 'cluster');
  const regular  = nodes.filter(n => n.type !== 'cluster');

  // Work on a mutable copy
  const moved = regular.map(n => ({ ...n }));

  for (const cluster of clusters) {
    const hw = cluster.width  / 2;
    const hh = cluster.height / 2;

    // Find all regular nodes inside this cluster's bounding box
    const inside = moved.filter(n =>
      Math.abs(n.x - cluster.x) <= hw + 1 &&
      Math.abs(n.y - cluster.y) <= hh + 1
    );
    if (inside.length < 2) continue;

    // --- Horizontal expansion (nodes in same row) --------------------------
    // Group into rows by Y proximity (within half a node height)
    const rows: (typeof moved)[] = [];
    const assigned = new Set<string>();
    for (const n of inside) {
      if (assigned.has(n.id)) continue;
      const row = inside.filter(m => Math.abs(m.y - n.y) <= n.height * 0.6);
      row.forEach(m => assigned.add(m.id));
      rows.push(row);
    }

    let totalHShift = 0;
    for (const row of rows) {
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);

      for (let i = 1; i < row.length; i++) {
        const prev = row[i - 1];
        const curr = row[i];
        const gap = (curr.x - curr.width / 2) - (prev.x + prev.width / 2);
        if (gap < MIN_H_GAP) {
          const shift = MIN_H_GAP - gap;
          // Push curr and all nodes to its right
          for (let j = i; j < row.length; j++) row[j].x += shift;
          totalHShift += shift;
        }
      }
    }

    // --- Vertical expansion (nodes in same column) ------------------------
    const cols: (typeof moved)[] = [];
    const vassigned = new Set<string>();
    for (const n of inside) {
      if (vassigned.has(n.id)) continue;
      const col = inside.filter(m => Math.abs(m.x - n.x) <= n.width * 0.6);
      col.forEach(m => vassigned.add(m.id));
      cols.push(col);
    }

    let totalVShift = 0;
    for (const col of cols) {
      if (col.length < 2) continue;
      col.sort((a, b) => a.y - b.y);

      for (let i = 1; i < col.length; i++) {
        const prev = col[i - 1];
        const curr = col[i];
        const gap = (curr.y - curr.height / 2) - (prev.y + prev.height / 2);
        if (gap < MIN_V_GAP) {
          const shift = MIN_V_GAP - gap;
          for (let j = i; j < col.length; j++) col[j].y += shift;
          totalVShift += shift;
        }
      }
    }

    // Expand the cluster to contain the moved nodes (with original padding)
    if (totalHShift > 0 || totalVShift > 0) {
      const clusterNode = clusters.find(c => c.id === cluster.id)!;
      clusterNode.width  += totalHShift;
      clusterNode.height += totalVShift;
      // Shift the cluster centre so the left/top edges stay fixed
      clusterNode.x += totalHShift / 2;
      clusterNode.y += totalVShift / 2;
    }
  }

  return [...clusters, ...moved];
};

// ── Regen edge paths with obstacle-avoidance routing ─────────────────────────

/**
 * Tests whether the line segment (ax,ay)→(bx,by) passes through the axis-
 * aligned rectangle [rxMin,rxMax] × [ryMin,ryMax].
 * Uses the Liang–Barsky parametric clipping algorithm.
 */
const segmentIntersectsRect = (
  ax: number, ay: number, bx: number, by: number,
  rxMin: number, ryMin: number, rxMax: number, ryMax: number,
): boolean => {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0; // parallel: inside only if q≥0
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else        { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };

  return clip(-dx, ax - rxMin) &&
         clip( dx, rxMax - ax) &&
         clip(-dy, ay - ryMin) &&
         clip( dy, ryMax - ay) &&
         t0 < t1;
};

/**
 * Replaces Mermaid's original curved/routed C4 edge paths with clean paths
 * computed from the (post-expansion) node positions:
 *
 * - If the straight centre-to-centre line is unobstructed → `M … L …`
 * - If it passes through an intermediate node → `M … Q cpx cpy … L …`
 *   (quadratic Bézier whose control point is displaced perpendicularly just
 *   enough to clear every blocking node's bounding box + 20 px margin).
 *
 * Combined with snapC4EdgesToNodes + borderPoint in drawEdge the arrowheads
 * sit precisely at node borders and the visible path never cuts through nodes.
 *
 * Call this AFTER expandC4NodeSpacing so the node positions are final.
 */
export const regenC4EdgePaths = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  const nodeMap     = new Map(nodes.map(n => [n.id, n]));
  const regularNodes = nodes.filter(n => n.type !== 'cluster');
  const MARGIN      = 20; // px clearance around obstacles

  return edges.map(edge => {
    const from = edge.fromNodeId ? nodeMap.get(edge.fromNodeId) : null;
    const to   = edge.toNodeId   ? nodeMap.get(edge.toNodeId)   : null;
    if (!from || !to) return edge;

    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < 1) return edge;

    // ── Find obstacles ──────────────────────────────────────────────────────
    const obstacles = regularNodes.filter(n => {
      if (n.id === from.id || n.id === to.id) return false;
      return segmentIntersectsRect(
        from.x, from.y, to.x, to.y,
        n.x - n.width  / 2 - MARGIN,
        n.y - n.height / 2 - MARGIN,
        n.x + n.width  / 2 + MARGIN,
        n.y + n.height / 2 + MARGIN,
      );
    });

    if (obstacles.length === 0) {
      return { ...edge, pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}` };
    }

    // ── Compute Bézier control point to route around all obstacles ──────────
    //
    // The perpendicular unit vector is ux,uy (90° CCW from the from→to direction).
    // We project each obstacle's bounding-box corners onto that axis relative to
    // the segment midpoint, then choose the direction (± ux,uy) that requires
    // the smallest displacement to clear everything.
    //
    // Because a quadratic Bézier's apex at t=0.5 lies at (from + 2·CP + to)/4,
    // the actual curve offset at the midpoint equals (CP − mid) / 2.
    // So we supply a CP that is 2× the required clearance from the midpoint.

    const dx = to.x - from.x, dy = to.y - from.y;
    const ux = -dy / len,      uy =  dx / len; // perp unit vector (CCW)
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    let needPlus  = 0; // displacement required in +perp direction to clear all obstacles
    let needMinus = 0; // displacement required in −perp direction

    for (const obs of obstacles) {
      const corners: [number, number][] = [
        [obs.x - obs.width / 2 - MARGIN, obs.y - obs.height / 2 - MARGIN],
        [obs.x + obs.width / 2 + MARGIN, obs.y - obs.height / 2 - MARGIN],
        [obs.x - obs.width / 2 - MARGIN, obs.y + obs.height / 2 + MARGIN],
        [obs.x + obs.width / 2 + MARGIN, obs.y + obs.height / 2 + MARGIN],
      ];
      const perps = corners.map(([cx, cy]) =>
        (cx - mid.x) * ux + (cy - mid.y) * uy
      );
      needPlus  = Math.max(needPlus,   Math.max(...perps));
      needMinus = Math.max(needMinus, -Math.min(...perps));
    }

    // Choose the direction that requires the smaller detour
    const disp = needPlus <= needMinus ? needPlus : -needMinus;

    // CP is 2× the midpoint offset so the bezier arc actually clears the obstacles
    const cpx = mid.x + ux * disp * 2;
    const cpy = mid.y + uy * disp * 2;

    return {
      ...edge,
      pathD: `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`,
    };
  });
};

// ── Node type / description labels ───────────────────────────────────────────

/**
 * Extracts the type label (e.g. <<person>>, <<system>>) and description text
 * from each C4 element, using their actual SVG positions for accurate placement.
 *
 * The bold name text is already rendered as the node label by drawNode, so
 * only non-bold text elements are emitted here.
 */
export const parseC4NodeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.person-man').forEach(g => {
    // Person nodes (have <image>): render non-bold text (<<person>>, description)
    // at SVG positions. Bold name is drawn directly in the c4Person canvas block
    // so it stays anchored below the icon figure.
    // Non-person nodes: skip bold name (drawNodeLabel handles it).
    Array.from(g.querySelectorAll<SVGTextElement>('text')).forEach(t => {
      const text = t.textContent?.trim() ?? '';
      if (!text) return;

      const style = window.getComputedStyle(t);
      const fw = parseFloat(style.fontWeight) || 400;
      const isBold = fw >= 600;

      // Skip bold name for all nodes: non-person nodes use drawNodeLabel,
      // person nodes draw the name in the canvas c4Person block.
      if (isBold) return;

      try {
        const bbox = (t as SVGGraphicsElement).getBBox();
        if (bbox.width <= 0) return;
        const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
        const cx = tx + bbox.x + bbox.width  / 2;
        const cy = ty + bbox.y + bbox.height / 2;

        const isItalic = style.fontStyle === 'italic';
        const fontSize = Math.min(parseFloat(style.fontSize) || 11, 14);
        const color = isBold
          ? 'rgba(255,255,255,1)'
          : isItalic
            ? 'rgba(255,255,255,0.65)'
            : 'rgba(255,255,255,0.9)';

        labels.push({
          x: cx,
          y: cy,
          text,
          fontSize,
          bold: isBold,
          color,
          align: 'center',
        });
      } catch {
        // skip unmeasurable elements
      }
    });
  });

  return labels;
};

// ── Edge labels ───────────────────────────────────────────────────────────────

/**
 * Parses text labels attached to C4 relationship lines.
 *
 * Excludes:
 * - Text inside g.person-man (element titles / descriptions)
 * - Text inside boundary groups (boundary titles already shown on cluster nodes)
 */
export const parseC4EdgeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGTextElement>('text').forEach(t => {
    if (insidePersonMan(t)) return;
    if (insideBoundaryGroup(t)) return;

    const text = t.textContent?.trim() ?? '';
    if (!text) return;

    try {
      const bbox = (t as SVGGraphicsElement).getBBox();
      if (bbox.width <= 0) return;
      const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
      const cx = tx + bbox.x + bbox.width  / 2;
      const cy = ty + bbox.y + bbox.height / 2;
      const tStyle = window.getComputedStyle(t);
      const isItalic = tStyle.fontStyle === 'italic';
      const isBold = parseFloat(tStyle.fontWeight) >= 600;
      const fontSize = Math.min(parseFloat(tStyle.fontSize) || 11, 20);
      labels.push({
        x: cx,
        y: cy,
        text,
        fontSize,
        bold: isBold,
        color: isItalic ? '#888888' : '#333333',
        align: 'center',
        bgColor: 'rgba(255,255,255,0.85)',
      });
    } catch {
      // skip elements that can't be measured (e.g. hidden)
    }
  });

  return labels;
};
