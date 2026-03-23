/**
 * PieParser: Parses Mermaid pie chart SVG output.
 *
 * Each wedge is a <path> with a d3-shape arc. We extract the center, radius
 * and start/end angles in SVG viewBox coordinate space (same space used by
 * every other parser) and store them as PieWedge on each node.
 *
 * No particle edges — pie charts don't use flowing particles.
 */
import type { DiagramNode, DiagramEdge, SeqLabel, PieWedge } from '../types';
import { getCumulativeMatrix } from './svgUtils';
import { nextId, extractComputedColors } from '../utils/parser-base';

/**
 * d3-shape arc() path format:
 *   M x1,y1  A r,r,0,largeArc,sweep,x2,y2  L cx,cy  Z
 *
 *   M  = arc start point on circumference
 *   A  = arc end point on circumference; first param is local radius
 *   L  = pie center
 *
 * All coordinates are in the element's local space. We transform them to
 * SVG viewBox space using getCumulativeMatrix (tx, ty, sx, sy).
 */
export const parseWedgePath = (
  d: string,
  tx: number, ty: number, sx: number, sy: number,
): PieWedge | null => {
  const tokens = d.trim().match(/[MLAZmlaz][^MLAZmlaz]*/gi);
  if (!tokens || tokens.length < 3) return null;

  const nums = (s: string) =>
    s.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

  const toWorld = (lx: number, ly: number) => ({
    x: sx * lx + tx,
    y: sy * ly + ty,
  });

  // M → arc start (on circumference)
  const mNums = nums(tokens[0]);
  if (mNums.length < 2) return null;
  const startPt = toWorld(mNums[0], mNums[1]);

  // A → arc end (on circumference) + local radius
  const aTok = tokens.find(t => t.trimStart().toUpperCase().startsWith('A'));
  if (!aTok) return null;
  const aNums = nums(aTok);
  if (aNums.length < 7) return null;
  const localRadius = aNums[0];
  const endPt = toWorld(aNums[5], aNums[6]);

  // L → pie center
  const lTok = tokens.find(t => t.trimStart().toUpperCase().startsWith('L'));
  if (!lTok) return null;
  const lNums = nums(lTok);
  if (lNums.length < 2) return null;
  const center = toWorld(lNums[0], lNums[1]);

  // Radius in world space (uniform scale assumed)
  const radius = localRadius * Math.abs(sx);

  const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
  const endAngle   = Math.atan2(endPt.y   - center.y, endPt.x   - center.x);

  return { cx: center.x, cy: center.y, radius, startAngle, endAngle };
};

export const parsePieNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  svgElement.querySelectorAll<SVGPathElement>('path.pieCircle, path[class*="slice"], g.pie path').forEach(path => {
    const d = path.getAttribute('d') || '';
    if (!d || d.length < 10) return;

    const { tx, ty, sx, sy } = getCumulativeMatrix(path, svgElement);
    const wedge = parseWedgePath(d, tx, ty, sx, sy);
    if (!wedge) return;

    const { color, stroke } = extractComputedColors(path, { color: '#818cf8', stroke: '#fff' });

    // Derive percentage from sweep angle (avoids relying on SVG sibling <text>
    // elements which share a common parent with all slices).
    let sweep = wedge.endAngle - wedge.startAngle;
    if (sweep <= 0) sweep += Math.PI * 2;
    const pct = Math.round((sweep / (Math.PI * 2)) * 100);

    nodes.push({
      id: nextId('pie-slice'),
      label: `${pct}%`,
      type: 'node',
      shape: 'pie',
      x: wedge.cx,
      y: wedge.cy,
      width: wedge.radius * 2,
      height: wedge.radius * 2,
      color,
      stroke,
      pieWedge: wedge,
    });
  });

  // Legend color swatches
  svgElement.querySelectorAll<SVGRectElement>('rect.legend, g.legend rect, .legendRect').forEach(rect => {
    try {
      const { color } = extractComputedColors(rect, { color: '#818cf8', stroke: '#818cf8' });
      const { tx, ty, sx, sy } = getCumulativeMatrix(rect, svgElement);
      const bx = parseFloat(rect.getAttribute('x') || '0');
      const by = parseFloat(rect.getAttribute('y') || '0');
      const bw = parseFloat(rect.getAttribute('width') || '12');
      const bh = parseFloat(rect.getAttribute('height') || '12');
      if (bw <= 0 || bh <= 0) return;
      const worldX = sx * bx + tx;
      const worldY = sy * by + ty;
      const worldW = bw * Math.abs(sx);
      const worldH = bh * Math.abs(sy);
      nodes.push({
        id: nextId('pie-legend-swatch'),
        label: '',
        type: 'node',
        shape: 'rect',
        x: worldX + worldW / 2,
        y: worldY + worldH / 2,
        width: worldW,
        height: worldH,
        color,
        stroke: color,
      });
    } catch { /* ignore */ }
  });

  return nodes;
};

/** No particle edges for pie charts. */
export const parsePieEdges = (_svgElement: SVGSVGElement): DiagramEdge[] => [];

/** Extract title and legend text as SeqLabels. */
export const parsePieLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  const addTextLabel = (t: SVGTextElement, bold: boolean, align: CanvasTextAlign) => {
    try {
      const bbox = t.getBBox();
      if (bbox.width <= 0 || bbox.height <= 0) return;
      const { tx, ty, sx, sy } = getCumulativeMatrix(t, svgElement);
      const { color } = extractComputedColors(t, { color: '#1e293b', stroke: '' });
      // Use bbox height in viewBox units as the font size so it scales with the
      // diagram coordinate space (getComputedStyle gives screen-pixel sizes which
      // don't match the canvas viewBox coordinate system).
      const fontSize = bbox.height * Math.abs(sy);
      const worldX = sx * bbox.x + tx;
      const worldY = sy * bbox.y + ty + fontSize / 2;
      labels.push({
        x: align === 'center' ? worldX + (bbox.width * Math.abs(sx)) / 2 : worldX,
        y: worldY,
        text: t.textContent?.trim() || '',
        fontSize,
        bold,
        color,
        align,
      });
    } catch { /* ignore */ }
  };

  svgElement.querySelectorAll<SVGTextElement>('text.pieTitleText, text[class*="title"]').forEach(t => {
    addTextLabel(t, true, 'center');
  });

  svgElement.querySelectorAll<SVGTextElement>('text.legend, g.legend text, .legendText').forEach(t => {
    addTextLabel(t, false, 'left');
  });

  return labels;
};
