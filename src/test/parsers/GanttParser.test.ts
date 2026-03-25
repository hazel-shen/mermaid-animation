/**
 * GanttParser tests.
 *
 * Mermaid Gantt SVG class contract:
 *   task rect:     class="task [done|active|crit|activeCrit|doneCrit|…]{secNum}"
 *   section rect:  class="section section{N}"
 *   task label:    text  id="{taskId}-text"  class="taskText …"
 *   grid:          g.grid > line
 *   today:         g.today > line  OR  line.today
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGanttNodes, parseGanttEdges, parseGanttLabels } from '../../services/GanttParser';
import { resetIdCounter } from '../../utils/parser-base';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

const mockBBox = (x = 0, y = 0, w = 120, h = 20): DOMRect =>
  ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect);

let svg: SVGSVGElement;

beforeEach(() => {
  resetIdCounter();
  svg = el<SVGSVGElement>('svg');
  document.body.appendChild(svg);
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    writable: true,
    value: () => mockBBox(),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  // @ts-expect-error remove jsdom-undefined stub
  delete SVGElement.prototype.getBBox;
  vi.restoreAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a Mermaid-style task rect directly in the SVG root. */
const makeTaskRect = (
  taskClass: string,           // e.g. "task done0", "task active1", "task task0"
  id = 'task1',
  bboxOverride?: DOMRect,
): SVGRectElement => {
  const rect = el<SVGRectElement>('rect');
  rect.setAttribute('class', taskClass);
  rect.setAttribute('id', id);
  if (bboxOverride) (rect as unknown as SVGGraphicsElement).getBBox = () => bboxOverride;
  svg.appendChild(rect);
  return rect;
};

/** Build a Mermaid-style section band rect. */
const makeSectionRect = (secClass = 'section section0', bboxOverride?: DOMRect): SVGRectElement => {
  const rect = el<SVGRectElement>('rect');
  rect.setAttribute('class', secClass);
  if (bboxOverride) (rect as unknown as SVGGraphicsElement).getBBox = () => bboxOverride;
  svg.appendChild(rect);
  return rect;
};

/** Build a Mermaid-style task label text element. */
const makeTaskText = (taskId: string, label: string): SVGTextElement => {
  const txt = el<SVGTextElement>('text');
  txt.setAttribute('id', taskId + '-text');
  txt.setAttribute('class', 'taskText taskText0');
  txt.textContent = label;
  svg.appendChild(txt);
  return txt;
};

/** Build a diagram title text element (class="titleText"). */
const makeTitleText = (title: string): SVGTextElement => {
  const txt = el<SVGTextElement>('text');
  txt.setAttribute('class', 'titleText');
  txt.textContent = title;
  svg.appendChild(txt);
  return txt;
};

/**
 * Build a date tick label using d3's axis structure:
 *   g.grid > g.tick > text
 * Re-uses an existing g.grid if one already exists in the SVG.
 */
const makeGridTickText = (label: string): SVGTextElement => {
  let gridG = svg.querySelector<SVGGElement>('g.grid');
  if (!gridG) {
    gridG = el<SVGGElement>('g');
    gridG.setAttribute('class', 'grid');
    svg.appendChild(gridG);
  }
  const tick = el<SVGGElement>('g');
  tick.setAttribute('class', 'tick');
  const txt = el<SVGTextElement>('text');
  txt.textContent = label;
  tick.appendChild(txt);
  gridG.appendChild(tick);
  return txt;
};

// ─── parseGanttNodes ─────────────────────────────────────────────────────────

