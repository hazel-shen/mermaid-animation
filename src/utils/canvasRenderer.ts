import type { DiagramNode, DiagramEdge, SeqLabel, Transform } from '../types';
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
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px Inter';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - height / 2 - 4);
    ctx.textBaseline = 'middle';
  } else if (isStepNum) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, Math.min(12, width * 0.55))}px Inter`;
    ctx.fillText(label, x, y);
  } else {
    ctx.fillStyle = '#000000';
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
 * Extracts the arrow tip position and approach angle from an SVG path string.
 * Handles M/L (straight lines) and C (cubic bezier, used by Mermaid curve:'basis').
 * For a cubic bezier "C cx1 cy1 cx2 cy2 ex ey", the tangent at the endpoint
 * is from (cx2,cy2) → (ex,ey).
 */
const getArrowTip = (pathD: string): { x2: number; y2: number; angle: number } | null => {
  // Tokenise the path into commands + coordinate groups
  const segments = pathD.trim().match(/[MLCQTSAZ][^MLCQTSAZ]*/gi);
  if (!segments || segments.length < 2) return null;

  const last = segments[segments.length - 1].trim();
  const cmd = last[0].toUpperCase();
  const nums = last.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

  // Find the second-to-last endpoint for direction reference
  const prev = segments[segments.length - 2].trim();
  const prevCmd = prev[0].toUpperCase();
  const prevNums = prev.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

  let x2: number, y2: number, x1: number, y1: number;

  if (cmd === 'C' && nums.length >= 6) {
    // C cx1 cy1 cx2 cy2 ex ey  — use last control point as direction source
    x2 = nums[nums.length - 2];
    y2 = nums[nums.length - 1];
    x1 = nums[nums.length - 4]; // second control point
    y1 = nums[nums.length - 3];
  } else if (cmd === 'L' && nums.length >= 2) {
    x2 = nums[nums.length - 2];
    y2 = nums[nums.length - 1];
    // direction from previous segment endpoint
    if (prevCmd === 'C' && prevNums.length >= 6) {
      x1 = prevNums[prevNums.length - 2];
      y1 = prevNums[prevNums.length - 1];
    } else if (prevNums.length >= 2) {
      x1 = prevNums[prevNums.length - 2];
      y1 = prevNums[prevNums.length - 1];
    } else {
      return null;
    }
  } else if (cmd === 'M' && nums.length >= 2 && segments.length >= 2) {
    // Fallback: treat last M as endpoint
    x2 = nums[nums.length - 2];
    y2 = nums[nums.length - 1];
    if (prevNums.length >= 2) {
      x1 = prevNums[prevNums.length - 2];
      y1 = prevNums[prevNums.length - 1];
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (Math.hypot(x2 - x1, y2 - y1) < 0.5) return null;
  return { x2, y2, angle: Math.atan2(y2 - y1, x2 - x1) };
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

  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 2;

  if (edge.dash) ctx.setLineDash(edge.dash);
  else if (edge.type === 'structural') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.stroke(p);

  if (edge.hasArrow) {
    ctx.setLineDash([]);
    const tip = getArrowTip(edge.pathD);
    if (tip) {
      const { x2, y2, angle } = tip;
      const size = 10;
      ctx.fillStyle = edgeColor;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - size * Math.cos(angle - 0.4), y2 - size * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - size * Math.cos(angle + 0.4), y2 - size * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
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
