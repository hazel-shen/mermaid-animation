import type { DiagramNode, DiagramEdge, SeqLabel, Transform, ArrowMarker } from '../types';
import { Particle } from './particle';

export const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const bigW = w * 2;
  const bigH = h * 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -bigW; x <= bigW; x += 40) { ctx.moveTo(x, -bigH); ctx.lineTo(x, bigH); }
  for (let y = -bigH; y <= bigH; y += 40) { ctx.moveTo(-bigW, y); ctx.lineTo(bigW, y); }
  ctx.stroke();
};

/**
 * Parses a CSS color string (hex, rgb, rgba, named) and returns perceived
 * luminance in [0, 1]. Returns 1 (light) for unrecognised formats.
 */
const getLuminance = (colorStr: string): number => {
  if (!colorStr || colorStr === 'none' || colorStr === 'transparent') return 1;

  let r = 255, g = 255, b = 255;

  // rgb(a)(...)
  const rgbMatch = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    r = parseFloat(rgbMatch[1]);
    g = parseFloat(rgbMatch[2]);
    b = parseFloat(rgbMatch[3]);
  } else {
    // hex
    let hex = colorStr.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }

  // Relative luminance (WCAG formula)
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

export const drawNode = (
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  premium: boolean,
  hoveredId: string | null,
  particleColor: string
) => {
  const { x, y, width, height, color, stroke, shape, label } = node;
  const isHovered = node.id === hoveredId;

  const isStepNum = node.id.startsWith('stepNum-');

  if (isHovered && !isStepNum) {
    ctx.shadowColor = particleColor;
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 0;
  } else if (premium && node.type !== 'cluster' && !isStepNum) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  if (node.type === 'cluster') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(x, y - height / 2);
    ctx.lineTo(x + width / 2, y);
    ctx.lineTo(x, y + height / 2);
    ctx.lineTo(x - width / 2, y);
    ctx.closePath();
  } else if (shape === 'note') {
    const fold = 10;
    ctx.moveTo(x - width / 2, y - height / 2);
    ctx.lineTo(x + width / 2 - fold, y - height / 2);
    ctx.lineTo(x + width / 2, y - height / 2 + fold);
    ctx.lineTo(x + width / 2, y + height / 2);
    ctx.lineTo(x - width / 2, y + height / 2);
    ctx.closePath();
  } else {
    const r = node.type === 'cluster' ? 16 : 4;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  }
  ctx.fill();
  ctx.stroke();

  if (isHovered) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = particleColor;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (node.type === 'cluster') {
    ctx.fillStyle = getLuminance(color) < 0.35 ? '#f1f5f9' : '#334155';
    ctx.font = 'bold 11px Inter';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - height / 2 - 4);
    ctx.textBaseline = 'middle';
  } else if (isStepNum) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, Math.min(12, width * 0.55))}px Inter`;
    ctx.fillText(label, x, y);
  } else if (node.classLines && node.classLines.length > 0) {
    drawClassNode(ctx, node, color, stroke);
  } else {
    ctx.fillStyle = getLuminance(color) < 0.35 ? '#f1f5f9' : '#1e293b';
    ctx.font = 'bold 14px Inter';
    const lines = label.split('\n');
    const lh = 16;
    const totalH = lines.length * lh;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  }
};

/**
 * Renders the interior text of a class-diagram node:
 * bold title row, horizontal divider lines, and member rows.
 */
const drawClassNode = (
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  bgColor: string,
  strokeColor: string,
) => {
  const { x, y, width, height, classLines = [] } = node;

  const textColor = getLuminance(bgColor) < 0.35 ? '#f1f5f9' : '#1e293b';
  const dividerColor = strokeColor;

  const TITLE_FONT_SIZE = 13;
  const MEMBER_FONT_SIZE = 11;
  const LINE_H = 15;        // row height for member lines
  const TITLE_H = 18;       // row height for title / annotation rows
  const DIV_PAD = 4;        // vertical padding around dividers
  const H_PAD = 6;          // horizontal text padding from edge

  // ── First pass: measure total content height ───────────────────────
  let totalContentH = 0;
  for (const cl of classLines) {
    if (cl.divider) {
      totalContentH += DIV_PAD * 2 + 1;
    } else if (cl.bold) {
      totalContentH += TITLE_H;
    } else {
      totalContentH += LINE_H;
    }
  }

  // ── Second pass: render ────────────────────────────────────────────
  let curY = y - totalContentH / 2;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxTextWidth = width - H_PAD * 2;

  for (const cl of classLines) {
    if (cl.divider) {
      curY += DIV_PAD;
      ctx.beginPath();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.moveTo(x - width / 2, curY);
      ctx.lineTo(x + width / 2, curY);
      ctx.stroke();
      curY += DIV_PAD + 1;
    } else if (cl.bold) {
      ctx.fillStyle = textColor;
      ctx.font = `bold ${TITLE_FONT_SIZE}px Inter, sans-serif`;
      const truncated = truncateText(ctx, cl.text, maxTextWidth);
      // Centre the title
      ctx.textAlign = 'center';
      ctx.fillText(truncated, x, curY + (TITLE_H - TITLE_FONT_SIZE) / 2);
      ctx.textAlign = 'left';
      curY += TITLE_H;
    } else {
      ctx.fillStyle = textColor;
      ctx.font = `${MEMBER_FONT_SIZE}px Inter, sans-serif`;
      const truncated = truncateText(ctx, cl.text, maxTextWidth);
      ctx.fillText(truncated, x - width / 2 + H_PAD, curY + (LINE_H - MEMBER_FONT_SIZE) / 2);
      curY += LINE_H;
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
};

/** Truncate text with ellipsis so it fits within maxWidth pixels. */
const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  const ellipsis = '…';
  const ellW = ctx.measureText(ellipsis).width;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (ctx.measureText(text.slice(0, mid)).width + ellW <= maxWidth) lo = mid;
    else hi = mid;
  }
  return text.slice(0, lo) + ellipsis;
};

// ── Path endpoint extraction ───────────────────────────────────────────────

/** Parse a path segment into its command char and numeric arguments. */
const parseSegment = (seg: string): { cmd: string; nums: number[] } => {
  const cmd = seg[0].toUpperCase();
  const nums = seg.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  return { cmd, nums };
};

/** Tokenise a path `d` string into its segments. */
const tokenisePath = (d: string) =>
  (d.trim().match(/[MLCQTSAZ][^MLCQTSAZ]*/gi) || []);

/**
 * Returns the LAST point of the path and the tangent direction approaching it.
 * angle points FROM the penultimate point TOWARD the endpoint (i.e. the arrow tip angle).
 */
const getPathEnd = (pathD: string): { x: number; y: number; angle: number } | null => {
  const segs = tokenisePath(pathD);
  if (segs.length < 2) return null;

  const { cmd, nums } = parseSegment(segs[segs.length - 1]);
  const { cmd: pc, nums: pn } = parseSegment(segs[segs.length - 2]);

  let ex: number, ey: number, dx: number, dy: number;

  if (cmd === 'C' && nums.length >= 6) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    dx = ex - nums[nums.length - 4]; dy = ey - nums[nums.length - 3];
  } else if (cmd === 'L' && nums.length >= 2) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    const pEnd = pc === 'C' && pn.length >= 6
      ? { x: pn[pn.length - 2], y: pn[pn.length - 1] }
      : pn.length >= 2 ? { x: pn[pn.length - 2], y: pn[pn.length - 1] } : null;
    if (!pEnd) return null;
    dx = ex - pEnd.x; dy = ey - pEnd.y;
  } else if (cmd === 'M' && nums.length >= 2) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    if (pn.length < 2) return null;
    dx = ex - pn[pn.length - 2]; dy = ey - pn[pn.length - 1];
  } else {
    return null;
  }

  if (Math.hypot(dx, dy) < 0.5) return null;
  return { x: ex, y: ey, angle: Math.atan2(dy, dx) };
};

/**
 * Returns the FIRST point of the path and the tangent direction leaving it
 * (angle points FROM the start TOWARD the second point — reversed for drawing).
 */
const getPathStart = (pathD: string): { x: number; y: number; angle: number } | null => {
  const segs = tokenisePath(pathD);
  if (segs.length < 2) return null;

  const { cmd: c0, nums: n0 } = parseSegment(segs[0]);
  const { cmd: c1, nums: n1 } = parseSegment(segs[1]);

  if (c0 !== 'M' || n0.length < 2) return null;
  const sx = n0[0], sy = n0[1];

  let nx: number, ny: number;
  if (c1 === 'L' && n1.length >= 2) {
    nx = n1[0]; ny = n1[1];
  } else if (c1 === 'C' && n1.length >= 6) {
    // first control point gives tangent direction
    nx = n1[0]; ny = n1[1];
  } else if (n1.length >= 2) {
    nx = n1[0]; ny = n1[1];
  } else {
    return null;
  }

  const dx = nx - sx, dy = ny - sy;
  if (Math.hypot(dx, dy) < 0.5) return null;
  // angle points FROM start toward inside — for a start arrow we reverse
  return { x: sx, y: sy, angle: Math.atan2(dy, dx) + Math.PI };
};

// ── Arrow shape drawing ────────────────────────────────────────────────────

const drawArrowMarker = (
  ctx: CanvasRenderingContext2D,
  marker: ArrowMarker,
  x: number,
  y: number,
  angle: number,
  color: string,
  bgColor: string,
) => {
  if (marker === 'none') return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  switch (marker) {
    case 'extension': {
      // Hollow equilateral triangle pointing in arrow direction
      const S = 14, H = S * 0.87;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-H, -S / 2);
      ctx.lineTo(-H,  S / 2);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'composition': {
      // Filled diamond
      const L = 10, W = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-L,  W);
      ctx.lineTo(-L * 2, 0);
      ctx.lineTo(-L, -W);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'aggregation': {
      // Hollow diamond
      const L = 10, W = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-L,  W);
      ctx.lineTo(-L * 2, 0);
      ctx.lineTo(-L, -W);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'dependency': {
      // Open arrow (two lines, no fill)
      const S = 10;
      ctx.beginPath();
      ctx.moveTo(-S * Math.cos(-0.45), -S * Math.sin(-0.45));
      ctx.lineTo(0, 0);
      ctx.lineTo(-S * Math.cos(0.45), -S * Math.sin(0.45));
      ctx.stroke();
      break;
    }
    default: {
      // Generic filled triangle
      const size = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size * Math.cos(-0.4), -size * Math.sin(-0.4));
      ctx.lineTo(-size * Math.cos(0.4), -size * Math.sin(0.4));
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
};

export const drawEdge = (
  ctx: CanvasRenderingContext2D,
  edge: DiagramEdge,
  isPremium: boolean
) => {
  const p = new Path2D(edge.pathD);
  const edgeColor = isPremium
    ? (edge.type === 'structural' ? '#cbd5e1' : '#64748b')
    : (edge.type === 'structural' && (!edge.stroke || edge.stroke === 'none') ? '#333' : edge.stroke);

  // Background colour used to hollow-out markers (matches canvas background)
  const markerBg = isPremium ? '#f8fafc' : '#ffffff';

  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1.5;

  if (edge.dash) ctx.setLineDash(edge.dash);
  else if (edge.type === 'structural') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.stroke(p);
  ctx.setLineDash([]);

  // ── Arrow at END of path (marker-end) ──
  if (edge.arrowEnd && edge.arrowEnd !== 'none') {
    const tip = getPathEnd(edge.pathD);
    if (tip) drawArrowMarker(ctx, edge.arrowEnd, tip.x, tip.y, tip.angle, edgeColor, markerBg);
  } else if (edge.hasArrow && !edge.arrowStart) {
    // Fallback: generic filled triangle at end
    const tip = getPathEnd(edge.pathD);
    if (tip) drawArrowMarker(ctx, 'default', tip.x, tip.y, tip.angle, edgeColor, markerBg);
  }

  // ── Arrow at START of path (marker-start) ──
  if (edge.arrowStart && edge.arrowStart !== 'none') {
    const start = getPathStart(edge.pathD);
    if (start) drawArrowMarker(ctx, edge.arrowStart, start.x, start.y, start.angle, edgeColor, markerBg);
  }
};

export interface RenderFrameOptions {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  particles: Particle[];
  seqLabels: SeqLabel[];
  isPremium: boolean;
  particleColor: string;
  isRecording: boolean;
  hoveredNodeId: string | null;
}

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tr: Transform,
  offset: { x: number; y: number },
  showRec: boolean,
  opts: RenderFrameOptions
) => {
  const { nodes, edges, particles, seqLabels, isPremium, particleColor, hoveredNodeId } = opts;

  ctx.fillStyle = isPremium ? '#f8fafc' : '#fff';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(tr.x, tr.y);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(offset.x, offset.y);

  if (isPremium) drawGrid(ctx, w, h);

  // Render clusters first (background layer)
  const clusterNodes = nodes.filter(n => n.type === 'cluster');
  clusterNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Render edges (structural first, then link)
  const sortedEdges = [...edges].sort((a, _b) => (a.type === 'structural' ? -1 : 1));
  sortedEdges.forEach(edge => drawEdge(ctx, edge, isPremium));
  ctx.setLineDash([]);

  // Render particles (link edges only, premium mode)
  if (isPremium) {
    ctx.globalCompositeOperation = 'multiply';
    particles.forEach(p => {
      const pos = p.getPosition();
      if (pos.x === 0 && pos.y === 0) return;
      ctx.shadowBlur = 4;
      ctx.shadowColor = particleColor;
      ctx.fillStyle = particleColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
  }

  // Render normal nodes + notes on top (step numbers last so they're always visible)
  const normalNodes = nodes
    .filter(n => n.type !== 'cluster' && !n.id.startsWith('stepNum-'))
    .sort((a, _b) => (a.type === 'note' ? 1 : 0));
  normalNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Step number circles always on top
  nodes.filter(n => n.id.startsWith('stepNum-')).forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Render floating sequence labels
  if (seqLabels.length > 0) {
    ctx.shadowBlur = 0;
    seqLabels.forEach(lbl => {
      ctx.font = `${lbl.bold ? 'bold ' : ''}${lbl.fontSize}px Inter, sans-serif`;
      ctx.fillStyle = lbl.color;
      ctx.textAlign = lbl.align;
      ctx.textBaseline = 'top';
      ctx.fillText(lbl.text, lbl.x, lbl.y);
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  ctx.restore();

  if (showRec) {
    ctx.fillStyle = 'rgba(220,38,38,0.9)';
    ctx.font = 'bold 18px Inter';
    ctx.fillText('● REC', 24, 36);
  }
};
