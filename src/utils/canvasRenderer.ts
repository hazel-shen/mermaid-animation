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

  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;

  if (node.type === 'cluster') ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);

  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    // Measure the longest label line and expand the drawn diamond so text never
    // touches the border. Only the visual shape grows — edge endpoints are
    // unchanged (they still connect at the SVG-derived x,y).
    ctx.font = 'bold 14px Inter';
    const longestLine = label.split('\n').reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    const PAD = 32; // minimum clear space (px) each side of text
    const neededW = ctx.measureText(longestLine).width + PAD * 2;
    const dw = Math.max(0, neededW - width);
    const dh = height > 0 ? dw * (height / width) : dw;
    const dW = width  + dw;
    const dH = height + dh;
    ctx.moveTo(x, y - dH / 2);
    ctx.lineTo(x + dW / 2, y);
    ctx.lineTo(x, y + dH / 2);
    ctx.lineTo(x - dW / 2, y);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    // Horizontal hexagon (Mermaid {{...}} syntax): pointed left & right tips,
    // flat top & bottom edges. Expand width if text is too long.
    ctx.font = 'bold 14px Inter';
    const longestHex = label.split('\n').reduce(
      (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
    );
    const HEX_PAD = 20;
    const neededHexW = ctx.measureText(longestHex).width + HEX_PAD * 2 + height; // +height for the two tips
    const hW = Math.max(width, neededHexW);
    const hH = height;
    const tip = hH / 2; // horizontal tip indent (matches Mermaid's polygon geometry)
    const hw = hW / 2, hh = hH / 2;
    ctx.moveTo(x - hw + tip, y - hh);
    ctx.lineTo(x + hw - tip, y - hh);
    ctx.lineTo(x + hw,       y);
    ctx.lineTo(x + hw - tip, y + hh);
    ctx.lineTo(x - hw + tip, y + hh);
    ctx.lineTo(x - hw,       y);
    ctx.closePath();
  } else if (shape === 'stadium') {
    // Stadium / pill shape: rect with fully rounded left and right ends
    const r = height / 2;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  } else if (shape === 'cylinder') {
    // Cylinder: two elliptical caps connected by vertical sides.
    // ry = vertical radius of the ellipse caps; body height shrinks accordingly.
    const rx = width / 2;
    const ry = Math.max(6, height * 0.15);
    const topCy = y - height / 2 + ry;   // centre of top ellipse
    const botCy = y + height / 2 - ry;   // centre of bottom ellipse
    // Left side down, bottom ellipse, right side up, top ellipse (back half)
    ctx.moveTo(x - rx, topCy);
    ctx.lineTo(x - rx, botCy);
    ctx.ellipse(x, botCy, rx, ry, 0, Math.PI, 0, false); // bottom cap
    ctx.lineTo(x + rx, topCy);
    ctx.ellipse(x, topCy, rx, ry, 0, 0, Math.PI, false); // top cap (back)
    ctx.closePath();
  } else if (shape === 'subroutine') {
    // Subroutine: rect with inner vertical lines near left and right edges
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
  } else if (shape === 'rect') {
    // Sharp-cornered rectangle ([text])
    ctx.rect(x - width / 2, y - height / 2, width, height);
  } else {
    // roundRect and everything else
    const r = node.type === 'cluster' ? 16 : 4;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, r);
  }
  ctx.fill();
  ctx.stroke();

  // Subroutine: draw inner vertical lines after fill+stroke
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

  // Cylinder: redraw top ellipse on top of fill so the front rim is visible
  if (shape === 'cylinder') {
    const rx = width / 2;
    const ry = Math.max(6, height * 0.15);
    const topCy = y - height / 2 + ry;
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
    const lines = label.split('\n');
    const lh = 16;
    const totalH = lines.length * lh;

    if (shape === 'diamond') {
      // Recompute expanded diamond dimensions (must match shape-drawing logic above).
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

      // Diamond interior narrows toward top/bottom. Find a font size where every
      // line fits inside the expanded diamond at its vertical position.
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
      // Hexagon: usable flat interior = hW - 2*tip, uniform across the full height.
      ctx.font = 'bold 14px Inter';
      const longestHex = lines.reduce(
        (best, l) => ctx.measureText(l).width > ctx.measureText(best).width ? l : best, ''
      );
      const HEX_PAD = 20;
      const neededHexW = ctx.measureText(longestHex).width + HEX_PAD * 2 + height;
      const hW = Math.max(width, neededHexW);
      const tip = height / 2;
      const flatW = hW - tip * 2; // usable width in the flat centre band
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
      // Notes: left-aligned text with padding, regular (not bold) weight
      const PAD_X = 10;
      const maxW = width - PAD_X * 2;
      ctx.font = '12px Inter';
      // Measure actual line height from font
      const actualLh = 15;
      const actualTotalH = lines.length * actualLh;
      const startY = y - actualTotalH / 2 + actualLh / 2;
      ctx.textAlign = 'left';
      lines.forEach((line, i) => {
        // Truncate if still too wide (rare for notes since Mermaid wraps them)
        let drawn = line;
        if (ctx.measureText(drawn).width > maxW) {
          while (drawn.length > 1 && ctx.measureText(drawn + '…').width > maxW)
            drawn = drawn.slice(0, -1);
          drawn += '…';
        }
        ctx.fillText(drawn, x - width / 2 + PAD_X, startY + i * actualLh);
      });
      ctx.textAlign = 'center';
    } else {
      // roundRect / stadium / subroutine / cylinder / default:
      // Word-wrap each source line so text never overflows the node width.
      const PAD_X = shape === 'stadium' ? height / 2 + 8 : 12;
      const maxW = width - PAD_X * 2;
      ctx.font = 'bold 14px Inter';

      // Build final wrapped lines from each source line
      const wrappedLines: { text: string; bold: boolean }[] = [];
      for (const srcLine of lines) {
        // Detect bold markdown: **text**
        const isBold = srcLine.startsWith('**') && srcLine.endsWith('**');
        const cleanLine = isBold ? srcLine.slice(2, -2) : srcLine;
        ctx.font = isBold ? 'bold 14px Inter' : '13px Inter';

        if (ctx.measureText(cleanLine).width <= maxW) {
          wrappedLines.push({ text: cleanLine, bold: isBold });
        } else {
          // Word-wrap by splitting on spaces
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
  const LINE_H = 15;
  const TITLE_H = 18;
  const DIV_PAD = 4;
  const H_PAD = 6;

  // ── First pass: measure natural content height ─────────────────────
  let naturalH = 0;
  for (const cl of classLines) {
    if (cl.divider)   naturalH += DIV_PAD * 2 + 1;
    else if (cl.bold) naturalH += TITLE_H;
    else              naturalH += LINE_H;
  }

  // Scale rows so they fill the actual SVG-derived box height exactly.
  // This keeps text anchored inside the box Mermaid produced, so edges
  // that terminate at the box boundary stay visually aligned.
  const scale = naturalH > 0 ? height / naturalH : 1;
  const scaledLineH  = LINE_H  * scale;
  const scaledTitleH = TITLE_H * scale;
  const scaledDivPad = DIV_PAD * scale;

  // ── Second pass: render top-down from the box top edge ────────────
  let curY = y - height / 2;   // start exactly at top of drawn rect

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxTextWidth = width - H_PAD * 2;

  for (const cl of classLines) {
    if (cl.divider) {
      curY += scaledDivPad;
      ctx.beginPath();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.moveTo(x - width / 2, curY);
      ctx.lineTo(x + width / 2, curY);
      ctx.stroke();
      curY += scaledDivPad + 1;
    } else if (cl.bold) {
      ctx.fillStyle = textColor;
      ctx.font = `bold ${TITLE_FONT_SIZE}px Inter, sans-serif`;
      const truncated = truncateText(ctx, cl.text, maxTextWidth);
      ctx.textAlign = 'center';
      ctx.fillText(truncated, x, curY + (scaledTitleH - TITLE_FONT_SIZE) / 2);
      ctx.textAlign = 'left';
      curY += scaledTitleH;
    } else {
      ctx.fillStyle = textColor;
      ctx.font = `${MEMBER_FONT_SIZE}px Inter, sans-serif`;
      const truncated = truncateText(ctx, cl.text, maxTextWidth);
      ctx.fillText(truncated, x - width / 2 + H_PAD, curY + (scaledLineH - MEMBER_FONT_SIZE) / 2);
      curY += scaledLineH;
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
    // For very short L tips (e.g. self-loop arrow cap), fall back to the
    // preceding C segment's own exit tangent (last control point → endpoint).
    if (Math.hypot(dx, dy) < 0.5 && pc === 'C' && pn.length >= 6) {
      dx = pn[pn.length - 2] - pn[pn.length - 4];
      dy = pn[pn.length - 1] - pn[pn.length - 3];
      ex = pn[pn.length - 2]; ey = pn[pn.length - 1];
    }
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

  const { cmd: c0, nums: n0 } = parseSegment(segs[0]!);
  const { cmd: c1, nums: n1 } = parseSegment(segs[1]!);

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

/** How far (px) to set back the line end so it doesn't protrude through the marker. */
const markerSetback = (marker: ArrowMarker | undefined): number => {
  switch (marker) {
    case 'composition':
    case 'aggregation': return 20;  // diamond length = L*2 = 20
    case 'extension':   return 12;  // triangle height ≈ H = 14*0.87
    case 'dependency':  return 0;   // open arrow, no fill needed
    default:            return 10;  // generic triangle
  }
};

/**
 * Given a node and an approach direction (unit vector dx,dy pointing FROM outside TOWARD node),
 * returns the point on the node's rectangular border where that direction exits the node centre.
 * Used to snap arrow tips precisely onto box edges.
 */
const borderPoint = (node: DiagramNode, dx: number, dy: number): { x: number; y: number } => {
  const hw = node.width  / 2;
  const hh = node.height / 2;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: node.x, y: node.y };
  const ux = dx / len, uy = dy / len;
  // Smallest positive t at which ray (node.x + ux*t, node.y + uy*t) hits a wall
  const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
  const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
  const t  = Math.min(tx, ty);
  return { x: node.x + ux * t, y: node.y + uy * t };
};

/**
 * Find the node whose bounding box contains (px,py).
 * When exactOnly=true, only returns a node if the point is inside its bbox (with small padding).
 * When exactOnly=false (default), also falls back to closest centre within 300px.
 */
export const findNodeAtPoint = (
  nodes: DiagramNode[],
  px: number, py: number,
  exactOnly = false,
): DiagramNode | null => {
  // Exact hit (point inside box with small tolerance)
  for (const n of nodes) {
    if (n.type === 'cluster') continue;
    const pad = 20;
    if (
      px >= n.x - n.width  / 2 - pad && px <= n.x + n.width  / 2 + pad &&
      py >= n.y - n.height / 2 - pad && py <= n.y + n.height / 2 + pad
    ) return n;
  }
  if (exactOnly) return null;
  // Fallback: closest centre within 120px (enough for deep-endpoint paths, not for far-away nodes)
  let best: DiagramNode | null = null;
  let bestD = 120;
  for (const n of nodes) {
    if (n.type === 'cluster') continue;
    const d = Math.hypot(n.x - px, n.y - py);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
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

  // ── Snap endpoints to node borders ──────────────────────────────────────
  // Approach direction for END  = rawEnd.angle  (path tangent arriving at end)
  // Approach direction for START = rawStart.angle reversed (tangent leaving start, so flip)
  let tipEnd   = rawEnd   ? { x: rawEnd.x,   y: rawEnd.y,   angle: rawEnd.angle   } : null;
  let tipStart = rawStart ? { x: rawStart.x, y: rawStart.y, angle: rawStart.angle } : null;

  if (nodes.length > 0 && !edge.noSnap) {
    if (rawEnd) {
      const node = findNodeAtPoint(nodes, rawEnd.x, rawEnd.y);
      if (node) {
        // Arrow arrives at node: border is the face the path hits, i.e. opposite to travel direction
        const dx = -Math.cos(rawEnd.angle), dy = -Math.sin(rawEnd.angle);
        const bp = borderPoint(node, dx, dy);
        tipEnd = { x: bp.x, y: bp.y, angle: rawEnd.angle };
      }
    }
    if (rawStart) {
      const node = findNodeAtPoint(nodes, rawStart.x, rawStart.y);
      if (node) {
        // rawStart.angle already has +π applied (points back toward start node).
        // To get the border face the path exits from, negate again to get exit direction.
        const dx = -Math.cos(rawStart.angle), dy = -Math.sin(rawStart.angle);
        const bp = borderPoint(node, dx, dy);
        tipStart = { x: bp.x, y: bp.y, angle: rawStart.angle };
      }
    }
  }

  // ── Rebuild drawn path with setback so line doesn't protrude through marker ─
  const segs = tokenisePath(edge.pathD);

  // For nearly-horizontal lines snap y so floating-point noise in the angle
  // doesn't tilt the drawn segment (especially sequence diagram arrows).
  const isNearlyHorizontal = rawStart && rawEnd &&
    Math.abs(rawEnd.y - rawStart.y) < 1.5;

  if (tipEnd && segs.length > 0) {
    const setback = (edge.arrowEnd && edge.arrowEnd !== 'none')
      ? markerSetback(edge.arrowEnd)
      : (edge.hasArrow && !edge.arrowStart ? markerSetback('default') : 0);
    if (setback > 0) {
      const sbx = tipEnd.x - Math.cos(tipEnd.angle) * setback;
      const sby = isNearlyHorizontal ? tipEnd.y : tipEnd.y - Math.sin(tipEnd.angle) * setback;
      // Only rewrite last segment when it's a simple L (straight tip); preserve curves.
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
      // tipStart.angle points INTO path; to set back we go opposite
      const sbx = tipStart.x + Math.cos(tipStart.angle) * setback;
      const sby = isNearlyHorizontal ? tipStart.y : tipStart.y + Math.sin(tipStart.angle) * setback;
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

  // ── Arrow markers ────────────────────────────────────────────────────────
  if (edge.arrowEnd && edge.arrowEnd !== 'none' && tipEnd) {
    drawArrowMarker(ctx, edge.arrowEnd, tipEnd.x, tipEnd.y, tipEnd.angle, edgeColor, markerBg);
  } else if (edge.hasArrow && !edge.arrowStart && tipEnd) {
    drawArrowMarker(ctx, 'default', tipEnd.x, tipEnd.y, tipEnd.angle, edgeColor, markerBg);
  }

  if (edge.arrowStart && edge.arrowStart !== 'none' && tipStart) {
    drawArrowMarker(ctx, edge.arrowStart, tipStart.x, tipStart.y, tipStart.angle, edgeColor, markerBg);
  }
};

export type ParticleShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'heart' | 'hat';

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

  // Render clusters first (background layer)
  const clusterNodes = nodes.filter(n => n.type === 'cluster');
  clusterNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Structural edges (lifelines) first
  edges.filter(e => e.type === 'structural').forEach(edge => drawEdge(ctx, edge, isPremium, nodes));
  ctx.setLineDash([]);

  // Link edges (message arrows) on top of lifelines
  edges.filter(e => e.type === 'link').forEach(edge => drawEdge(ctx, edge, isPremium, nodes));
  ctx.setLineDash([]);

  // Render particles (link edges only, premium mode)
  if (isPremium) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.shadowBlur = 4;
    ctx.shadowColor = particleColor;
    ctx.fillStyle = particleColor;
    const r = particleSize;
    particles.forEach(p => {
      const pos = p.getPosition();
      if (pos.x === 0 && pos.y === 0) return;
      ctx.beginPath();
      switch (particleShape) {
        case 'square':
          ctx.rect(pos.x - r, pos.y - r, r * 2, r * 2);
          break;
        case 'triangle':
          ctx.moveTo(pos.x, pos.y - r);
          ctx.lineTo(pos.x + r * 0.866, pos.y + r * 0.5);
          ctx.lineTo(pos.x - r * 0.866, pos.y + r * 0.5);
          ctx.closePath();
          break;
        case 'star': {
          const spikes = 5;
          const outerR = r;
          const innerR = r * 0.4;
          for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const rad = i % 2 === 0 ? outerR : innerR;
            if (i === 0) ctx.moveTo(pos.x + Math.cos(angle) * rad, pos.y + Math.sin(angle) * rad);
            else ctx.lineTo(pos.x + Math.cos(angle) * rad, pos.y + Math.sin(angle) * rad);
          }
          ctx.closePath();
          break;
        }
        case 'diamond':
          ctx.moveTo(pos.x, pos.y - r);
          ctx.lineTo(pos.x + r * 0.7, pos.y);
          ctx.lineTo(pos.x, pos.y + r);
          ctx.lineTo(pos.x - r * 0.7, pos.y);
          ctx.closePath();
          break;
        case 'heart': {
          // Two bezier curves forming a heart, centered at pos
          const s = r * 0.9;
          ctx.moveTo(pos.x, pos.y + s * 0.3);
          ctx.bezierCurveTo(pos.x, pos.y - s * 0.3, pos.x - s, pos.y - s * 0.3, pos.x - s, pos.y - s * 0.6);
          ctx.bezierCurveTo(pos.x - s, pos.y - s * 1.1, pos.x, pos.y - s * 0.9, pos.x, pos.y - s * 0.5);
          ctx.bezierCurveTo(pos.x, pos.y - s * 0.9, pos.x + s, pos.y - s * 1.1, pos.x + s, pos.y - s * 0.6);
          ctx.bezierCurveTo(pos.x + s, pos.y - s * 0.3, pos.x, pos.y - s * 0.3, pos.x, pos.y + s * 0.3);
          ctx.closePath();
          break;
        }
        case 'hat': {
          // Top hat: tall rectangular crown + wide flat brim
          const brimW = r * 1.4;
          const brimH = r * 0.28;
          const crownW = r * 0.8;
          const crownH = r * 1.1;
          const top = pos.y - crownH * 0.7;
          // Crown
          ctx.rect(pos.x - crownW / 2, top, crownW, crownH);
          ctx.fill();
          ctx.beginPath();
          // Brim
          ctx.rect(pos.x - brimW / 2, top + crownH - brimH / 2, brimW, brimH);
          break;
        }
        default: // circle
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
  }

  // Render normal nodes + notes on top (step numbers last so they're always visible)
  const normalNodes = nodes
    .filter(n => n.type !== 'cluster' && !n.id.startsWith('stepNum-') && !n.id.startsWith('activation-'))
    .sort((a, _b) => (a.type === 'note' ? 1 : 0));
  normalNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Activation bars sit on top of actor boxes but under text labels
  nodes.filter(n => n.id.startsWith('activation-')).forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Step number circles always on top
  nodes.filter(n => n.id.startsWith('stepNum-')).forEach(node => drawNode(ctx, node, isPremium, hoveredNodeId, particleColor));

  // Render floating sequence labels
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
