import type { DiagramEdge, DiagramNode } from '../types';
import { getPathEnd, getPathStart, tokenisePath } from './pathUtils';
import { drawArrowMarker, markerSetback } from './arrowMarkers';
import { getLuminance } from './colorUtils';

// Cache Path2D objects for Sankey edges — keyed by edge object reference.
// WeakMap ensures entries are automatically GC'd when edges are replaced after re-parse.
const _sankeyPath2DCache = new WeakMap<DiagramEdge, Path2D>();

// Cache CanvasGradient for Sankey edges. CanvasGradient is ctx-specific, so we store
// the ctx reference alongside; if the ctx changes (e.g. export canvas), we recreate.
type GradientCache = { ctx: CanvasRenderingContext2D; bandColor: CanvasGradient | string };
const _sankeyGradientCache = new WeakMap<DiagramEdge, GradientCache>();

/** Ray–convex-polygon intersection. Returns the nearest border point, or null. */
const rayPolyIntersect = (
  cx: number, cy: number, dx: number, dy: number,
  verts: [number, number][],
): { x: number; y: number } | null => {
  let minT = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const [ax, ay] = verts[i];
    const [bx, by] = verts[(i + 1) % verts.length];
    const ex = bx - ax, ey = by - ay;
    const det = dy * ex - dx * ey;
    if (Math.abs(det) < 1e-10) continue;
    const tVal = (ex * (ay - cy) - ey * (ax - cx)) / det;
    const sVal = (dx * (ay - cy) - dy * (ax - cx)) / det;
    if (tVal > 1e-10 && sVal >= -1e-10 && sVal <= 1 + 1e-10) {
      minT = Math.min(minT, tVal);
    }
  }
  return isFinite(minT) ? { x: cx + dx * minT, y: cy + dy * minT } : null;
};

/**
 * Projects outward from the node centre along `angle` and returns the exact
 * intersection with the node's bounding border.
 * - cloud/bang/circle: ellipse border
 * - diamond:           L1-norm border
 * - asymmetric:        pentagon (concave left notch)
 * - parallelogram/trapezoid variants: quadrilateral with skewed edges
 * - others:            rectangle border
 */
export const borderPoint = (angle: number, node: DiagramNode): { x: number; y: number } => {
  const { x: cx, y: cy, width, height, shape } = node;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hw = width  / 2;
  const hh = height / 2;

  if (shape === 'cloud' || shape === 'bang' || shape === 'circle') {
    // Ellipse intersection: t = 1 / sqrt((dx/hw)² + (dy/hh)²)
    const denom = Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
    const t = denom > 0 ? 1 / denom : hw;
    return { x: cx + dx * t, y: cy + dy * t };
  }

  if (shape === 'diamond') {
    // L1-norm intersection: |x/hw| + |y/hh| = 1  →  t = 1 / (|dx|/hw + |dy|/hh)
    const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
    const t = denom > 0 ? 1 / denom : hw;
    return { x: cx + dx * t, y: cy + dy * t };
  }

  if (shape === 'asymmetric') {
    // Pentagon: top-left, top-right, bottom-right, bottom-left, left-notch
    // notch depth matches canvasRenderer: height * 0.45 = hh * 0.9
    const notch = hh * 0.9;
    const l = cx - hw, r2 = cx + hw, t2 = cy - hh, b = cy + hh;
    const pt = rayPolyIntersect(cx, cy, dx, dy, [
      [l,          t2],
      [r2,         t2],
      [r2,         b],
      [l,          b],
      [l + notch,  cy],
    ]);
    if (pt) return pt;
  }

  if (shape === 'parallelogram' || shape === 'parallelogramAlt' ||
      shape === 'trapezoid'     || shape === 'trapezoidAlt') {
    // Quadrilateral with skewed corners; skew matches canvasRenderer: height * 0.3 = hh * 0.6
    const skew = hh * 0.6;
    const l = cx - hw, r2 = cx + hw, t2 = cy - hh, b = cy + hh;
    let tl: number, tr: number, bl: number, br: number;
    if (shape === 'parallelogram') {
      tl = l + skew; tr = r2;        bl = l;        br = r2 - skew;
    } else if (shape === 'parallelogramAlt') {
      tl = l;        tr = r2 - skew; bl = l + skew; br = r2;
    } else if (shape === 'trapezoid') {
      tl = l + skew; tr = r2 - skew; bl = l;        br = r2;
    } else {
      tl = l;        tr = r2;        bl = l + skew; br = r2 - skew;
    }
    const pt = rayPolyIntersect(cx, cy, dx, dy, [
      [tl, t2], [tr, t2], [br, b], [bl, b],
    ]);
    if (pt) return pt;
  }

  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t  = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
};

