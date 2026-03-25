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
    else              naturalH += LINE_H;  // erAttr rows use the same height as member rows
  }

  // Scale rows to fill the SVG-derived box height exactly
  const scale = naturalH > 0 ? height / naturalH : 1;
  const scaledLineH  = LINE_H  * scale;
  const scaledTitleH = TITLE_H * scale;
  const scaledDivPad = DIV_PAD * scale;

  // Pre-scan erAttr rows to compute uniform column widths for the whole node
  ctx.font = `${MEMBER_FONT_SIZE}px Red Hat Text, sans-serif`;
  const erRows = classLines.filter(cl => cl.erAttr);
  const hasKey = erRows.some(cl => cl.erAttr!.key);
  const maxTypeW = erRows.reduce((m, cl) => Math.max(m, ctx.measureText(cl.erAttr!.type).width + H_PAD * 2), 0);
  const erColTypeW = erRows.length > 0 ? Math.min(Math.max(maxTypeW, width * 0.22), width * 0.35) : 0;
  const erColKeyW  = hasKey ? width * 0.20 : 0;
  const erColNameW = width - erColTypeW - erColKeyW;

  // Second pass: render top-down from the box top edge
  let curY = y - height / 2;
  let lastDividerY: number | null = null;  // track where the last divider was drawn

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxTextWidth = width - H_PAD * 2;

  for (const cl of classLines) {
    if (cl.divider) {
      curY += scaledDivPad;
      lastDividerY = curY;
      ctx.beginPath();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.moveTo(x - width / 2 + 1.5, curY);
      ctx.lineTo(x + width / 2 - 1.5, curY);
      ctx.stroke();
      curY += scaledDivPad + 1;
    } else if (cl.bold) {
      ctx.fillStyle = textColor;
      ctx.font = `bold ${TITLE_FONT_SIZE}px Red Hat Text, sans-serif`;
      const truncated = truncateText(ctx, cl.text ?? '', maxTextWidth);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncated, x, curY + scaledTitleH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      curY += scaledTitleH;
    } else if (cl.erAttr) {
      // ER 3-column grid: use pre-computed uniform column widths
      const colTypeW = erColTypeW;
      const colKeyW  = erColKeyW;
      const colNameW = erColNameW;
      const left      = x - width / 2;
      const rowBottom = curY + scaledLineH;
      const rowMid    = curY + scaledLineH / 2;

      // Row background — inset by 1.5px so the outer border stays visible
      ctx.fillStyle = bgColor;
      ctx.fillRect(left + 1.5, curY, width - 3, scaledLineH);

      // Grid lines: vertical column dividers + horizontal row bottom
      // For the first erAttr row after a divider, extend vertical lines up to the divider
      const vertTop = lastDividerY !== null ? lastDividerY : curY;
      lastDividerY = null;
      ctx.beginPath();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.moveTo(left + colTypeW,            vertTop); ctx.lineTo(left + colTypeW,            rowBottom);
      ctx.moveTo(left + colTypeW + colNameW, vertTop); ctx.lineTo(left + colTypeW + colNameW, rowBottom);
      ctx.moveTo(left + 1.5, rowBottom);              ctx.lineTo(left + width - 1.5,         rowBottom);
      ctx.stroke();

      // Text — left-aligned type & name, centered key badge
      ctx.fillStyle = textColor;
      ctx.font = `${MEMBER_FONT_SIZE}px Red Hat Text, sans-serif`;
      ctx.textBaseline = 'middle';

      ctx.textAlign = 'left';
      ctx.fillText(truncateText(ctx, cl.erAttr.type, colTypeW - H_PAD * 2), left + H_PAD, rowMid);
      ctx.fillText(truncateText(ctx, cl.erAttr.name, colNameW - H_PAD * 2), left + colTypeW + H_PAD, rowMid);

      if (cl.erAttr.key) {
        ctx.textAlign = 'center';
        ctx.fillText(
          truncateText(ctx, cl.erAttr.key, colKeyW - H_PAD),
          left + colTypeW + colNameW + colKeyW / 2,
          rowMid,
        );
      }

      ctx.textBaseline = 'top';
      curY += scaledLineH;
    } else {
      ctx.fillStyle = textColor;
      ctx.font = `${MEMBER_FONT_SIZE}px Red Hat Text, sans-serif`;
      const truncated = truncateText(ctx, cl.text ?? '', maxTextWidth);
      ctx.fillText(truncated, x - width / 2 + H_PAD, curY + (scaledLineH - MEMBER_FONT_SIZE) / 2);
      curY += scaledLineH;
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
};
