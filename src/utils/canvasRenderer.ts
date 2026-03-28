import type { DiagramNode, DiagramEdge, SeqLabel, Transform } from '../types';
import { Particle } from './particle';
import { getLuminance } from './colorUtils';
import { drawClassNode } from './drawClassNode';
import { drawEdge } from './drawEdge';
import { drawParticles } from './drawParticles';
import type { ParticleShape } from './drawParticles';

export type { ParticleShape };
export { drawEdge };

export type ExportBg = 'solid' | 'checkerboard' | 'transparent';

const drawCheckerboard = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const size = 16;
  for (let row = 0; row * size < h; row++) {
    for (let col = 0; col * size < w; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#e5e7eb' : '#ffffff';
      ctx.fillRect(col * size, row * size, size, size);
    }
  }
};

// Cloud shape centred at (0,0) fitting w×h.
// N bumps placed on an ellipse; bump radius scales with the shorter axis so bumps
// always fit the label regardless of aspect ratio.
const drawCloudPath = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const rw = w / 2;
  const rh = h / 2;
  // bump radius: ~35% of the shorter axis, capped so bumps don't overflow
  const br = Math.min(rw, rh) * 0.36;
  // ellipse on which bump centres sit, inset by half a bump radius
  const ex = rw - br * 0.5;
  const ey = rh - br * 0.5;
  // more bumps for wider nodes so the top/bottom edges look bumpy too
  const N = w > h * 1.6 ? 10 : 8;
  const overlap = 0.18; // radians of extra arc on each side for seamless joins
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a) * ex;
    const cy = Math.sin(a) * ey;
    ctx.arc(cx, cy, br, a - Math.PI / N - overlap, a + Math.PI / N + overlap);
  }
  ctx.closePath();
};