describe('parseGanttNodes', () => {
  it('returns empty array for an empty SVG', () => {
    expect(parseGanttNodes(svg)).toEqual([]);
  });

  it('ignores rects that lack a "task" or "section" class', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('class', 'other');
    svg.appendChild(rect);
    expect(parseGanttNodes(svg)).toHaveLength(0);
  });

  // ── Task bars ──────────────────────────────────────────────────────────────

  it('finds task bar with class "task task0"', () => {
    makeTaskRect('task task0', 'des1');
    const tasks = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].shape).toBe('roundRect');
    expect(tasks[0].type).toBe('node');
  });

  it('computes cx/cy from BBox centre', () => {
    makeTaskRect('task task0', 'des1', mockBBox(10, 5, 100, 20));
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    // BBox x=10, y=5, w=100, h=20 → cx=60, cy=15
    expect(t.x).toBe(60);
    expect(t.y).toBe(15);
    expect(t.width).toBe(100);
    expect(t.height).toBe(20);
  });

  it('uses "done" default colors for class "task done0"', () => {
    makeTaskRect('task done0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#d1d5db');
    expect(t.stroke).toBe('#9ca3af');
  });

  it('uses "active" default colors for class "task active0"', () => {
    makeTaskRect('task active0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#bfdbfe');
    expect(t.stroke).toBe('#3b82f6');
  });

  it('uses "crit" default colors for class "task crit0"', () => {
    makeTaskRect('task crit0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#fecaca');
    expect(t.stroke).toBe('#ef4444');
  });

  it('uses "activeCrit" default colors for class "task activeCrit0"', () => {
    makeTaskRect('task activeCrit0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#fde68a');
    expect(t.stroke).toBe('#f59e0b');
  });

  it('uses "doneCrit" default colors for class "task doneCrit0"', () => {
    makeTaskRect('task doneCrit0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#e5e7eb');
    expect(t.stroke).toBe('#6b7280');
  });

  it('uses "milestone" purple colors for class "task milestone0"', () => {
    makeTaskRect('task milestone0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#f0abfc');
    expect(t.stroke).toBe('#a21caf');
  });

  it('uses indigo default colors for plain class "task task0"', () => {
    makeTaskRect('task task0');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.color).toBe('#c7d7f7');
    expect(t.stroke).toBe('#6366f1');
  });

  it('skips task rect with zero-dimension BBox', () => {
    makeTaskRect('task task0', 'bad', mockBBox(0, 0, 0, 0));
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'))).toHaveLength(0);
  });

  it('skips task rect wider than 8000px', () => {
    makeTaskRect('task task0', 'big', mockBBox(0, 0, 9000, 20));
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'))).toHaveLength(0);
  });

  it('extracts label via sibling text id="{taskId}-text"', () => {
    makeTaskRect('task active0', 'dev1');
    makeTaskText('dev1', '後端實作');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.label).toBe('後端實作');
  });

  it('returns empty label when no matching text element', () => {
    makeTaskRect('task task0', 'des1');
    const [t] = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(t.label).toBe('');
  });

  it('assigns sequential unique IDs to multiple task bars', () => {
    makeTaskRect('task done0', 'des1');
    makeTaskRect('task active0', 'dev1');
    const tasks = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'));
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).not.toBe(tasks[1].id);
  });

  // ── Section bands ──────────────────────────────────────────────────────────

  it('finds section band with class "section section0"', () => {
    makeSectionRect('section section0', mockBBox(0, 0, 600, 80));
    const sections = parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-section'));
    expect(sections).toHaveLength(1);
    expect(sections[0].shape).toBe('rect');
    expect(sections[0].type).toBe('cluster');
    expect(sections[0].stroke).toBe('transparent');
  });

  it('finds section band with class "section section1"', () => {
    makeSectionRect('section section1', mockBBox(0, 80, 600, 80));
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-section'))).toHaveLength(1);
  });

  it('does NOT treat section rects as task bars', () => {
    makeSectionRect('section section0', mockBBox(0, 0, 600, 80));
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-task'))).toHaveLength(0);
  });

  it('does NOT treat task rects as section bands', () => {
    makeTaskRect('task task0');
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-section'))).toHaveLength(0);
  });

  it('skips section rect with zero-dimension BBox', () => {
    makeSectionRect('section section0', mockBBox(0, 0, 0, 0));
    expect(parseGanttNodes(svg).filter(n => n.id.startsWith('gantt-section'))).toHaveLength(0);
  });

  it('both task and section nodes are captured together', () => {
    makeSectionRect('section section0', mockBBox(0, 0, 600, 80));
    makeTaskRect('task done0', 'des1');
    makeTaskRect('task active0', 'dev1');
    const nodes = parseGanttNodes(svg);
    expect(nodes.filter(n => n.id.startsWith('gantt-section'))).toHaveLength(1);
    expect(nodes.filter(n => n.id.startsWith('gantt-task'))).toHaveLength(2);
  });
});

// ─── parseGanttEdges ─────────────────────────────────────────────────────────

