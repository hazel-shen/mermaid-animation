/**
 * SankeyParser tests.
 *
 * Mermaid sankey-beta SVG contract:
 *   Node bars : <rect> width=10, height varies (narrow vertical bar)
 *   Flow bands: open <path> (no Z), stroke-width = band thickness,
 *               stroke = url("#linearGradient-N") referencing <defs>
 *   Labels    : <text> elements beside node bars
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSankeyNodes, parseSankeyEdges, parseSankeyLabels, inferSankeyNodeColors } from '../../services/SankeyParser';
import { resetIdCounter } from '../../utils/parser-base';
import type { DiagramEdge, DiagramNode } from '../../types';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

const mockBBox = (x = 0, y = 0, w = 80, h = 14): DOMRect =>
  ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect);

// A realistic sankey ribbon path:
//   top edge:    M 10 20  C 50 20 50 80 90 80
//   bottom edge: C 50 90 50 30 10 30
// sourceX = min(10, 50, 50, 90, 50, 50, 10) = 10  → right edge of source node (cx=5, w=10)
// targetX = max(...)                          = 90  → left edge of target node (cx=95, w=10)
const BAND_PATH = 'M 10 20 C 50 20 50 80 90 80 C 50 90 50 30 10 30';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a sankey node bar rect (width=10 by default). */
const makeNodeRect = (x: number, y: number, w = 10, h = 60, fill = 'none'): SVGRectElement => {
  const rect = el<SVGRectElement>('rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  if (fill !== 'none') rect.setAttribute('fill', fill);
  svg.appendChild(rect);
  return rect;
};

/** Build a sankey flow band path with a given stroke-width and solid color. */
const makeBandPath = (d: string, strokeWidth: number, stroke: string): SVGPathElement => {
  const path = el<SVGPathElement>('path');
  path.setAttribute('d', d);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    strokeWidth: String(strokeWidth),
    stroke,
    fill: 'none',
  } as unknown as CSSStyleDeclaration);
  svg.appendChild(path);
  return path;
};

// ─── parseSankeyNodes ─────────────────────────────────────────────────────────

describe('parseSankeyNodes', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none',
      stroke: 'none',
    } as unknown as CSSStyleDeclaration);
  });

  it('returns empty array for empty SVG', () => {
    expect(parseSankeyNodes(svg)).toEqual([]);
  });

  it('collects a rect with width=10', () => {
    makeNodeRect(0, 0, 10, 60);
    expect(parseSankeyNodes(svg)).toHaveLength(1);
  });

  it('skips rect with width > 15 (background / non-node)', () => {
    makeNodeRect(0, 0, 600, 400); // wide background rect
    expect(parseSankeyNodes(svg)).toHaveLength(0);
  });

  it('skips rect with width exactly 16', () => {
    makeNodeRect(0, 0, 16, 60);
    expect(parseSankeyNodes(svg)).toHaveLength(0);
  });

  it('collects rect with width exactly 15', () => {
    makeNodeRect(0, 0, 15, 60);
    expect(parseSankeyNodes(svg)).toHaveLength(1);
  });

  it('skips rect with zero width', () => {
    makeNodeRect(0, 0, 0, 60);
    expect(parseSankeyNodes(svg)).toHaveLength(0);
  });

  it('skips rect with zero height', () => {
    makeNodeRect(0, 0, 10, 0);
    expect(parseSankeyNodes(svg)).toHaveLength(0);
  });

  it('sets shape="rect" on collected nodes', () => {
    makeNodeRect(0, 0);
    expect(parseSankeyNodes(svg)[0].shape).toBe('rect');
  });

  it('sets type="node" on collected nodes', () => {
    makeNodeRect(0, 0);
    expect(parseSankeyNodes(svg)[0].type).toBe('node');
  });

  it('assigns sequential ids', () => {
    makeNodeRect(0, 0);
    makeNodeRect(100, 0);
    const nodes = parseSankeyNodes(svg);
    expect(nodes[0].id).toBe('sankey-node-1');
    expect(nodes[1].id).toBe('sankey-node-2');
  });

  it('computes center x from rect x + width/2', () => {
    makeNodeRect(80, 0, 10, 60); // cx = 80 + 5 = 85
    expect(parseSankeyNodes(svg)[0].x).toBeCloseTo(85);
  });

  it('computes center y from rect y + height/2', () => {
    makeNodeRect(0, 40, 10, 60); // cy = 40 + 30 = 70
    expect(parseSankeyNodes(svg)[0].y).toBeCloseTo(70);
  });

  it('uses fill attribute as color when computed fill is "none"', () => {
    makeNodeRect(0, 0, 10, 60, '#4e79a7');
    expect(parseSankeyNodes(svg)[0].color).toBe('#4e79a7');
  });

  it('sets color to __unresolved__ when no fill is available', () => {
    makeNodeRect(0, 0, 10, 60); // no fill attr, computed fill = 'none'
    expect(parseSankeyNodes(svg)[0].color).toBe('__unresolved__');
  });

  it('uses inline style fill when computed fill is "none"', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('width', '10');
    rect.setAttribute('height', '60');
    rect.setAttribute('style', 'fill: #e15759;');
    svg.appendChild(rect);
    expect(parseSankeyNodes(svg)[0].color).toBe('#e15759');
  });

  it('skips near-white fill (luminance > 0.92) and falls back to __unresolved__', () => {
    makeNodeRect(0, 0, 10, 60, '#ffffff');
    expect(parseSankeyNodes(svg)[0].color).toBe('__unresolved__');
  });
});

