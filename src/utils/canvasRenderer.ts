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

  if (isHovered) {
    ctx.shadowColor = particleColor;
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 0;
  } else if (premium && node.type !== 'cluster') {
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

  ctx.fillStyle = node.type === 'cluster' ? '#334155' : '#000000';
  ctx.font = node.type === 'cluster' ? 'bold 11px Inter' : 'bold 14px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (node.type === 'cluster') {
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - height / 2 - 4);
    ctx.textBaseline = 'middle';
  } else {
    const lines = label.split('\n');
    const lh = 16;
    const totalH = lines.length * lh;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  }
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
    const coordRe = /[ML]\s*([-\d.]+)\s+([-\d.]+)/gi;
    const pts: [number, number][] = [];
    let m: RegExpExecArray | null;
    const pd = edge.pathD;
    while ((m = coordRe.exec(pd)) !== null) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
    if (pts.length >= 2) {
      const [x2, y2] = pts[pts.length - 1];
      const [x1, y1] = pts[pts.length - 2];
      const angle = Math.atan2(y2 - y1, x2 - x1);
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

  // Render normal nodes + notes on top
  const normalNodes = nodes
    .filter(n => n.type !== 'cluster')
    .sort((a, _b) => (a.type === 'note' ? 1 : 0));
  normalNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

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