describe('parseGanttEdges', () => {
  it('returns empty array for an empty SVG', () => {
    expect(parseGanttEdges(svg, false)).toEqual([]);
  });

  it('generates a flow edge for each task bar', () => {
    makeTaskRect('task task0', 'des1', mockBBox(0, 0, 200, 20));
    const flows = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    expect(flows).toHaveLength(1);
  });

  it('flow edge type="link", hasArrow=false, noSnap=true', () => {
    makeTaskRect('task task0', 'des1', mockBBox(0, 0, 200, 20));
    const [e] = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    expect(e.type).toBe('link');
    expect(e.hasArrow).toBe(false);
    expect(e.noSnap).toBe(true);
  });

  it('flow edge pathD is a horizontal M…L line', () => {
    makeTaskRect('task task0', 'des1', mockBBox(10, 5, 100, 20));
    const [e] = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    expect(e.pathD).toMatch(/^M\s+[\d.]+\s+[\d.]+\s+L\s+[\d.]+\s+[\d.]+$/);
  });

  it('skips task bars narrower than 20px for flow edges', () => {
    makeTaskRect('task task0', 'des1', mockBBox(0, 0, 15, 20));
    expect(parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'))).toHaveLength(0);
  });

  it('section rects do NOT generate flow edges', () => {
    makeSectionRect('section section0', mockBBox(0, 0, 600, 80));
    expect(parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'))).toHaveLength(0);
  });

  it('flow edge stroke falls back to blue (non-premium) when fill is absent', () => {
    makeTaskRect('task task0', 'des1', mockBBox(0, 0, 200, 20));
    const [e] = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    expect(e.stroke).toBe('#60a5fa');
  });

  it('flow edge stroke falls back to indigo (premium) when fill is absent', () => {
    makeTaskRect('task task0', 'des1', mockBBox(0, 0, 200, 20));
    const [e] = parseGanttEdges(svg, true).filter(e => e.id.startsWith('gantt-flow'));
    expect(e.stroke).toBe('#6366f1');
  });

  it('captures g.grid lines as structural edges', () => {
    const gridG = el('g'); gridG.setAttribute('class', 'grid');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '50'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '50'); line.setAttribute('y2', '200');
    gridG.appendChild(line); svg.appendChild(gridG);

    const gridEdges = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-grid'));
    expect(gridEdges).toHaveLength(1);
    expect(gridEdges[0].type).toBe('structural');
  });

  it('grid edges use premium color #94a3b8 when isPremium=true', () => {
    const gridG = el('g'); gridG.setAttribute('class', 'grid');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '100');
    gridG.appendChild(line); svg.appendChild(gridG);
    const [e] = parseGanttEdges(svg, true).filter(e => e.id.startsWith('gantt-grid'));
    expect(e.stroke).toBe('#94a3b8');
  });

  it('grid edges use color #aaa when isPremium=false', () => {
    const gridG = el('g'); gridG.setAttribute('class', 'grid');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '100');
    gridG.appendChild(line); svg.appendChild(gridG);
    const [e] = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-grid'));
    expect(e.stroke).toBe('#aaa');
  });

  it('captures g.today > line as structural dashed red edge', () => {
    const todayG = el('g'); todayG.setAttribute('class', 'today');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '300'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '300'); line.setAttribute('y2', '200');
    todayG.appendChild(line); svg.appendChild(todayG);

    const todayEdges = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-today'));
    expect(todayEdges).toHaveLength(1);
    expect(todayEdges[0].type).toBe('structural');
    expect(todayEdges[0].stroke).toBe('#ef4444');
    expect(todayEdges[0].dash).toEqual([6, 4]);
    expect(todayEdges[0].noSnap).toBe(true);
  });

  it('generates multiple flow edges for multiple task bars', () => {
    makeTaskRect('task done0',   'des1', mockBBox(0,  0, 200, 20));
    makeTaskRect('task active0', 'dev1', mockBBox(0, 30, 150, 20));
    const flows = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    expect(flows).toHaveLength(2);
  });

  it('flow edge IDs are unique across multiple bars', () => {
    makeTaskRect('task task0', 'a', mockBBox(0,  0, 200, 20));
    makeTaskRect('task task0', 'b', mockBBox(0, 30, 200, 20));
    const flows = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-flow'));
    const ids = flows.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('captures grid line nested inside d3 tick structure (g.grid > g.tick > line)', () => {
    // Mermaid uses d3-axis which wraps each tick in a <g class="tick">
    const gridG = el<SVGGElement>('g');
    gridG.setAttribute('class', 'grid');
    const tick = el<SVGGElement>('g');
    tick.setAttribute('class', 'tick');
    tick.setAttribute('transform', 'translate(100, 0)');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '-200');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '0');
    tick.appendChild(line);
    gridG.appendChild(tick);
    svg.appendChild(gridG);

    const gridEdges = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-grid'));
    expect(gridEdges).toHaveLength(1);
    expect(gridEdges[0].type).toBe('structural');
    expect(gridEdges[0].noSnap).toBe(true);
  });

  it('captures line.today as a dashed red structural edge', () => {
    // Mermaid also sets class="today" directly on the line in some builds
    const line = el<SVGLineElement>('line');
    line.setAttribute('class', 'today');
    line.setAttribute('x1', '300'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '300'); line.setAttribute('y2', '200');
    svg.appendChild(line);

    const todayEdges = parseGanttEdges(svg, false).filter(e => e.id.startsWith('gantt-today'));
    expect(todayEdges).toHaveLength(1);
    expect(todayEdges[0].stroke).toBe('#ef4444');
    expect(todayEdges[0].dash).toEqual([6, 4]);
    expect(todayEdges[0].noSnap).toBe(true);
  });
});