// ─── parseSankeyEdges ─────────────────────────────────────────────────────────

describe('parseSankeyEdges', () => {
  it('returns empty array for empty SVG', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      strokeWidth: '0', stroke: 'none', fill: 'none',
    } as unknown as CSSStyleDeclaration);
    expect(parseSankeyEdges(svg)).toEqual([]);
  });

  it('skips path with d length < 20', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 1 1');
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      strokeWidth: '10', stroke: '#ff0000', fill: 'none',
    } as unknown as CSSStyleDeclaration);
    svg.appendChild(path);
    expect(parseSankeyEdges(svg)).toHaveLength(0);
  });

  it('skips closed paths (containing Z)', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 20 C 50 20 50 80 90 80 Z');
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      strokeWidth: '10', stroke: '#ff0000', fill: 'none',
    } as unknown as CSSStyleDeclaration);
    svg.appendChild(path);
    expect(parseSankeyEdges(svg)).toHaveLength(0);
  });

  it('skips path with strokeWidth < 1', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', BAND_PATH);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      strokeWidth: '0', stroke: '#ff0000', fill: 'none',
    } as unknown as CSSStyleDeclaration);
    svg.appendChild(path);
    expect(parseSankeyEdges(svg)).toHaveLength(0);
  });

  it('collects open path with valid strokeWidth and solid stroke color', () => {
    makeBandPath(BAND_PATH, 15, '#4e79a7');
    expect(parseSankeyEdges(svg)).toHaveLength(1);
  });

  it('sets type="link" on collected edges', () => {
    makeBandPath(BAND_PATH, 15, '#4e79a7');
    expect(parseSankeyEdges(svg)[0].type).toBe('link');
  });

  it('sets lineWidth from strokeWidth', () => {
    makeBandPath(BAND_PATH, 25, '#4e79a7');
    expect(parseSankeyEdges(svg)[0].lineWidth).toBe(25);
  });

  it('sets sankeyFillPath equal to pathD', () => {
    makeBandPath(BAND_PATH, 15, '#4e79a7');
    const edge = parseSankeyEdges(svg)[0];
    expect(edge.sankeyFillPath).toBe(edge.pathD);
  });

  it('sets sankeyGradient to [color, color] for a plain solid stroke', () => {
    makeBandPath(BAND_PATH, 15, '#4e79a7');
    expect(parseSankeyEdges(svg)[0].sankeyGradient).toEqual(['#4e79a7', '#4e79a7']);
  });

  it('assigns sequential ids', () => {
    makeBandPath(BAND_PATH, 15, '#4e79a7');
    makeBandPath(BAND_PATH, 15, '#f28e2c');
    const edges = parseSankeyEdges(svg);
    expect(edges[0].id).toBe('sankey-link-1');
    expect(edges[1].id).toBe('sankey-link-2');
  });
});

// ─── inferSankeyNodeColors ────────────────────────────────────────────────────