export const drawEdge = (
  ctx: CanvasRenderingContext2D,
  edge: DiagramEdge,
  isPremium: boolean,
  nodes: DiagramNode[] = [],
  canvasBgMode: 'grid' | 'white' | 'dark' = 'grid',
) => {
  // Sankey flow band: open bezier path rendered as a thick stroked line.
  // Mermaid sankey-beta uses stroke-width (not fill) to represent band thickness.
  // Particles animate along the same path (pathD === sankeyFillPath).
  if (edge.sankeyFillPath) {
    // Build a canvas linear gradient matching the SVG linearGradient (source→target color).
    // Cached per edge+ctx pair — recreated only on first use or when ctx changes (export).
    let bandColor: string | CanvasGradient;
    const cachedGrad = _sankeyGradientCache.get(edge);
    if (cachedGrad && cachedGrad.ctx === ctx) {
      bandColor = cachedGrad.bandColor;
    } else {
      if (edge.sankeyGradient) {
        const allNums = edge.sankeyFillPath.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
        if (allNums && allNums.length >= 2) {
          const x0 = parseFloat(allNums[0]);
          const y0 = parseFloat(allNums[1]);
          const x1 = parseFloat(allNums[allNums.length - 2]);
          const y1 = parseFloat(allNums[allNums.length - 1]);
          const grad = ctx.createLinearGradient(x0, y0, x1, y1);
          grad.addColorStop(0, edge.sankeyGradient[0]);
          grad.addColorStop(1, edge.sankeyGradient[1]);
          bandColor = grad;
        } else {
          bandColor = edge.sankeyGradient[0];
        }
      } else {
        bandColor = (edge.stroke && edge.stroke !== 'none') ? edge.stroke : (isPremium ? '#94a3b8' : '#64748b');
      }
      _sankeyGradientCache.set(edge, { ctx, bandColor });
    }

    let sankeyPath2D = _sankeyPath2DCache.get(edge);
    if (!sankeyPath2D) {
      sankeyPath2D = new Path2D(edge.sankeyFillPath);
      _sankeyPath2DCache.set(edge, sankeyPath2D);
    }

    ctx.save();
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = edge.lineWidth ?? 4;
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.stroke(sankeyPath2D);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  // Resolve edge color:
  // - Bright intentional colors (e.g. gitGraph branch palette) are always used as-is.
  // - Mermaid's default dark stroke (#333 / rgb(51,51,51), luminance < 0.1) is
  //   remapped to theme-appropriate gray so edges never render as near-black.
  // - When no stroke is set at all, fall back to theme gray.
  const hasExplicitStroke = !!(edge.stroke && edge.stroke !== 'none');
  const strokeIsDefaultDark = hasExplicitStroke && getLuminance(edge.stroke!) < 0.1;
  const edgeColor = (hasExplicitStroke && !strokeIsDefaultDark)
    ? edge.stroke!
    : canvasBgMode === 'dark'
      ? (edge.type === 'structural' ? '#94a3b8' : '#a5b4fc')
      : isPremium
        ? (edge.type === 'structural' ? '#cbd5e1' : '#64748b')
        : (edge.type === 'structural' ? '#9ca3af' : '#64748b');

  const markerBg = canvasBgMode === 'dark' ? '#1e1e2e' : (isPremium ? '#f8fafc' : '#ffffff');

  const rawEnd   = getPathEnd(edge.pathD);
  const rawStart = getPathStart(edge.pathD);

  const tipEnd   = rawEnd   ? { ...rawEnd } : null;
  const tipStart = rawStart ? { ...rawStart } : null;

  // When the parser has provided node ids (flowchart edges), snap the arrow
  // marker position to the exact box border. The line path is left unchanged —
  // Mermaid already ends the path at the border, so we only reposition where
  // the arrowhead is drawn.
  // For edges without node ids (class diagram, sequence, etc.) keep the
  // original fixed-overhang behaviour so those markers stay unchanged.
  const toNode   = edge.toNodeId   ? nodes.find(n => n.id === edge.toNodeId)   ?? null : null;
  const fromNode = edge.fromNodeId ? nodes.find(n => n.id === edge.fromNodeId) ?? null : null;

  if (toNode && tipEnd && (edge.arrowEnd || edge.hasArrow)) {
    // borderPoint() projects FROM node centre OUTWARD along `angle`.
    // The arrow arrives at angle `tipEnd.angle`; the outward direction is the reverse.
    // If the raw path endpoint is far enough from the node centre, use the
    // geometric vector for accuracy; otherwise fall back to the path tangent.
    const vecOut = Math.atan2(tipEnd.y - toNode.y, tipEnd.x - toNode.x);
    const dist   = Math.hypot(tipEnd.x - toNode.x, tipEnd.y - toNode.y);
    const outAngle = dist > 3 ? vecOut : tipEnd.angle + Math.PI;
    const bp = borderPoint(outAngle, toNode);
    tipEnd.x = bp.x;
    tipEnd.y = bp.y;
    // Keep angle consistent with the outward direction so the arrowhead
    // points exactly along the approach path into the node border.
    tipEnd.angle = outAngle + Math.PI; // inward = approach direction
  } else if (!toNode && !edge.noSnap) {
    // Legacy path: push tip outward by fixed amount (used by class diagram etc.)
    // noSnap edges (ER) already have their path endpoints at the node border — skip overhang.
    const MARKER_OVERHANG = 15;
    if (tipEnd && (edge.arrowEnd && edge.arrowEnd !== 'none')) {
      tipEnd.x += Math.cos(tipEnd.angle) * MARKER_OVERHANG;
      tipEnd.y += Math.sin(tipEnd.angle) * MARKER_OVERHANG;
    }
  }

  if (fromNode && tipStart && edge.arrowStart && edge.arrowStart !== 'none') {
    const vecOut = Math.atan2(tipStart.y - fromNode.y, tipStart.x - fromNode.x);
    const dist   = Math.hypot(tipStart.x - fromNode.x, tipStart.y - fromNode.y);
    // tipStart.angle already points away from start (reversed in getPathStart),
    // so outward from fromNode is tipStart.angle itself.
    const outAngle = dist > 3 ? vecOut : tipStart.angle;
    const bp = borderPoint(outAngle, fromNode);
    tipStart.x = bp.x;
    tipStart.y = bp.y;
    tipStart.angle = outAngle + Math.PI; // inward for marker drawing
  } else if (!fromNode && !edge.noSnap) {
    const MARKER_OVERHANG = 15;
    if (tipStart && (edge.arrowStart && edge.arrowStart !== 'none')) {
      tipStart.x += Math.cos(tipStart.angle) * MARKER_OVERHANG;
      tipStart.y += Math.sin(tipStart.angle) * MARKER_OVERHANG;
    }
  }

  const segs = tokenisePath(edge.pathD);

  const isNearlyHorizontal = rawStart && rawEnd &&
    Math.abs(rawEnd.y - rawStart.y) < 1.5;

  if (tipEnd && segs.length > 0) {
    const setback = (edge.arrowEnd && edge.arrowEnd !== 'none')
      ? markerSetback(edge.arrowEnd)
      : (edge.hasArrow && !edge.arrowStart ? markerSetback('default') : 0);
    // When we have a toNode, always snap the path endpoint to the border
    // (minus setback) regardless of whether the last segment is L or C.
    const shouldSnapEnd = toNode != null;
    if (setback > 0 || shouldSnapEnd) {
      const totalSetback = setback > 0 ? setback : 0;
      const sbx = tipEnd.x - Math.cos(tipEnd.angle) * totalSetback;
      const sby = isNearlyHorizontal ? tipEnd.y : tipEnd.y - Math.sin(tipEnd.angle) * totalSetback;
      const lastSeg = segs[segs.length - 1]!;
      const lastCmd = lastSeg.trimStart()[0].toUpperCase();
      if (lastCmd === 'L') {
        segs[segs.length - 1] = `L ${sbx} ${sby}`;
      } else if (lastCmd === 'C' && shouldSnapEnd) {
        // For curves ending at node centre: replace with a line to the border point.
        // This avoids the curve visually piercing through the node shape.
        segs[segs.length - 1] = `L ${sbx} ${sby}`;
      }
    }
  }

  if (tipStart && segs.length > 0) {
    const setback = (edge.arrowStart && edge.arrowStart !== 'none')
      ? markerSetback(edge.arrowStart) : 0;
    if (setback > 0) {
      const sbx = tipStart.x - Math.cos(tipStart.angle) * setback;
      const sby = isNearlyHorizontal ? tipStart.y : tipStart.y - Math.sin(tipStart.angle) * setback;
      segs[0] = `M ${sbx} ${sby}`;
    }
  }

  const drawnPathD = segs.length > 0 ? segs.join(' ') : edge.pathD;

  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = edge.lineWidth ?? 1.5;

  if (edge.dash) ctx.setLineDash(edge.dash);
  else if (edge.type === 'structural') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  // When an edge enters or exits a composite-state cluster, clip the drawn path
  // at the cluster's rectangle border so lines never visually enter the box.
  const needsClip = (toNode?.type === 'cluster') || (fromNode?.type === 'cluster');
  if (needsClip) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-100000, -100000, 200000, 200000); // entire canvas
    if (toNode?.type === 'cluster') {
      ctx.rect(toNode.x - toNode.width / 2, toNode.y - toNode.height / 2, toNode.width, toNode.height);
    }
    if (fromNode?.type === 'cluster') {
      ctx.rect(fromNode.x - fromNode.width / 2, fromNode.y - fromNode.height / 2, fromNode.width, fromNode.height);
    }
    ctx.clip('evenodd'); // cluster interior is excluded from the clip region
  }

  ctx.stroke(new Path2D(drawnPathD));
  ctx.setLineDash([]);

  if (needsClip) ctx.restore(); // restore before drawing arrow markers (markers are not clipped)

  // Arrow markers
  if (edge.arrowEnd && edge.arrowEnd !== 'none' && tipEnd) {
    drawArrowMarker(ctx, edge.arrowEnd, tipEnd.x, tipEnd.y, tipEnd.angle, edgeColor, markerBg);
  } else if (edge.hasArrow && !edge.arrowStart && tipEnd) {
    drawArrowMarker(ctx, 'default', tipEnd.x, tipEnd.y, tipEnd.angle, edgeColor, markerBg);
  }

  if (edge.arrowStart && edge.arrowStart !== 'none' && tipStart) {
    drawArrowMarker(ctx, edge.arrowStart, tipStart.x, tipStart.y, tipStart.angle, edgeColor, markerBg);
  }
};