// ─── parseGanttLabels ─────────────────────────────────────────────────────────

describe('parseGanttLabels', () => {
  it('returns empty array for an empty SVG', () => {
    expect(parseGanttLabels(svg)).toEqual([]);
  });

  it('returns empty array when no sectionTitle text exists', () => {
    makeTaskRect('task task0', 'des1');
    expect(parseGanttLabels(svg)).toHaveLength(0);
  });

  it('finds a text element with class "sectionTitle"', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle sectionTitle0');
    txt.setAttribute('x', '10');
    txt.setAttribute('y', '40');
    txt.textContent = '規劃';
    svg.appendChild(txt);

    const labels = parseGanttLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('規劃');
  });

  it('falls back to y attribute when getBBox is unavailable', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle sectionTitle1');
    txt.setAttribute('x', '10');
    txt.setAttribute('y', '120');
    txt.textContent = '開發';
    // override getBBox to throw so fallback path is exercised
    (txt as unknown as SVGGraphicsElement).getBBox = () => { throw new Error('no bbox'); };
    svg.appendChild(txt);

    const [lbl] = parseGanttLabels(svg);
    expect(lbl.y).toBe(120);
  });

  it('returns align="center"', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle');
    txt.textContent = '測試';
    svg.appendChild(txt);
    expect(parseGanttLabels(svg)[0].align).toBe('center');
  });

  it('returns fontSize=11', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle');
    txt.textContent = '測試';
    svg.appendChild(txt);
    expect(parseGanttLabels(svg)[0].fontSize).toBe(11);
  });

  it('skips sectionTitle elements with empty text', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle');
    txt.textContent = '   ';
    svg.appendChild(txt);
    expect(parseGanttLabels(svg)).toHaveLength(0);
  });

  it('collects text from tspan children', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle sectionTitle0');
    const tspan = el<SVGElement>('tspan');
    tspan.textContent = '規劃';
    txt.appendChild(tspan);
    svg.appendChild(txt);
    expect(parseGanttLabels(svg)[0].text).toBe('規劃');
  });

  it('does NOT pick up taskText elements', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'taskText taskText0');
    txt.textContent = '需求分析';
    svg.appendChild(txt);
    expect(parseGanttLabels(svg)).toHaveLength(0);
  });

  it('returns multiple section labels', () => {
    ['規劃', '開發', '測試'].forEach((name, i) => {
      const txt = el<SVGTextElement>('text');
      txt.setAttribute('class', `sectionTitle sectionTitle${i}`);
      txt.setAttribute('y', String(40 + i * 80));
      txt.textContent = name;
      svg.appendChild(txt);
    });
    const labels = parseGanttLabels(svg);
    expect(labels).toHaveLength(3);
    expect(labels.map(l => l.text)).toEqual(['規劃', '開發', '測試']);
  });

  // ── Diagram title ───────────────────────────────────────────────────────────

  it('extracts diagram title from text.titleText', () => {
    makeTitleText('專案開發時程');
    const [lbl] = parseGanttLabels(svg);
    expect(lbl.text).toBe('專案開發時程');
    expect(lbl.bold).toBe(true);
    expect(lbl.fontSize).toBe(20);
    expect(lbl.color).toBe('#1e293b');
    expect(lbl.align).toBe('center');
  });

  it('title is the first label regardless of DOM order', () => {
    // section label added before titleText in the DOM
    const sec = el<SVGTextElement>('text');
    sec.setAttribute('class', 'sectionTitle');
    sec.textContent = '規劃';
    svg.appendChild(sec);
    makeTitleText('標題');
    const labels = parseGanttLabels(svg);
    expect(labels[0].text).toBe('標題');
    expect(labels[1].text).toBe('規劃');
  });

  // ── Date tick labels ────────────────────────────────────────────────────────

  it('extracts date tick labels from g.grid text elements', () => {
    makeGridTickText('Jan 1');
    const [lbl] = parseGanttLabels(svg);
    expect(lbl.text).toBe('Jan 1');
    expect(lbl.fontSize).toBe(10);
    expect(lbl.bold).toBe(false);
    expect(lbl.color).toBe('#475569');
    expect(lbl.align).toBe('center');
  });

  it('ignores whitespace-only text nodes inside g.grid', () => {
    const gridG = el<SVGGElement>('g');
    gridG.setAttribute('class', 'grid');
    const txt = el<SVGTextElement>('text');
    txt.textContent = '   ';
    gridG.appendChild(txt);
    svg.appendChild(gridG);
    expect(parseGanttLabels(svg)).toHaveLength(0);
  });

  it('captures multiple date tick labels in order', () => {
    ['Jan 1', 'Jan 8', 'Jan 15'].forEach(d => makeGridTickText(d));
    const labels = parseGanttLabels(svg);
    expect(labels.map(l => l.text)).toEqual(['Jan 1', 'Jan 8', 'Jan 15']);
  });

  // ── Section label x positioning (sidePad) ──────────────────────────────────

  it('pins section label x to sidePad/2 when task bars define sidebar width', () => {
    // Task bar: BBox x=75, w=100 → cx=125, left=75 → sidePad=75 → x=37.5
    makeTaskRect('task task0', 'des1', mockBBox(75, 0, 100, 20));
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle');
    txt.setAttribute('x', '10');
    txt.textContent = '規劃';
    svg.appendChild(txt);
    const [lbl] = parseGanttLabels(svg);
    expect(lbl.x).toBe(37.5);
  });

  it('falls back to the x attribute when no task bars define sidePad', () => {
    const txt = el<SVGTextElement>('text');
    txt.setAttribute('class', 'sectionTitle');
    txt.setAttribute('x', '10');
    txt.textContent = '規劃';
    svg.appendChild(txt);
    const [lbl] = parseGanttLabels(svg);
    expect(lbl.x).toBe(10);
  });
});

