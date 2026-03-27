import type { DiagramEdge, DiagramNode } from '../types';
import { getPathEnd, getPathStart, tokenisePath } from './pathUtils';
import { drawArrowMarker, markerSetback } from './arrowMarkers';

/**
 * Projects outward from the node centre along `angle` and returns the exact
 * intersection with the node's bounding border.
 * - cloud/bang: ellipse border (rx = w/2, ry = h/2)
 * - circle:     circle border
 * - others:     rectangle border
 */
const borderPoint = (angle: number, node: DiagramNode): { x: number; y: number } => {
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
) => {
  const edgeColor = isPremium
    ? (edge.type === 'structural' ? '#cbd5e1' : '#64748b')
    : (edge.type === 'structural' && (!edge.stroke || edge.stroke === 'none') ? '#333' : edge.stroke);

  const markerBg = isPremium ? '#f8fafc' : '#ffffff';

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
    const dirAngle = Math.atan2(tipEnd.y - toNode.y, tipEnd.x - toNode.x);
    const bp = borderPoint(dirAngle, toNode);
    tipEnd.x = bp.x;
    tipEnd.y = bp.y;
    // ER fan markers: tips spread ±T perpendicular to the path.
    // On diagonal edges they can protrude past an adjacent border edge.
    // Retreat tipEnd outward by T×sin(θ) where θ = angle between the path
    // and the hit border's normal (= path angle from the border's perpendicular).
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
    const dirAngle = Math.atan2(tipStart.y - fromNode.y, tipStart.x - fromNode.x);
    const bp = borderPoint(dirAngle, fromNode);
    tipStart.x = bp.x;
    tipStart.y = bp.y;
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
    if (setback > 0) {
      // Line endpoint for setback: start from snapped tipEnd (border point)
      const sbx = tipEnd.x - Math.cos(tipEnd.angle) * setback;
      const sby = isNearlyHorizontal ? tipEnd.y : tipEnd.y - Math.sin(tipEnd.angle) * setback;
      const lastSeg = segs[segs.length - 1]!;
      if (lastSeg.trimStart().toUpperCase().startsWith('L')) {
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
  ctx.lineWidth = 1.5;

  if (edge.dash) ctx.setLineDash(edge.dash);
  else if (edge.type === 'structural') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.stroke(new Path2D(drawnPathD));
  ctx.setLineDash([]);

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
