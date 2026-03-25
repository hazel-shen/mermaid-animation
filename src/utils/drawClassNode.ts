import type { DiagramNode } from '../types';
import { getLuminance } from './colorUtils';

/** Truncate text with ellipsis so it fits within maxWidth pixels. */
export const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
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

/**
 * Renders the interior text of a class-diagram node:
 * bold title row, horizontal divider lines, and member rows.
 */
export const drawClassNode = (
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

  // First pass: measure natural content height
  let naturalH = 0;
  for (const cl of classLines) {
    if (cl.divider)   naturalH += DIV_PAD * 2 + 1;
    else if (cl.bold) naturalH += TITLE_H;
    else              naturalH += LINE_H;
  }

  // Scale rows to fill the SVG-derived box height exactly
  const scale = naturalH > 0 ? height / naturalH : 1;
  const scaledLineH  = LINE_H  * scale;
  const scaledTitleH = TITLE_H * scale;
  const scaledDivPad = DIV_PAD * scale;

  // Second pass: render top-down from the box top edge
  let curY = y - height / 2;

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
      const truncated = truncateText(ctx, cl.text ?? '', maxTextWidth);
      ctx.textAlign = 'center';
      ctx.fillText(truncated, x, curY + (scaledTitleH - TITLE_FONT_SIZE) / 2);
      ctx.textAlign = 'left';
      curY += scaledTitleH;
    } else {
      ctx.fillStyle = textColor;
      ctx.font = `${MEMBER_FONT_SIZE}px Inter, sans-serif`;
      const truncated = truncateText(ctx, cl.text ?? '', maxTextWidth);
      ctx.fillText(truncated, x - width / 2 + H_PAD, curY + (scaledLineH - MEMBER_FONT_SIZE) / 2);
      curY += scaledLineH;
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
};
