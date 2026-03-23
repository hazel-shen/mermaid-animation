import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseWedgePath, parsePieNodes, parsePieEdges, parsePieLabels } from '../services/PieParser';
import { resetIdCounter } from '../utils/parser-base';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;
const mockBBox = (x = 0, y = 0, w = 60, h = 16): DOMRect =>
  ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect);

// ─────────────────────────────────────────────────────────────────────────────
// parseWedgePath — pure function, no DOM needed
// ─────────────────────────────────────────────────────────────────────────────

describe('parseWedgePath', () => {
  const ID = { tx: 0, ty: 0, sx: 1, sy: 1 }; // identity transform

  it('returns null for empty string', () => {
    expect(parseWedgePath('', 0, 0, 1, 1)).toBeNull();
  });

  it('returns null when fewer than 3 path tokens', () => {
    expect(parseWedgePath('M 10,20', 0, 0, 1, 1)).toBeNull();
  });

  it('returns null when no A token present', () => {
    // M → L → Z, no arc
    expect(parseWedgePath('M 10,20 L 0,0 Z', 0, 0, 1, 1)).toBeNull();
  });

  it('returns null when A token has fewer than 7 numbers', () => {
    expect(parseWedgePath('M 10,20 A 50,50,0,1 L 0,0 Z', 0, 0, 1, 1)).toBeNull();
  });

  it('returns null when L token is missing', () => {
    // A token present but no L
    expect(parseWedgePath('M 10,20 A 50,50,0,1,0,30,40 Z', 0, 0, 1, 1)).toBeNull();
  });

  it('returns null when M token has fewer than 2 numbers', () => {
    expect(parseWedgePath('M 10 A 50,50,0,1,0,30,40 L 0,0 Z', 0, 0, 1, 1)).toBeNull();
  });

  it('correctly extracts center, radius and angles for identity transform', () => {
    // Quarter wedge: start at (1,0), arc to (0,1), center at (0,0), radius 1
    // startAngle = atan2(0,1) = 0, endAngle = atan2(1,0) = PI/2
    const d = 'M 1,0 A 1,1,0,0,1,0,1 L 0,0 Z';
    const result = parseWedgePath(d, 0, 0, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.cx).toBeCloseTo(0);
    expect(result!.cy).toBeCloseTo(0);
    expect(result!.radius).toBeCloseTo(1);
    expect(result!.startAngle).toBeCloseTo(0);
    expect(result!.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it('applies translation transform to all points', () => {
    const d = 'M 1,0 A 1,1,0,0,1,0,1 L 0,0 Z';
    const result = parseWedgePath(d, 100, 200, 1, 1);
    expect(result!.cx).toBeCloseTo(100);
    expect(result!.cy).toBeCloseTo(200);
    expect(result!.radius).toBeCloseTo(1);
  });

  it('applies scale transform to radius and coordinates', () => {
    const d = 'M 1,0 A 1,1,0,0,1,0,1 L 0,0 Z';
    const result = parseWedgePath(d, 0, 0, 2, 2);
    expect(result!.cx).toBeCloseTo(0);
    expect(result!.cy).toBeCloseTo(0);
    expect(result!.radius).toBeCloseTo(2); // localRadius * |sx|
    expect(result!.startAngle).toBeCloseTo(0);
    expect(result!.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it('applies combined translation and scale transform', () => {
    const d = 'M 1,0 A 1,1,0,0,1,0,1 L 0,0 Z';
    const result = parseWedgePath(d, 50, 50, 3, 3);
    expect(result!.cx).toBeCloseTo(50);   // 3*0 + 50
    expect(result!.cy).toBeCloseTo(50);   // 3*0 + 50
    expect(result!.radius).toBeCloseTo(3);
  });

  it('handles space-separated numbers in path', () => {
    const d = 'M 10 0 A 10 10 0 0 1 0 10 L 0 0 Z';
    const result = parseWedgePath(d, 0, 0, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.radius).toBeCloseTo(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePieNodes
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePieNodes', () => {
  let svg: SVGSVGElement;

  // A valid d3-arc path for a half-circle wedge (startAngle=0, endAngle=PI)
  // M (r,0)  A r,r,0,1,1,(-r,0)  L 0,0  Z
  const halfArcD = (r: number) => `M ${r},0 A ${r},${r},0,1,1,${-r},0 L 0,0 Z`;

  beforeEach(() => {
    resetIdCounter();
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'rgb(100, 100, 200)',
      stroke: 'rgb(255, 255, 255)',
    } as unknown as CSSStyleDeclaration);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for empty SVG', () => {
    expect(parsePieNodes(svg)).toEqual([]);
  });

  it('finds path.pieCircle', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)).toHaveLength(1);
  });

  it('finds path with class containing "slice"', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('slice-0');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)).toHaveLength(1);
  });

  it('finds path inside g.pie', () => {
    const g = el('g'); g.classList.add('pie');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', halfArcD(100));
    g.appendChild(path);
    svg.appendChild(g);
    expect(parsePieNodes(svg)).toHaveLength(1);
  });

  it('skips path with d attribute length <= 10', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', 'M 0,0 Z');
    svg.appendChild(path);
    expect(parsePieNodes(svg)).toHaveLength(0);
  });

  it('skips path where parseWedgePath returns null', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    // valid length but no arc → parseWedgePath returns null
    path.setAttribute('d', 'M 10,20 L 0,0 L 5,5 Z');
    svg.appendChild(path);
    expect(parsePieNodes(svg)).toHaveLength(0);
  });

  it('sets shape="pie" on wedge nodes', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].shape).toBe('pie');
  });

  it('sets type="node" on wedge nodes', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].type).toBe('node');
  });

  it('attaches pieWedge to node', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].pieWedge).toBeDefined();
  });

  it('computes label as percentage from sweep angle (half-circle = 50%)', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    // half-circle sweep = PI → 50%
    expect(parsePieNodes(svg)[0].label).toBe('50%');
  });

  it('uses computed fill as color', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].color).toBe('rgb(100, 100, 200)');
  });

  it('falls back to #818cf8 when computed fill is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none', stroke: 'none',
    } as unknown as CSSStyleDeclaration);
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].color).toBe('#818cf8');
  });

  it('uses computed stroke', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].stroke).toBe('rgb(255, 255, 255)');
  });

  it('falls back to #fff when computed stroke is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none', stroke: 'none',
    } as unknown as CSSStyleDeclaration);
    const path = el<SVGPathElement>('path');
    path.classList.add('pieCircle');
    path.setAttribute('d', halfArcD(100));
    svg.appendChild(path);
    expect(parsePieNodes(svg)[0].stroke).toBe('#fff');
  });

  it('assigns sequential ids to wedge nodes', () => {
    for (let i = 0; i < 2; i++) {
      const path = el<SVGPathElement>('path');
      path.classList.add('pieCircle');
      path.setAttribute('d', halfArcD(100));
      svg.appendChild(path);
    }
    const nodes = parsePieNodes(svg);
    expect(nodes[0].id).toBe('pie-slice-1');
    expect(nodes[1].id).toBe('pie-slice-2');
  });

  it('processes legend rects and gives them shape="rect"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'rgb(100, 200, 100)', stroke: 'rgb(100, 200, 100)',
    } as unknown as CSSStyleDeclaration);
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('legendRect');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '20');
    rect.setAttribute('width', '12');
    rect.setAttribute('height', '12');
    svg.appendChild(rect);
    const nodes = parsePieNodes(svg);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('rect');
  });

  it('skips legend rect with zero width or height', () => {
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('legendRect');
    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
    rect.setAttribute('width', '0'); rect.setAttribute('height', '12');
    svg.appendChild(rect);
    expect(parsePieNodes(svg)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePieEdges
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePieEdges', () => {
  it('always returns an empty array', () => {
    const svg = el<SVGSVGElement>('svg');
    expect(parsePieEdges(svg)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePieLabels
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePieLabels', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true, writable: true,
      value: () => mockBBox(),
    });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'rgb(30, 41, 59)',
    } as unknown as CSSStyleDeclaration);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error intentionally removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
    vi.restoreAllMocks();
  });

  it('returns empty array for empty SVG', () => {
    expect(parsePieLabels(svg)).toEqual([]);
  });

  it('finds title text via text.pieTitleText', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('pieTitleText');
    t.textContent = 'My Pie Chart';
    svg.appendChild(t);
    const labels = parsePieLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('My Pie Chart');
  });

  it('finds title text via text[class*="title"]', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('chart-title');
    t.textContent = 'Title';
    svg.appendChild(t);
    expect(parsePieLabels(svg)).toHaveLength(1);
  });

  it('sets bold=true for title labels', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('pieTitleText');
    t.textContent = 'Title';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].bold).toBe(true);
  });

  it('sets align="center" for title labels', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('pieTitleText');
    t.textContent = 'Title';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].align).toBe('center');
  });

  it('finds legend text via text.legend', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = 'Category A';
    svg.appendChild(t);
    const labels = parsePieLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('Category A');
  });

  it('finds legend text via .legendText', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legendText');
    t.textContent = 'Category B';
    svg.appendChild(t);
    expect(parsePieLabels(svg)).toHaveLength(1);
  });

  it('sets bold=false for legend labels', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = 'Legend';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].bold).toBe(false);
  });

  it('sets align="left" for legend labels', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = 'Legend';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].align).toBe('left');
  });

  it('skips text element with zero-dimension BBox', () => {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true, writable: true,
      value: () => mockBBox(0, 0, 0, 0),
    });
    const t = el<SVGTextElement>('text');
    t.classList.add('pieTitleText');
    t.textContent = 'Title';
    svg.appendChild(t);
    expect(parsePieLabels(svg)).toHaveLength(0);
  });

  it('trims whitespace from text content', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = '  Apple  ';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].text).toBe('Apple');
  });

  it('uses computed fill as color, falls back to #1e293b when fill is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none',
    } as unknown as CSSStyleDeclaration);
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = 'Label';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].color).toBe('#1e293b');
  });

  it('uses computed fill as color when present', () => {
    const t = el<SVGTextElement>('text');
    t.classList.add('legend');
    t.textContent = 'Label';
    svg.appendChild(t);
    expect(parsePieLabels(svg)[0].color).toBe('rgb(30, 41, 59)');
  });
});
