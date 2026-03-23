import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseFlowchartNodes,
  parseFlowchartEdges,
  parseFlowchartEdgeLabels,
} from '../../services/FlowchartParser';
import { resetIdCounter } from '../../utils/parser-base';

// jsdom does not implement getBBox — mock it globally per test suite.
// Default bbox: 100 × 50, so width > 0 and height > 0 checks pass.
// For stadium detection: rx >= height * 0.45 = 50 * 0.45 = 22.5 → use rx=25.
const mockBBox = (x = 0, y = 0, width = 100, height = 50): DOMRect =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect);

const NS = 'http://www.w3.org/2000/svg';
const makeSvg = () => document.createElementNS(NS, 'svg') as SVGSVGElement;
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

describe('parseFlowchartNodes', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = makeSvg();
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

  it('returns empty array for empty SVG', () => {
    expect(parseFlowchartNodes(svgElement, false)).toEqual([]);
  });

  it('skips g elements without node / cluster / note class', () => {
    const g = el('g');
    g.id = 'random-group';
    g.appendChild(el('rect'));
    svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)).toHaveLength(0);
  });

  it('skips g.node when no shape element is found', () => {
    const g = el('g');
    g.classList.add('node');
    g.id = 'empty-node';
    // no rect / circle / ellipse / polygon / path child
    svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)).toHaveLength(0);
  });

  it('skips g.node when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g');
    g.classList.add('node');
    g.id = 'zero-node';
    g.appendChild(el('rect'));
    svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)).toHaveLength(0);
  });

  // ── Shape detection ───────────────────────────────────────────────────────

  it('detects rect with rx=0 as shape "rect"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n1';
    const r = el<SVGRectElement>('rect'); r.setAttribute('rx', '0');
    g.appendChild(r); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('rect');
  });

  it('detects rect with rx=8 as shape "roundRect"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n2';
    const r = el<SVGRectElement>('rect'); r.setAttribute('rx', '8');
    g.appendChild(r); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('roundRect');
  });

  it('detects rect with rx=25 as shape "stadium" (rx >= height * 0.45)', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n3';
    const r = el<SVGRectElement>('rect'); r.setAttribute('rx', '25');
    g.appendChild(r); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('stadium');
  });

  it('detects circle element as shape "circle"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n4';
    g.appendChild(el('circle')); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('circle');
  });

  it('detects ellipse (no circle) as shape "cylinder"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n5';
    g.appendChild(el('ellipse')); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('cylinder');
  });

  it('detects polygon with 4 points as shape "diamond"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n6';
    const poly = el<SVGPolygonElement>('polygon');
    poly.setAttribute('points', '0,25 50,0 100,25 50,50'); // 4 pairs = 8 nums
    g.appendChild(poly); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('diamond');
  });

  it('detects polygon with 6 points as shape "hexagon"', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'n7';
    const poly = el<SVGPolygonElement>('polygon');
    poly.setAttribute('points', '10,0 40,0 50,25 40,50 10,50 0,25'); // 6 pairs = 12 nums
    g.appendChild(poly); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.shape).toBe('hexagon');
  });

  // ── Node type assignment ──────────────────────────────────────────────────

  it('assigns type "node" for g.node', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'nt1';
    g.appendChild(el('rect')); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].type).toBe('node');
  });

  it('assigns type "cluster" for g.cluster', () => {
    const g = el('g'); g.classList.add('cluster'); g.id = 'cl1';
    g.appendChild(el('rect')); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].type).toBe('cluster');
  });

  it('assigns type "note" and shape "note" for g.note', () => {
    const g = el('g'); g.classList.add('note'); g.id = 'no1';
    g.appendChild(el('rect')); svgElement.appendChild(g);
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.type).toBe('note');
    expect(node.shape).toBe('note');
    expect(node.color).toBe('#fef3c7');
    expect(node.stroke).toBe('#d97706');
  });

  // ── Label extraction ──────────────────────────────────────────────────────

  it('extracts label from child <text> element', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'lbl1';
    g.appendChild(el('rect'));
    const t = el('text'); t.textContent = 'My Node';
    g.appendChild(t); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].label).toBe('My Node');
  });

  it('extracts multi-line label from <text> with <tspan> children', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'lbl2';
    g.appendChild(el('rect'));
    const t = el('text');
    const s1 = el('tspan'); s1.textContent = 'Line1';
    const s2 = el('tspan'); s2.textContent = 'Line2';
    t.appendChild(s1); t.appendChild(s2);
    g.appendChild(t); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].label).toBe('Line1\nLine2');
  });

  it('extracts label from <foreignObject> > <div>', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'lbl3';
    g.appendChild(el('rect'));
    const fo = el('foreignObject') as Element;
    const div = document.createElement('div');
    div.textContent = 'Foreign Label';
    fo.appendChild(div);
    g.appendChild(fo); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].label).toBe('Foreign Label');
  });

  it('converts <br> to newline in foreignObject label', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'lbl4';
    g.appendChild(el('rect'));
    const fo = el('foreignObject') as Element;
    const div = document.createElement('div');
    div.innerHTML = 'Line1<br>Line2';
    fo.appendChild(div); g.appendChild(fo); svgElement.appendChild(g);
    expect(parseFlowchartNodes(svgElement, false)[0].label).toBe('Line1\nLine2');
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('does not duplicate nodes with the same id', () => {
    for (let i = 0; i < 3; i++) {
      const g = el('g'); g.classList.add('node'); g.id = 'dup-id';
      g.appendChild(el('rect')); svgElement.appendChild(g);
    }
    expect(parseFlowchartNodes(svgElement, false)).toHaveLength(1);
  });

  // ── Geometry ──────────────────────────────────────────────────────────────

  it('computes node center from getBBox + cumulative transform', () => {
    const outer = el('g'); outer.setAttribute('transform', 'translate(100, 50)');
    const g = el('g'); g.classList.add('node'); g.id = 'geom1';
    g.appendChild(el('rect'));
    outer.appendChild(g); svgElement.appendChild(outer);
    // mock bbox: x=0,y=0,w=100,h=50  → cx = 100+0+50=150, cy = 50+0+25=75
    const [node] = parseFlowchartNodes(svgElement, false);
    expect(node.x).toBe(150);
    expect(node.y).toBe(75);
    expect(node.width).toBe(100);
    expect(node.height).toBe(50);
  });

  // ── Premium colours ───────────────────────────────────────────────────────

  it('uses premium stroke fallback when isPremium=true', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'prem1';
    g.appendChild(el('rect')); svgElement.appendChild(g);
    // jsdom returns empty computed style → falls to default
    const [node] = parseFlowchartNodes(svgElement, true);
    expect(node.stroke).toBe('#94a3b8');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseFlowchartEdges', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = makeSvg();
    document.body.appendChild(svgElement);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('returns empty array for empty SVG', () => {
    expect(parseFlowchartEdges(svgElement, false)).toEqual([]);
  });

  it('parses .edgePath path as a link edge', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 20 C 50 20 50 80 100 80');
    g.appendChild(path); svgElement.appendChild(g);

    const edges = parseFlowchartEdges(svgElement, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('link');
    expect(edges[0].pathD).toBe('M 10 20 C 50 20 50 80 100 80');
  });

  it('skips path elements whose d attribute is too short', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 1 2');          // length ≤ 10
    g.appendChild(path); svgElement.appendChild(g);
    expect(parseFlowchartEdges(svgElement, false)).toHaveLength(0);
  });

  it('parses .flowchart-link path as a link edge', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('flowchart-link');
    path.setAttribute('d', 'M 0 0 L 200 200');
    svgElement.appendChild(path);
    const [edge] = parseFlowchartEdges(svgElement, false);
    expect(edge.type).toBe('link');
  });

  it('converts line.actor-line to M/L path via lineToPathD', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('actor-line');
    line.setAttribute('x1', '50'); line.setAttribute('y1', '10');
    line.setAttribute('x2', '50'); line.setAttribute('y2', '300');
    svgElement.appendChild(line);

    const edges = parseFlowchartEdges(svgElement, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('structural');
    expect(edges[0].pathD).toBe('M 50 10 L 50 300');
  });

  it('applies cumulative transform when converting line to pathD', () => {
    const g = el('g'); g.setAttribute('transform', 'translate(20, 30)');
    const line = el<SVGLineElement>('line');
    line.classList.add('actor-line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '100');
    g.appendChild(line); svgElement.appendChild(g);

    const [edge] = parseFlowchartEdges(svgElement, false);
    expect(edge.pathD).toBe('M 20 30 L 20 130');
  });

  it('sets hasArrow=true when path has marker-end attribute', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    path.setAttribute('marker-end', 'url(#arrow)');
    g.appendChild(path); svgElement.appendChild(g);

    const [edge] = parseFlowchartEdges(svgElement, false);
    expect(edge.hasArrow).toBe(true);
  });

  it('uses premium stroke fallback when isPremium=true', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svgElement.appendChild(g);
    // jsdom returns empty computed stroke → uses fallback
    const [edge] = parseFlowchartEdges(svgElement, true);
    expect(edge.stroke).toBe('#94a3b8');
  });

  it('uses non-premium stroke fallback when isPremium=false', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svgElement.appendChild(g);
    const [edge] = parseFlowchartEdges(svgElement, false);
    expect(edge.stroke).toBe('#333');
  });

  it('parses dash pattern from strokeDasharray', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'none',
      strokeDasharray: '8, 4',
      markerEnd: 'none',
    } as unknown as CSSStyleDeclaration);
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svgElement.appendChild(g);
    const [edge] = parseFlowchartEdges(svgElement, false);
    expect(edge.dash).toEqual([8, 4]);
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseFlowchartEdgeLabels', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = makeSvg();
    document.body.appendChild(svgElement);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('returns empty array for empty SVG', () => {
    expect(parseFlowchartEdgeLabels(svgElement)).toEqual([]);
  });

  it('skips g.edgeLabel with no text content', () => {
    const g = el('g'); g.classList.add('edgeLabel');
    svgElement.appendChild(g);
    expect(parseFlowchartEdgeLabels(svgElement)).toHaveLength(0);
  });

  it('skips g.edgeLabel when CTM is unavailable (jsdom returns null)', () => {
    // jsdom does not implement getCTM() → returns null → label is skipped
    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject');
    fo.textContent = 'edge label';
    g.appendChild(fo); svgElement.appendChild(g);
    // The function should not throw; it silently skips
    expect(() => parseFlowchartEdgeLabels(svgElement)).not.toThrow();
    expect(parseFlowchartEdgeLabels(svgElement)).toHaveLength(0);
  });
});
