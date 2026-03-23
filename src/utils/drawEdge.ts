import type { DiagramEdge, DiagramNode } from '../types';
import { getPathEnd, getPathStart, tokenisePath } from './pathUtils';
import { drawArrowMarker, markerSetback } from './arrowMarkers';

export const drawEdge = (
  ctx: CanvasRenderingContext2D,
  edge: DiagramEdge,
  isPremium: boolean,
  _nodes: DiagramNode[] = [],
) => {
  const edgeColor = isPremium
    ? (edge.type === 'structural' ? '#cbd5e1' : '#64748b')
    : (edge.type === 'structural' && (!edge.stroke || edge.stroke === 'none') ? '#333' : edge.stroke);

  const markerBg = isPremium ? '#f8fafc' : '#ffffff';

  const rawEnd   = getPathEnd(edge.pathD);
  const rawStart = getPathStart(edge.pathD);

  const tipEnd   = rawEnd   ? { ...rawEnd } : null;
  const tipStart = rawStart ? { ...rawStart } : null;

  // Snap markers to box border — push tip outward so canvas marker sits flush
  const MARKER_OVERHANG = 15;
  if (tipEnd && (edge.arrowEnd && edge.arrowEnd !== 'none')) {
    tipEnd.x += Math.cos(tipEnd.angle) * MARKER_OVERHANG;
    tipEnd.y += Math.sin(tipEnd.angle) * MARKER_OVERHANG;
  }
  if (tipStart && (edge.arrowStart && edge.arrowStart !== 'none')) {
    tipStart.x += Math.cos(tipStart.angle) * MARKER_OVERHANG;
    tipStart.y += Math.sin(tipStart.angle) * MARKER_OVERHANG;
  }

  // Shorten the drawn path so the line stops just before the arrowhead
  const segs = tokenisePath(edge.pathD);

  const isNearlyHorizontal = rawStart && rawEnd &&
    Math.abs(rawEnd.y - rawStart.y) < 1.5;

  if (tipEnd && segs.length > 0) {
    const setback = (edge.arrowEnd && edge.arrowEnd !== 'none')
      ? markerSetback(edge.arrowEnd)
      : (edge.hasArrow && !edge.arrowStart ? markerSetback('default') : 0);
    if (setback > 0) {
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
