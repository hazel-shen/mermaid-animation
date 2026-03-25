import type { DiagramNode, DiagramEdge, SeqLabel, Transform } from '../types';
import { Particle } from './particle';
import { getLuminance } from './colorUtils';
import { drawClassNode } from './drawClassNode';
import { drawEdge } from './drawEdge';
import { drawParticles } from './drawParticles';
import type { ParticleShape } from './drawParticles';

export type { ParticleShape };
export { drawEdge };

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

const drawPieWedge = (
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  premium: boolean,
  hoveredId: string | null,
  particleColor: string,
) => {
  const wedge = node.pieWedge;
  if (!wedge) return;

  const { cx, cy, radius, startAngle, endAngle } = wedge;
  const isHovered = node.id === hoveredId;

  let sweep = endAngle - startAngle;
  if (sweep <= 0) sweep += Math.PI * 2;

  const EXPLODE = 8;
  const midAngle = startAngle + sweep / 2;
  const snapCx = Math.round((cx + (isHovered ? Math.cos(midAngle) * EXPLODE : 0)) * 2) / 2;
  const snapCy = Math.round((cy + (isHovered ? Math.sin(midAngle) * EXPLODE : 0)) * 2) / 2;

  if (isHovered) {
    ctx.shadowColor = particleColor;
    ctx.shadowBlur = 24;
  } else if (premium) {
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.beginPath();
  ctx.moveTo(snapCx, snapCy);
  ctx.arc(snapCx, snapCy, radius, startAngle, endAngle, false);
  ctx.closePath();

  ctx.fillStyle = node.color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = isHovered ? particleColor : node.stroke;
  ctx.lineWidth = isHovered ? 3 : 2;
  ctx.stroke();

  if (node.label) {
    const lx = snapCx + Math.cos(midAngle) * radius * 0.6;
    const ly = snapCy + Math.sin(midAngle) * radius * 0.6;
    ctx.fillStyle = getLuminance(node.color) < 0.35 ? '#f1f5f9' : '#1e293b';
    ctx.font = `bold ${Math.max(10, Math.min(14, radius * 0.14))}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, lx, ly);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
};

const drawNodeLabel = (
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  label: string,
  shape: DiagramNode['shape'],
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  ctx.fillStyle = getLuminance(node.color) < 0.35 ? '#f1f5f9' : '#1e293b';
  const lines = label.split('\n');
  const lh = 16;
  const totalH = lines.length * lh;

  if (shape === 'diamond') {
    ctx.font = 'bold 14px Inter';
    const longestLine = lines.reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    const DRAW_PAD = 32;
    const neededW = ctx.measureText(longestLine).width + DRAW_PAD * 2;
    const dw = Math.max(0, neededW - width);
    const dh = height > 0 ? dw * (height / width) : dw;
    const dW = width  + dw;
    const dH = height + dh;

    let fontSize = 14;
    const hw = dW / 2;
    const hh = dH / 2;
    const TEXT_PAD = 8;
    for (let fs = 14; fs >= 8; fs--) {
      ctx.font = `bold ${fs}px Inter`;
      let fits = true;
      lines.forEach((line, i) => {
        const lineY = -totalH / 2 + i * lh + lh / 2;
        const availW = Math.max(0, hw * (1 - Math.abs(lineY) / hh) - TEXT_PAD) * 2;
        if (ctx.measureText(line).width > availW) fits = false;
      });
      if (fits) { fontSize = fs; break; }
    }
    ctx.font = `bold ${fontSize}px Inter`;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  } else if (shape === 'hexagon') {
    ctx.font = 'bold 14px Inter';
    const longestHex = lines.reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    const HEX_PAD = 20;
    const neededHexW = ctx.measureText(longestHex).width + HEX_PAD * 2 + height;
    const hW = Math.max(width, neededHexW);
    const tip = height / 2;
    const flatW = hW - tip * 2;
    let fontSize = 14;
    for (let fs = 14; fs >= 8; fs--) {
      ctx.font = `bold ${fs}px Inter`;
      const allFit = lines.every(l => ctx.measureText(l).width <= flatW - 8);
      if (allFit) { fontSize = fs; break; }
    }
    ctx.font = `bold ${fontSize}px Inter`;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  } else if (shape === 'note') {
    const PAD_X = 10;
    const maxW = width - PAD_X * 2;
    ctx.font = '12px Inter';
    const actualLh = 15;
    const actualTotalH = lines.length * actualLh;
    const startY = y - actualTotalH / 2 + actualLh / 2;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      let drawn = line;
      if (ctx.measureText(drawn).width > maxW) {
        while (drawn.length > 1 && ctx.measureText(drawn + '…').width > maxW)
          drawn = drawn.slice(0, -1);
        drawn += '…';
      }
      ctx.fillText(drawn, x, startY + i * actualLh);
    });
  } else {
    // roundRect / stadium / subroutine / cylinder / default: word-wrap
    const PAD_X = shape === 'stadium' ? height / 2 + 8 : 12;
    const maxW = width - PAD_X * 2;
    ctx.font = 'bold 14px Inter';

    const wrappedLines: { text: string; bold: boolean }[] = [];
    for (const srcLine of lines) {
      const isBold = srcLine.startsWith('**') && srcLine.endsWith('**');
      const cleanLine = isBold ? srcLine.slice(2, -2) : srcLine;
      ctx.font = isBold ? 'bold 14px Inter' : '13px Inter';

      if (ctx.measureText(cleanLine).width <= maxW) {
        wrappedLines.push({ text: cleanLine, bold: isBold });
      } else {
        const words = cleanLine.split(' ');
        let current = '';
        for (const word of words) {
          const test = current ? current + ' ' + word : word;
          if (ctx.measureText(test).width > maxW && current) {
            wrappedLines.push({ text: current, bold: isBold });
            current = word;
          } else {
            current = test;
          }
        }
        if (current) wrappedLines.push({ text: current, bold: isBold });
      }
    }

    const wLh = 16;
    const wTotalH = wrappedLines.length * wLh;
    wrappedLines.forEach(({ text: wText, bold }, i) => {
      ctx.font = bold ? 'bold 14px Inter' : '13px Inter';
      ctx.fillText(wText, x, y - wTotalH / 2 + i * wLh + wLh / 2);
    });
  }
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
  const isActivation = node.id.startsWith('activation-');

  if (isHovered && !isStepNum && !isActivation) {
    ctx.shadowColor = particleColor;
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 0;
  } else if (premium && node.type !== 'cluster' && !isStepNum && !isActivation) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (shape === 'pie') {
    drawPieWedge(ctx, node, premium, hoveredId, particleColor);
    return;
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  // Flowchart subgraphs use dashed borders; state composite clusters use solid rounded borders
  if (node.type === 'cluster' && node.shape !== 'roundRect') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.beginPath();
  if (shape === 'endCircle') {
    // End state: outer ring + inner filled circle (⊙)
    const r = width / 2;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'transparent';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner filled circle
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    return;
  } else if (shape === 'circle') {
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.font = 'bold 14px Inter';
    const longestLine = label.split('\n').reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    let dW: number, dH: number;
    if (longestLine) {
      const PAD = 32;
      const neededW = ctx.measureText(longestLine).width + PAD * 2;
      const dw = Math.max(0, neededW - width);
      const dh = height > 0 ? dw * (height / width) : dw;
      dW = width  + dw;
      dH = height + dh;
    } else {
      dW = width;
      dH = height;
    }
    ctx.moveTo(x, y - dH / 2);
    ctx.lineTo(x + dW / 2, y);
    ctx.lineTo(x, y + dH / 2);
    ctx.lineTo(x - dW / 2, y);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    ctx.font = 'bold 14px Inter';
    const longestHex = label.split('\n').reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    const HEX_PAD = 20;
    const neededHexW = ctx.measureText(longestHex).width + HEX_PAD * 2 + height;
    const hW = Math.max(width, neededHexW);
    const hH = height;
    const tip = hH / 2;
    const hw = hW / 2, hh = hH / 2;
    ctx.moveTo(x - hw + tip, y - hh);
    ctx.lineTo(x + hw - tip, y - hh);
    ctx.lineTo(x + hw,       y);
    ctx.lineTo(x + hw - tip, y + hh);
    ctx.lineTo(x - hw + tip, y + hh);
    ctx.lineTo(x - hw,       y);
    ctx.closePath();
  } else if (shape === 'stadium') {
    const r = height / 2;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  } else if (shape === 'cylinder') {
    ctx.rect(0, 0, 0, 0);
  } else if (shape === 'subroutine') {
    const r = 4;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  } else if (shape === 'note') {
    const fold = 10;
    ctx.moveTo(x - width / 2, y - height / 2);
    ctx.lineTo(x + width / 2 - fold, y - height / 2);
    ctx.lineTo(x + width / 2, y - height / 2 + fold);
    ctx.lineTo(x + width / 2, y + height / 2);
    ctx.lineTo(x - width / 2, y + height / 2);
    ctx.closePath();
  } else if (shape === 'forkJoin') {
    // Thin solid bar (fork/join pseudostate)
    ctx.rect(x - width / 2, y - height / 2, width, height);
  } else if (shape === 'rect') {
    ctx.rect(x - width / 2, y - height / 2, width, height);
  } else {
    const r = node.type === 'cluster' ? 16 : 4;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  }
  ctx.fill();
  ctx.stroke();

  if (shape === 'subroutine') {
    const inset = 8;
    const top = y - height / 2;
    const bot = y + height / 2;
    ctx.beginPath();
    ctx.moveTo(x - width / 2 + inset, top);
    ctx.lineTo(x - width / 2 + inset, bot);
    ctx.moveTo(x + width / 2 - inset, top);
    ctx.lineTo(x + width / 2 - inset, bot);
    ctx.stroke();
  }

  if (shape === 'cylinder') {
    const rx = width / 2;
    const ry = Math.max(6, height * 0.20);
    const top = y - height / 2;
    const bot = y + height / 2;
    const topCy = top + ry;
    const botCy = bot - ry;

    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = color;

    ctx.fillRect(x - rx, topCy, width, botCy - topCy);

    ctx.beginPath();
    ctx.ellipse(x, botCy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, botCy, rx, ry, 0, 0, Math.PI);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, botCy, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.strokeStyle = stroke;

    ctx.beginPath();
    ctx.moveTo(x - rx, topCy);
    ctx.lineTo(x - rx, botCy);
    ctx.moveTo(x + rx, topCy);
    ctx.lineTo(x + rx, botCy);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x, topCy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

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
    ctx.font = 'bold 12px Inter';
    if (shape === 'roundRect') {
      // State composite cluster: label centred at the top edge inside the box
      ctx.textBaseline = 'top';
      ctx.fillText(label, x, y - height / 2 + 6);
    } else {
      // Flowchart subgraph: label above the box
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, y - height / 2 - 4);
    }
    ctx.textBaseline = 'middle';
  } else if (isStepNum) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, Math.min(12, width * 0.55))}px Inter`;
    ctx.fillText(label, x, y);
  } else if (node.classLines && node.classLines.length > 0) {
    drawClassNode(ctx, node, color, stroke);
  } else {
    drawNodeLabel(ctx, node, label, shape, x, y, width, height);
  }
};

export const findNodeAtPoint = (
  nodes: DiagramNode[],
  px: number, py: number,
  exactOnly = false,
): DiagramNode | null => {
  for (const n of nodes) {
    if (n.type === 'cluster') continue;
    const pad = 20;
    if (
      px >= n.x - n.width  / 2 - pad && px <= n.x + n.width  / 2 + pad &&
      py >= n.y - n.height / 2 - pad && py <= n.y + n.height / 2 + pad
    ) return n;
  }
  if (exactOnly) return null;
  let best: DiagramNode | null = null;
  let bestD = 120;
  for (const n of nodes) {
    if (n.type === 'cluster') continue;
    const d = Math.hypot(n.x - px, n.y - py);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
};

export interface RenderFrameOptions {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  particles: Particle[];
  seqLabels: SeqLabel[];
  isPremium: boolean;
  particleColor: string;
  particleSpeed: number;
  particleSize: number;
  particleShape: ParticleShape;
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
  const { nodes, edges, particles, seqLabels, isPremium, particleColor, particleSize, particleShape, hoveredNodeId } = opts;

  ctx.fillStyle = isPremium ? '#f8fafc' : '#fff';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(tr.x, tr.y);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(offset.x, offset.y);

  if (isPremium) drawGrid(ctx, w, h);

  // Clusters first (background layer)
  nodes.filter(n => n.type === 'cluster')
    .forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Structural edges (lifelines) first
  edges.filter(e => e.type === 'structural')
    .forEach(edge => drawEdge(ctx, edge, isPremium, nodes));
  ctx.setLineDash([]);

  // Link edges (message arrows) on top of lifelines
  edges.filter(e => e.type === 'link')
    .forEach(edge => drawEdge(ctx, edge, isPremium, nodes));
  ctx.setLineDash([]);

  if (isPremium) {
    drawParticles(ctx, particles, particleColor, particleSize, particleShape);
  }

  // Normal nodes + notes (step numbers always on top)
  nodes
    .filter(n => n.type !== 'cluster' && !n.id.startsWith('stepNum-') && !n.id.startsWith('activation-'))
    .sort((a, _b) => (a.type === 'note' ? 1 : 0))
    .forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  nodes.filter(n => n.id.startsWith('activation-'))
    .forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  nodes.filter(n => n.id.startsWith('stepNum-'))
    .forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  if (seqLabels.length > 0) {
    ctx.shadowBlur = 0;
    seqLabels.forEach(lbl => {
      ctx.font = `${lbl.bold ? 'bold ' : ''}${lbl.fontSize}px Inter, sans-serif`;
      ctx.textAlign = lbl.align;
      ctx.textBaseline = 'middle';

      if (lbl.bgColor) {
        const metrics = ctx.measureText(lbl.text);
        const tw = metrics.width;
        const th = lbl.fontSize;
        const padX = 4, padY = 2;
        let bx = lbl.x;
        if (lbl.align === 'center') bx -= tw / 2;
        else if (lbl.align === 'right') bx -= tw;
        ctx.fillStyle = lbl.bgColor;
        ctx.beginPath();
        ctx.roundRect(bx - padX, lbl.y - th / 2 - padY, tw + padX * 2, th + padY * 2, 3);
        ctx.fill();
      }

      ctx.fillStyle = lbl.color;
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
