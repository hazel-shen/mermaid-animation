import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseGeneric } from '../services/GenericParser';

// jsdom returns empty strings for computed SVG fill/stroke.
// GenericParser falls back to getAttribute, so we use setAttribute in tests.

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;
const mockBBox = (w = 100, h = 50): DOMRect =>
  ({ x: 0, y: 0, width: w, height: h, top: 0, left: 0, right: w, bottom: h, toJSON: () => ({}) } as DOMRect);

describe('parseGeneric', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS(NS, 'svg') as SVGSVGElement;
    document.body.appendChild(svgElement);
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      writable: true,
      value: () => mockBBox(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error – intentionally removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
  });

  it('returns empty nodes and edges for an empty SVG', () => {
    expect(parseGeneric(svgElement, false)).toEqual({ nodes: [], edges: [] });
  });

  // ── Path → edge ───────────────────────────────────────────────────────────

  it('adds a path with stroke (no fill) as an edge', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 C 50 0 50 100 100 100');
    path.setAttribute('stroke', '#333');
    // no fill attribute → getComputedFill returns null
    svgElement.appendChild(path);

    const { nodes, edges } = parseGeneric(svgElement, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].pathD).toBe('M 0 0 C 50 0 50 100 100 100');
    expect(edges[0].type).toBe('link');
    expect(edges[0].stroke).toBe('#333');
    expect(nodes).toHaveLength(0);
  });

  it('skips a path whose d attribute is too short (≤ 10 chars)', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0');
    path.setAttribute('stroke', '#333');
    svgElement.appendChild(path);
    expect(parseGeneric(svgElement, false).edges).toHaveLength(0);
  });

  it('skips a path that has both stroke and fill (not a pure edge)', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 C 50 0 50 100 100 100');
    path.setAttribute('stroke', '#333');
    path.setAttribute('fill', '#fff');
    svgElement.appendChild(path);
    // stroke && !fill fails → path is not added as edge
    expect(parseGeneric(svgElement, false).edges).toHaveLength(0);
  });

  it('sets hasArrow=true when path has marker-end attribute', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 100 100');
    path.setAttribute('stroke', '#333');
    path.setAttribute('marker-end', 'url(#arrow)');
    svgElement.appendChild(path);
    const [edge] = parseGeneric(svgElement, false).edges;
    expect(edge.hasArrow).toBe(true);
  });

  it('deduplicates paths with identical d strings', () => {
    const d = 'M 0 0 L 100 100';
    for (let i = 0; i < 3; i++) {
      const path = el<SVGPathElement>('path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#333');
      svgElement.appendChild(path);
    }
    expect(parseGeneric(svgElement, false).edges).toHaveLength(1);
  });

  // ── Line → edge ───────────────────────────────────────────────────────────

  it('converts a <line> with stroke to M/L path edge via lineToPathD', () => {
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '10'); line.setAttribute('y1', '20');
    line.setAttribute('x2', '90'); line.setAttribute('y2', '80');
    line.setAttribute('stroke', '#666');
    svgElement.appendChild(line);

    const [edge] = parseGeneric(svgElement, false).edges;
    expect(edge.pathD).toBe('M 10 20 L 90 80');
    expect(edge.type).toBe('link');
  });

  it('applies cumulative transform when building line pathD', () => {
    const g = el('g'); g.setAttribute('transform', 'translate(100, 50)');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '50'); line.setAttribute('y2', '0');
    line.setAttribute('stroke', '#333');
    g.appendChild(line); svgElement.appendChild(g);

    const [edge] = parseGeneric(svgElement, false).edges;
    expect(edge.pathD).toBe('M 100 50 L 150 50');
  });

  it('uses isPremium fallback stroke when line has no stroke attribute', () => {
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svgElement.appendChild(line);

    const [edge] = parseGeneric(svgElement, true).edges;
    expect(edge.stroke).toBe('#94a3b8');
  });

  // ── Polyline → edge ───────────────────────────────────────────────────────

  it('converts a <polyline> with stroke to a multi-segment path', () => {
    const poly = el('polyline');
    poly.setAttribute('points', '0,0 50,50 100,0');
    poly.setAttribute('stroke', '#999');
    svgElement.appendChild(poly);

    const [edge] = parseGeneric(svgElement, false).edges;
    expect(edge.pathD).toBe('M 0 0 L 50 50 L 100 0');
    expect(edge.type).toBe('link');
  });

  it('skips polyline with fewer than 4 coordinate values', () => {
    const poly = el('polyline');
    poly.setAttribute('points', '0,0');   // only 2 values
    poly.setAttribute('stroke', '#999');
    svgElement.appendChild(poly);
    expect(parseGeneric(svgElement, false).edges).toHaveLength(0);
  });

  // ── Rect / circle / ellipse → node ────────────────────────────────────────

  it('adds a <rect> with fill as a node', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('fill', '#aabbcc');
    svgElement.appendChild(rect);

    const { nodes, edges } = parseGeneric(svgElement, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('roundRect');
    expect(nodes[0].color).toBe('#aabbcc');
    expect(edges).toHaveLength(0);
  });

  it('adds a <circle> with fill as a circle-shaped node', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.setAttribute('fill', '#ff0000');
    svgElement.appendChild(circle);

    const [node] = parseGeneric(svgElement, false).nodes;
    expect(node.shape).toBe('circle');
  });

  it('adds an <ellipse> with fill as a circle-shaped node', () => {
    const ellipse = el<SVGEllipseElement>('ellipse');
    ellipse.setAttribute('fill', '#00ff00');
    svgElement.appendChild(ellipse);

    const [node] = parseGeneric(svgElement, false).nodes;
    expect(node.shape).toBe('circle');
  });

  it('skips rect/circle/ellipse with neither fill nor stroke', () => {
    const rect = el<SVGRectElement>('rect');
    // no fill / stroke attributes → getComputedFill/Stroke return null
    svgElement.appendChild(rect);
    expect(parseGeneric(svgElement, false).nodes).toHaveLength(0);
  });

  it('skips rect whose bbox has zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0);
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('fill', '#abc');
    svgElement.appendChild(rect);
    expect(parseGeneric(svgElement, false).nodes).toHaveLength(0);
  });

  it('extracts label for a node from parent group text child', () => {
    const g = el('g');
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('fill', '#abc');
    const txt = el('text'); txt.textContent = 'MyNode';
    g.appendChild(rect); g.appendChild(txt);
    svgElement.appendChild(g);

    const [node] = parseGeneric(svgElement, false).nodes;
    expect(node.label).toBe('MyNode');
  });

  // ── SKIP_TAGS ─────────────────────────────────────────────────────────────

  it('ignores content inside <defs>', () => {
    const defs = el('defs');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 100 100');
    path.setAttribute('stroke', '#333');
    defs.appendChild(path); svgElement.appendChild(defs);
    expect(parseGeneric(svgElement, false).edges).toHaveLength(0);
  });

  it('ignores content inside <marker>', () => {
    const marker = el('marker');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 Z');
    path.setAttribute('stroke', '#333');
    marker.appendChild(path); svgElement.appendChild(marker);
    expect(parseGeneric(svgElement, false).edges).toHaveLength(0);
  });

  it('ignores <style> elements', () => {
    const style = document.createElementNS(NS, 'style');
    style.textContent = '.edge { stroke: red }';
    svgElement.appendChild(style);
    expect(parseGeneric(svgElement, false)).toEqual({ nodes: [], edges: [] });
  });

  // ── noSnap flag ───────────────────────────────────────────────────────────

  it('marks all edges with noSnap=true', () => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 200 200');
    path.setAttribute('stroke', '#333');
    svgElement.appendChild(path);
    const [edge] = parseGeneric(svgElement, false).edges;
    expect(edge.noSnap).toBe(true);
  });
});
