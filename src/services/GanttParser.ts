/**
 * GanttParser: Parses Mermaid Gantt diagram SVG output.
 *
 * Mermaid Gantt SVG class contract (verified against mermaid source):
 *
 *   Task bars:     rect   class="task [done|active|crit|activeCrit|doneCrit|milestone|…]{secNum}"
 *   Section bands: rect   class="section section{N}"
 *   Task labels:   text   id="{taskId}-text"   class="taskText …"
 *   Section title: text   class="sectionTitle sectionTitle{N}"  x="10"
 *   Grid:          g      class="grid"  (contains d3-generated <line> ticks)
 *   Today marker:  g      class="today" > line.today
 *
 * Task rects and their sibling text elements share the same base id:
 *   rect id="des1", text id="des1-text"
 *
 * Animation strategy:
 *   - task rect     → DiagramNode (shape='roundRect') + DiagramEdge (link, particles)
 *   - section rect  → DiagramNode (type='cluster', shape='rect', background layer)
 *   - sectionTitle  → SeqLabel (left-aligned sidebar text)
 *   - grid lines    → DiagramEdge (structural, no particles)
 *   - today line    → DiagramEdge (structural, dashed red)
 */
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import {
  lineToPathD,
  extractComputedColors,
  rectCenter,
  nextId,
} from '../utils/parser-base';

// ─── Status colour defaults (fallbacks when computed style is absent) ─────────

const STATUS_COLORS: Record<string, { color: string; stroke: string }> = {
  done:        { color: '#d1d5db', stroke: '#9ca3af' },   // gray
  active:      { color: '#bfdbfe', stroke: '#3b82f6' },   // blue
  activeCrit:  { color: '#fde68a', stroke: '#f59e0b' },   // amber
  doneCrit:    { color: '#e5e7eb', stroke: '#6b7280' },   // cool-gray
  crit:        { color: '#fecaca', stroke: '#ef4444' },   // red
  milestone:   { color: '#f0abfc', stroke: '#a21caf' },   // purple (diamond shape)
  default:     { color: '#c7d7f7', stroke: '#6366f1' },   // indigo
};

/**
 * Derive the task status key from the rect's class string.
 * Mermaid appends the section number directly to the status token (e.g. "activeCrit0"),
 * so we match the prefix only — no trailing \b.
 */
const taskStatusKey = (rect: SVGRectElement): keyof typeof STATUS_COLORS => {
  const cls = rect.getAttribute('class') ?? rect.className?.baseVal ?? '';
  // Check combined states first (most specific), then single states
  if (/\bactiveCrit/.test(cls))  return 'activeCrit';
  if (/\bdoneCrit/.test(cls))    return 'doneCrit';
  if (/\bmilestone/.test(cls))   return 'milestone';
  if (/\bactive/.test(cls))      return 'active';
  if (/\bdone/.test(cls))        return 'done';
  if (/\bcrit/.test(cls))        return 'crit';
  return 'default';
};

// ─── parseGanttNodes ─────────────────────────────────────────────────────────