describe('inferSankeyNodeColors', () => {
  const makeNode = (cx: number, color = '__unresolved__'): DiagramNode => ({
    id: 'n', label: '', type: 'node', shape: 'rect',
    x: cx, y: 50, width: 10, height: 60,
    color, stroke: color,
  });

  const makeEdge = (pathD: string, c0: string, c1: string): DiagramEdge => ({
    id: 'e', pathD, stroke: c0, type: 'link',
    sankeyFillPath: pathD,
    sankeyGradient: [c0, c1],
  });

  it('returns nodes unchanged when none are __unresolved__', () => {
    const node = makeNode(5, '#4e79a7');
    const result = inferSankeyNodeColors([node], []);
    expect(result[0].color).toBe('#4e79a7');
  });

  it('infers source node color from edge gradient c0 (rightEdge ≈ sourceX)', () => {
    // node cx=5, width=10 → rightEdge=10; BAND_PATH sourceX=10
    const node = makeNode(5);
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#4e79a7');
  });

  it('infers target node color from edge gradient c1 (leftEdge ≈ targetX)', () => {
    // node cx=95, width=10 → leftEdge=90; BAND_PATH targetX=90
    const node = makeNode(95);
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#f28e2c');
  });

  it('also sets stroke to the inferred color', () => {
    const node = makeNode(5);
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].stroke).toBe('#4e79a7');
  });

  it('falls back to #94a3b8 when no edge matches the node', () => {
    const node = makeNode(500); // cx=500, no edge touches it
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#94a3b8');
  });

  it('does not overwrite a node that already has a resolved color', () => {
    const node = makeNode(5, '#e15759'); // already resolved
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#e15759');
  });

  it('handles multiple nodes in one pass', () => {
    const src = makeNode(5);              // rightEdge=10 → c0
    const tgt = makeNode(95);             // leftEdge=90  → c1
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([src, tgt], [edge]);
    expect(result[0].color).toBe('#4e79a7');
    expect(result[1].color).toBe('#f28e2c');
  });

  it('uses first matched color and does not overwrite with subsequent edges', () => {
    const node = makeNode(5);
    const edge1 = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const edge2 = makeEdge(BAND_PATH, '#e15759', '#59a14f');
    const result = inferSankeyNodeColors([node], [edge1, edge2]);
    // First match wins
    expect(result[0].color).toBe('#4e79a7');
  });

  it('skips edges with no sankeyGradient', () => {
    const node = makeNode(5);
    const edge: DiagramEdge = {
      id: 'e', pathD: BAND_PATH, stroke: '#4e79a7', type: 'link',
      // no sankeyGradient
    };
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#94a3b8'); // fallback
  });

  it('tolerance allows small floating-point offsets (within 30px)', () => {
    // node rightEdge = 10.5 + 5 = 15.5 — but BAND_PATH sourceX = 10
    // difference = 5.5 < 30 → should still match
    const node: DiagramNode = {
      id: 'n', label: '', type: 'node', shape: 'rect',
      x: 10.5, y: 50, width: 10, height: 60,
      color: '__unresolved__', stroke: '__unresolved__',
    };
    const edge = makeEdge(BAND_PATH, '#4e79a7', '#f28e2c');
    const result = inferSankeyNodeColors([node], [edge]);
    expect(result[0].color).toBe('#4e79a7');
  });
});

// ─── parseSankeyLabels ────────────────────────────────────────────────────────

describe('parseSankeyLabels', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'rgb(30, 41, 59)',
      textAnchor: 'start',
    } as unknown as CSSStyleDeclaration);
  });

  it('returns empty array for empty SVG', () => {
    expect(parseSankeyLabels(svg)).toEqual([]);
  });

  it('skips text with empty content', () => {
    const t = el<SVGTextElement>('text');
    t.textContent = '   ';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)).toHaveLength(0);
  });

  it('skips text with zero-dimension BBox', () => {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true, writable: true,
      value: () => mockBBox(0, 0, 0, 0),
    });
    const t = el<SVGTextElement>('text');
    t.textContent = 'Nuclear';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)).toHaveLength(0);
  });

  it('collects text with valid content and BBox', () => {
    const t = el<SVGTextElement>('text');
    t.textContent = 'Nuclear';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)).toHaveLength(1);
  });

  it('uses trimmed text content', () => {
    const t = el<SVGTextElement>('text');
    t.textContent = '  Losses  ';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].text).toBe('Losses');
  });

  it('uses computed fill as color', () => {
    const t = el<SVGTextElement>('text');
    t.textContent = 'Gas';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].color).toBe('rgb(30, 41, 59)');
  });

  it('falls back to #1e293b when fill is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none', textAnchor: 'start',
    } as unknown as CSSStyleDeclaration);
    const t = el<SVGTextElement>('text');
    t.textContent = 'Gas';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].color).toBe('#1e293b');
  });

  it('maps text-anchor "end" to align "right"', () => {
    const t = el<SVGTextElement>('text');
    t.setAttribute('text-anchor', 'end');
    t.textContent = 'Losses';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].align).toBe('right');
  });

  it('maps text-anchor "middle" to align "center"', () => {
    const t = el<SVGTextElement>('text');
    t.setAttribute('text-anchor', 'middle');
    t.textContent = 'Grid';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].align).toBe('center');
  });

  it('defaults to align "left" when text-anchor is "start"', () => {
    const t = el<SVGTextElement>('text');
    t.setAttribute('text-anchor', 'start');
    t.textContent = 'Coal';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].align).toBe('left');
  });

  it('fontSize is at least 10', () => {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true, writable: true,
      value: () => mockBBox(0, 0, 40, 2), // very small height
    });
    const t = el<SVGTextElement>('text');
    t.textContent = 'Tiny';
    svg.appendChild(t);
    expect(parseSankeyLabels(svg)[0].fontSize).toBeGreaterThanOrEqual(10);
  });
});