// Bang (spiky burst) centred at (0,0) fitting w×h.
// Spike count and depth scale so the shape always surrounds the label.
const drawBangPath = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const spikes = 14;
  // outerR fits the bounding box; innerR creates the spike depth (~78% gives sharp tips)
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = outerRx * 0.78;
  const innerRy = outerRy * 0.78;
  const step = Math.PI / spikes;
  const startAngle = -Math.PI / 2;
  ctx.moveTo(Math.cos(startAngle) * outerRx, Math.sin(startAngle) * outerRy);
  for (let i = 0; i < spikes * 2; i++) {
    const angle = i * step + startAngle;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    ctx.lineTo(Math.cos(angle) * rx, Math.sin(angle) * ry);
  }
  ctx.closePath();
};

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
    ctx.font = `bold ${Math.max(10, Math.min(14, radius * 0.14))}px Red Hat Text`;
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
  const isDarkBg = getLuminance(node.color) < 0.35;
  ctx.fillStyle = isDarkBg ? '#f1f5f9' : '#1e293b';
  const lines = label.split('\n');
  const lh = 16;
  const totalH = lines.length * lh;

  if (shape === 'diamond') {
    ctx.font = 'bold 14px Red Hat Text';
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
      ctx.font = `bold ${fs}px Red Hat Text`;
      let fits = true;
      lines.forEach((line, i) => {
        const lineY = -totalH / 2 + i * lh + lh / 2;
        const availW = Math.max(0, hw * (1 - Math.abs(lineY) / hh) - TEXT_PAD) * 2;
        if (ctx.measureText(line).width > availW) fits = false;
      });
      if (fits) { fontSize = fs; break; }
    }
    ctx.font = `bold ${fontSize}px Red Hat Text`;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  } else if (shape === 'hexagon') {
    ctx.font = 'bold 14px Red Hat Text';
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
      ctx.font = `bold ${fs}px Red Hat Text`;
      const allFit = lines.every(l => ctx.measureText(l).width <= flatW - 8);
      if (allFit) { fontSize = fs; break; }
    }
    ctx.font = `bold ${fontSize}px Red Hat Text`;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - totalH / 2 + i * lh + lh / 2);
    });
  } else if (shape === 'note') {
    const PAD_X = 10;
    const maxW = width - PAD_X * 2;
    ctx.font = '12px Red Hat Text';
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
    ctx.font = 'bold 14px Red Hat Text';

    const wrappedLines: { text: string; bold: boolean }[] = [];
    for (const srcLine of lines) {
      const isBold = isDarkBg || (srcLine.startsWith('**') && srcLine.endsWith('**'));
      const cleanLine = (srcLine.startsWith('**') && srcLine.endsWith('**'))
        ? srcLine.slice(2, -2) : srcLine;
      ctx.font = isBold ? 'bold 14px Red Hat Text' : '13px Red Hat Text';

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
      ctx.font = bold ? 'bold 14px Red Hat Text' : '13px Red Hat Text';
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

  if (shape === 'cloud' || shape === 'bang') {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    if (shape === 'cloud') {
      drawCloudPath(ctx, width, height);
    } else {
      drawBangPath(ctx, width, height);
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isHovered ? particleColor : stroke;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawNodeLabel(ctx, node, label, 'roundRect', x, y, width, height);
    return;
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  // Flowchart subgraphs and state concurrent sub-regions use dashed borders.
  // State concurrent sub-regions are roundRect clusters with no label (auto-ID suppressed).
  // Top-level composite state clusters (roundRect with a label) use solid borders.
  const isDashedCluster = node.type === 'cluster' &&
    (node.shape !== 'roundRect' || node.label === '');
  if (isDashedCluster) ctx.setLineDash([5, 5]);
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
  } else if (shape === 'mergeCircle') {
    // Merge commit: hollow outer ring (metro style)
    const r = width / 2;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    return;
  } else if (shape === 'reverseCircle') {
    // REVERSE commit: filled circle + white ✕ cross inside
    const r = width / 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Draw ✕
    const arm = r * 0.45;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - arm, y - arm); ctx.lineTo(x + arm, y + arm);
    ctx.moveTo(x + arm, y - arm); ctx.lineTo(x - arm, y + arm);
    ctx.stroke();
    return;
  } else if (shape === 'highlightRect') {
    // HIGHLIGHT commit: filled square with thick border
    const half = width / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(x - half, y - half, width, height, 3);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    return;
  } else if (shape === 'circle') {
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.font = 'bold 14px Red Hat Text';
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
    ctx.font = 'bold 14px Red Hat Text';
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
    if (shape === 'roundRect' && label) {
      // State composite cluster: tinted header band + divider line + centred label
      const HEADER_H = 24;
      const r = 16;
      const top = y - height / 2;
      const left = x - width / 2;
      // Header band clipped to top-rounded corners of the box
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(left, top, width, height, r);
      ctx.clip();
      ctx.fillStyle = stroke.startsWith('#') ? stroke + '33' : 'rgba(109,40,217,0.18)';
      ctx.fillRect(left, top, width, HEADER_H);
      ctx.restore();
      // Divider line
      const dividerY = Math.round(top + HEADER_H);
      ctx.beginPath();
      ctx.moveTo(left, dividerY);
      ctx.lineTo(left + width, dividerY);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();
      // Label text
      ctx.fillStyle = getLuminance(color) < 0.35 ? '#f1f5f9' : '#334155';
      ctx.font = 'bold 12px Red Hat Text';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, top + HEADER_H / 2);
    } else if (shape === 'roundRect') {
      // no-op: concurrent sub-region with no label, no divider
    } else {
      // Flowchart subgraph: label above the box
      ctx.fillStyle = getLuminance(color) < 0.35 ? '#f1f5f9' : '#334155';
      ctx.font = 'bold 12px Red Hat Text';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, y - height / 2 - 4);
    }
    ctx.textBaseline = 'middle';
  } else if (isStepNum) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, Math.min(12, width * 0.55))}px Red Hat Text`;
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
  exportBg?: ExportBg;
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
  const { nodes, edges, particles, seqLabels, isPremium, particleColor, particleSize, particleShape, hoveredNodeId, exportBg } = opts;

  if (exportBg === 'transparent') {
    ctx.clearRect(0, 0, w, h);
  } else if (exportBg === 'checkerboard') {
    // "格紋" = 原圖樣式：灰背景 + 點格線
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
  } else if (exportBg === 'solid') {
    // 純色 = 純白背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  } else {
    // Live canvas (no exportBg)
    ctx.fillStyle = isPremium ? '#f8fafc' : '#fff';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.translate(tr.x, tr.y);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(offset.x, offset.y);

  // 透明和純色匯出不畫格線；格紋和 live canvas 才畫
  if (isPremium && exportBg !== 'transparent' && exportBg !== 'solid') drawGrid(ctx, w, h);

  // Clusters first (background layer) — largest area first so outer boxes don't overdraw inner ones
  nodes.filter(n => n.type === 'cluster')
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))
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
      ctx.font = `${lbl.bold ? 'bold ' : ''}${lbl.fontSize}px Red Hat Text, sans-serif`;
      ctx.textAlign = lbl.align;
      ctx.textBaseline = 'middle';

      if (lbl.rotation !== undefined) {
        ctx.save();
        ctx.translate(lbl.x, lbl.y);
        ctx.rotate(lbl.rotation);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (lbl.bgColor) {
          // Git tag shape: left-pointing arrow notch + rounded right body + hole dot
          //
          //   ╭──────────────────╮
          //  ◄  ●  text           │
          //   ╰──────────────────╯
          //
          const th = lbl.fontSize;
          const padY = 4;
          const halfH = th / 2 + padY;     // half total height
          const notch = halfH;             // notch depth = halfH so tip is sharp
          const cornerR = 4;
          const holeR = 2.5;
          const holeGap = 4;               // gap between hole left edge and body left
          const textGap = 4;               // gap between hole right edge and text

          // Measure text AFTER font is set (font already set above)
          const tw = ctx.measureText(lbl.text).width;

          // Layout (all x relative to the notch tip at x=0):
          // 0 = tip, notch = body left edge
          // text starts at: notch + holeGap + holeR*2 + textGap
          const textX = notch + holeGap + holeR * 2 + textGap;
          const R = textX + tw + holeGap; // body right edge
          const T = -halfH;
          const B =  halfH;

          // Body shape
          ctx.fillStyle = lbl.bgColor;
          ctx.strokeStyle = 'rgba(100,116,139,0.6)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, 0);            // notch tip
          ctx.lineTo(notch, T);        // top-left of body
          ctx.lineTo(R - cornerR, T);
          ctx.arcTo(R, T, R, T + cornerR, cornerR);
          ctx.lineTo(R, B - cornerR);
          ctx.arcTo(R, B, R - cornerR, B, cornerR);
          ctx.lineTo(notch, B);        // bottom-left of body
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Hole dot
          ctx.beginPath();
          ctx.arc(notch + holeGap + holeR, 0, holeR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(100,116,139,0.6)';
          ctx.fill();

          // Text
          ctx.textAlign = 'left';
          ctx.fillStyle = lbl.color;
          ctx.fillText(lbl.text, textX, 0);
          ctx.restore();
          return;
        }
        ctx.fillStyle = lbl.color;
        ctx.fillText(lbl.text, 0, 0);
        ctx.restore();
        return;
      }

      if (lbl.bgColor) {
        const metrics = ctx.measureText(lbl.text);
        const tw = metrics.width;
        const th = lbl.fontSize;
        const padX = 6, padY = 3;
        let bx = lbl.x;
        if (lbl.align === 'center') bx -= tw / 2;
        else if (lbl.align === 'right') bx -= tw;
        ctx.fillStyle = lbl.bgColor;
        ctx.beginPath();
        ctx.roundRect(bx - padX, lbl.y - th / 2 - padY, tw + padX * 2, th + padY * 2, 4);
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
    ctx.font = 'bold 18px Red Hat Text';
    ctx.fillText('● REC', 24, 36);
  }
};