export const parseGanttNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Build label lookup: taskId → label text
  // Mermaid gives the rect id="des1" and the text id="des1-text"
  const labelByTaskId: Record<string, string> = {};
  svgElement.querySelectorAll<SVGTextElement>('text[id$="-text"]').forEach(txt => {
    const rawId = txt.id.replace(/-text$/, '');
    labelByTaskId[rawId] = txt.textContent?.trim() ?? '';
  });

  // ── 1. Section background bands: class starts with "section" ─────────────
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const cls = rect.getAttribute('class') ?? rect.className?.baseVal ?? '';
    if (!/\bsection/.test(cls)) return;

    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    if (geom.width < 10 || geom.height < 4) return;

    const style = window.getComputedStyle(rect);
    const rawFill = style.fill;
    const color = (rawFill && rawFill !== 'none' && rawFill !== 'rgb(0, 0, 0)')
      ? rawFill
      : 'rgba(200,210,230,0.15)';

    nodes.push({
      id: nextId('gantt-section'),
      label: '',
      type: 'cluster',   // renders in background layer, before task bars
      shape: 'rect',
      x: geom.cx, y: geom.cy,
      width: geom.width, height: geom.height,
      color,
      stroke: 'transparent',
    });
  });

  // ── 2. Task bars: class contains "task" ──────────────────────────────────
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const cls = rect.getAttribute('class') ?? rect.className?.baseVal ?? '';
    if (!/\btask/.test(cls)) return;

    const statusKey = taskStatusKey(rect);
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    if (geom.height < 4) return;
    if (geom.width > 8000) return;

    const isMilestone = statusKey === 'milestone';
    // Milestone rects have zero duration → width ≈ 0 in SVG.
    // Use height for both dimensions to produce a proper square diamond.
    const nodeWidth  = isMilestone ? geom.height : geom.width;
    const nodeHeight = geom.height;
    if (!isMilestone && nodeWidth < 4) return;

    const { color, stroke } = extractComputedColors(rect, STATUS_COLORS[statusKey]);
    // Milestone label is rendered as a SeqLabel beside the diamond (not inside),
    // so the diamond shape stays at a fixed small size regardless of text length.
    const label = isMilestone ? '' : (labelByTaskId[rect.id ?? ''] ?? '');

    nodes.push({
      id: nextId('gantt-task'),
      label,
      type: 'node',
      shape: isMilestone ? 'diamond' : 'roundRect',
      x: geom.cx, y: geom.cy,
      width: nodeWidth, height: nodeHeight,
      color, stroke,
    });
  });

  return nodes;
};

// ─── parseGanttEdges ─────────────────────────────────────────────────────────

export const parseGanttEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // ── 1. Flow edges for each task bar (used for particle animation) ─────────
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const cls = rect.getAttribute('class') ?? rect.className?.baseVal ?? '';
    if (!/\btask/.test(cls)) return;

    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    if (geom.width < 20) return;

    const style = window.getComputedStyle(rect);
    const rawFill = style.fill;
    const hasFill = rawFill && rawFill !== 'none' && rawFill !== 'rgb(0, 0, 0)';
    const stroke = hasFill ? rawFill : (isPremium ? '#6366f1' : '#60a5fa');

    const left  = geom.cx - geom.width / 2;
    const right = geom.cx + geom.width / 2;
    const cy    = geom.cy;

    edges.push({
      id: nextId('gantt-flow'),
      pathD: `M ${left} ${cy} L ${right} ${cy}`,
      stroke,
      type: 'link',
      hasArrow: false,
      noSnap: true,
    });
  });

  // ── 2. Grid tick lines as structural edges ────────────────────────────────
  // g.grid line covers both direct children and tick-nested lines (d3 wraps
  // each tick in a <g class="tick">, which is itself a descendant of g.grid).
  svgElement.querySelectorAll<SVGLineElement>('g.grid line').forEach(line => {
    const d = lineToPathD(line, svgElement);
    if (!d || d.length < 5) return;
    edges.push({
      id: nextId('gantt-grid'),
      pathD: d,
      stroke: isPremium ? '#94a3b8' : '#aaa',
      type: 'structural',
      noSnap: true,
    });
  });

  // ── 2. Today marker ────────────────────────────────────────────────────────
  svgElement.querySelectorAll<SVGLineElement>('g.today line, line.today').forEach(line => {
    const d = lineToPathD(line, svgElement);
    if (!d) return;
    edges.push({
      id: nextId('gantt-today'),
      pathD: d,
      stroke: '#ef4444',
      type: 'structural',
      dash: [6, 4],
      noSnap: true,
    });
  });

  return edges;
};

// ─── parseGanttLabels ─────────────────────────────────────────────────────────

/**
 * Extracts section title labels and diagram title from Mermaid Gantt SVG.
 *
 * Section titles are rendered as:
 *   <text class="sectionTitle sectionTitle{N}" x="10" y="…">
 *     <tspan>…text…</tspan>
 *   </text>
 *
 * Section labels sit in the left sidebar at x≈10.
 * We compute the sidebar centre (half of the leftmost task bar's x) so the
 * label is visually centred within the sidebar column.
 */