// ─── Integration ─────────────────────────────────────────────────────────────

describe('GanttParser integration', () => {
  it('a 3-task, 2-section chart yields correct node, edge and label counts', () => {
    makeSectionRect('section section0', mockBBox(0,   0, 600, 80));
    makeSectionRect('section section1', mockBBox(0,  80, 600, 80));
    makeTaskRect('task done0',   'des1',  mockBBox(10,  10, 100, 20));
    makeTaskRect('task active0', 'dev1',  mockBBox(10,  40, 160, 20));
    makeTaskRect('task task0',   'test1', mockBBox(10,  70,  80, 20));
    makeTaskText('des1',  '需求分析');
    makeTaskText('dev1',  '後端實作');
    makeTaskText('test1', '整合測試');

    // Section title labels
    ['規劃', '開發'].forEach((name, i) => {
      const txt = el<SVGTextElement>('text');
      txt.setAttribute('class', `sectionTitle sectionTitle${i}`);
      txt.setAttribute('y', String(40 + i * 80));
      txt.textContent = name;
      svg.appendChild(txt);
    });

    const nodes  = parseGanttNodes(svg);
    const edges  = parseGanttEdges(svg, false);
    const lbls   = parseGanttLabels(svg);

    expect(nodes.filter(n => n.id.startsWith('gantt-section'))).toHaveLength(2);
    expect(nodes.filter(n => n.id.startsWith('gantt-task'))).toHaveLength(3);
    expect(edges.filter(e => e.id.startsWith('gantt-flow'))).toHaveLength(3);
    expect(lbls).toHaveLength(2);
    expect(lbls.map(l => l.text)).toEqual(['規劃', '開發']);

    // Section clusters render in background
    expect(nodes.filter(n => n.id.startsWith('gantt-section'))[0].type).toBe('cluster');

    const taskLabels = nodes.filter(n => n.id.startsWith('gantt-task')).map(n => n.label);
    expect(taskLabels).toContain('需求分析');
    expect(taskLabels).toContain('後端實作');
    expect(taskLabels).toContain('整合測試');
  });
});