export const parseGanttLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  // ── 1. Diagram title (class="titleText") ─────────────────────────────────
  const titleEl = svgElement.querySelector<SVGTextElement>('text.titleText');
  if (titleEl) {
    const geom = rectCenter(titleEl, svgElement);
    if (geom) {
      labels.push({
        x: geom.cx,
        y: geom.cy - 6,   // shift up slightly — away from the top grid border
        text: titleEl.textContent?.trim() ?? '',
        fontSize: 20,
        bold: true,
        color: '#1e293b',
        align: 'center',
      });
    }
  }

  // ── 2. Section title labels ───────────────────────────────────────────────
  // Compute the sidebar width = left edge of leftmost task bar
  let sidePad = 0;
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(r => {
    const cls = r.getAttribute('class') ?? r.className?.baseVal ?? '';
    if (!/\btask/.test(cls)) return;
    const g = rectCenter(r, svgElement);
    if (!g) return;
    const left = g.cx - g.width / 2;
    if (sidePad === 0 || left < sidePad) sidePad = left;
  });

  svgElement.querySelectorAll<SVGTextElement>('text').forEach(txt => {
    const cls = txt.getAttribute('class') ?? txt.className?.baseVal ?? '';
    if (!/\bsectionTitle\b/.test(cls)) return;

    const tspans = Array.from(txt.querySelectorAll<SVGTSpanElement>('tspan'));
    const text = tspans.length > 0
      ? tspans.map(t => t.textContent?.trim() ?? '').filter(Boolean).join(' ')
      : (txt.textContent?.trim() ?? '');
    if (!text) return;

    // Use getBBox-based centre when available, else fall back to x/y attrs
    const geom = rectCenter(txt, svgElement);
    const rawY = parseFloat(txt.getAttribute('y') ?? '0');
    const y = geom ? geom.cy : rawY;

    // Centre the label in the sidebar column
    const x = sidePad > 0 ? sidePad / 2 : parseFloat(txt.getAttribute('x') ?? '10');

    const style = window.getComputedStyle(txt);
    const color = (style.fill && style.fill !== 'none' && style.fill !== 'rgb(0, 0, 0)')
      ? style.fill
      : '#475569';

    labels.push({ x, y, text, fontSize: 11, bold: false, color, align: 'center' });
  });

  // ── 3. Milestone labels (positioned to the right of the diamond symbol) ─────
  // Build task-id → label text lookup same as parseGanttNodes does.
  const milestoneTextById: Record<string, string> = {};
  svgElement.querySelectorAll<SVGTextElement>('text[id$="-text"]').forEach(txt => {
    milestoneTextById[txt.id.replace(/-text$/, '')] = txt.textContent?.trim() ?? '';
  });
  svgElement.querySelectorAll<SVGRectElement>('rect').forEach(rect => {
    const cls = rect.getAttribute('class') ?? rect.className?.baseVal ?? '';
    if (!/\bmilestone/.test(cls)) return;
    const text = milestoneTextById[rect.id ?? ''];
    if (!text) return;
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    const diamondHalf = geom.height / 2;
    labels.push({
      x: geom.cx + diamondHalf + 6,
      y: geom.cy,
      text,
      fontSize: 12,
      bold: false,
      color: '#6b21a8',
      align: 'left',
    });
  });

  // ── 4. Date tick labels inside g.grid ─────────────────────────────────────
  svgElement.querySelectorAll<SVGTextElement>('g.grid text').forEach(el => {
    const geom = rectCenter(el, svgElement);
    if (!geom) return;
    const text = el.textContent?.trim() ?? '';
    if (!text) return;
    labels.push({
      x: geom.cx, y: geom.cy,
      text, fontSize: 10, bold: false, color: '#475569', align: 'center',
    });
  });

  return labels;
};

// Timeline uses the same bar-based structure
export const parseTimelineNodes  = parseGanttNodes;
export const parseTimelineEdges  = parseGanttEdges;
export const parseTimelineLabels = parseGanttLabels;
