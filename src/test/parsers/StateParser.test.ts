import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseStateNodes, parseStateEdges, parseStateEdgeLabels } from '../../services/StateParser';
import { resetIdCounter } from '../../utils/parser-base';

// jsdom does not implement getBBox — provide a sensible default.
const mockBBox = (x = 0, y = 0, width = 100, height = 50): DOMRect =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect);

const NS = 'http://www.w3.org/2000/svg';
const makeSvg = () => document.createElementNS(NS, 'svg') as SVGSVGElement;
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

// ─── parseStateNodes ──────────────────────────────────────────────────────────

describe('parseStateNodes', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svg = makeSvg();
    document.body.appendChild(svg);
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      writable: true,
      value: () => mockBBox(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error – removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
  });

  it('returns empty array for empty SVG', () => {
    expect(parseStateNodes(svg, false)).toEqual([]);
  });

  // ── Composite cluster ──────────────────────────────────────────────────────

  it('parses a composite cluster (statediagram-cluster)', () => {
    const g = el('g');
    g.setAttribute('class', 'statediagram-state statediagram-cluster');
    g.id = 'ParentState';
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const nodes = parseStateNodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('cluster');
    expect(nodes[0].shape).toBe('roundRect');
    expect(nodes[0].id).toBe('ParentState');
  });

  it('extracts cluster label from g[id="cluster-label"] child', () => {
    const g = el('g');
    g.setAttribute('class', 'statediagram-cluster');
    g.id = 'cs1';
    g.appendChild(el('rect'));

    const labelG = el('g');
    labelG.id = 'cluster-label';
    const txt = el('text'); txt.textContent = 'Composite';
    labelG.appendChild(txt);
    g.appendChild(labelG);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.label).toBe('Composite');
  });

  it('does not duplicate cluster with same id', () => {
    for (let i = 0; i < 3; i++) {
      const g = el('g');
      g.setAttribute('class', 'statediagram-cluster');
      g.id = 'dup-cluster';
      g.appendChild(el('rect'));
      svg.appendChild(g);
    }
    expect(parseStateNodes(svg, false)).toHaveLength(1);
  });

  it('skips cluster when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g');
    g.setAttribute('class', 'statediagram-cluster');
    g.id = 'zero-cluster';
    g.appendChild(el('rect'));
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  // ── Start pseudo-state ─────────────────────────────────────────────────────

  it('parses start state (circle.state-start) as shape "circle"', () => {
    const g = el('g'); g.classList.add('node', 'default'); g.id = 'start1';
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('state-start');
    circle.setAttribute('r', '7');
    g.appendChild(circle);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('circle');
    expect(node.type).toBe('node');
    expect(node.label).toBe('');
    expect(node.width).toBe(14);
    expect(node.height).toBe(14);
  });

  // ── End pseudo-state ───────────────────────────────────────────────────────

  it('parses end state (circle.state-start + circle.state-end) as shape "endCircle"', () => {
    const g = el('g'); g.classList.add('node', 'default'); g.id = 'end1';
    const startC = el<SVGCircleElement>('circle'); startC.classList.add('state-start'); startC.setAttribute('r', '7');
    const endC   = el<SVGCircleElement>('circle'); endC.classList.add('state-end');   endC.setAttribute('r', '5');
    g.appendChild(startC);
    g.appendChild(endC);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('endCircle');
  });

  // ── Choice pseudo-state ────────────────────────────────────────────────────

  it('parses <<choice>> (polygon.state-start) as shape "diamond"', () => {
    const g = el('g'); g.classList.add('node', 'default'); g.id = 'choice1';
    const poly = el<SVGPolygonElement>('polygon');
    poly.classList.add('state-start');
    g.appendChild(poly);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('diamond');
    expect(node.type).toBe('node');
    expect(node.label).toBe('');
  });

  it('skips <<choice>> when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g'); g.classList.add('node'); g.id = 'choice-zero';
    const poly = el<SVGPolygonElement>('polygon'); poly.classList.add('state-start');
    g.appendChild(poly); svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  // ── Fork / Join pseudo-state ───────────────────────────────────────────────

  it('parses <<fork>>/<<join>> (rect.fork-join) as shape "forkJoin"', () => {
    const g = el('g'); g.classList.add('node', 'default'); g.id = 'fork1';
    const rect = el<SVGRectElement>('rect'); rect.classList.add('fork-join');
    g.appendChild(rect);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('forkJoin');
    expect(node.type).toBe('node');
  });

  it('skips fork/join when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g'); g.classList.add('node'); g.id = 'fork-zero';
    const rect = el<SVGRectElement>('rect'); rect.classList.add('fork-join');
    g.appendChild(rect); svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  // ── Regular state box ──────────────────────────────────────────────────────

  it('parses regular statediagram-state node as shape "roundRect"', () => {
    const g = el('g');
    g.setAttribute('class', 'node default statediagram-state');
    g.id = 'StateA';
    const txt = el('text'); txt.textContent = 'StateA';
    g.appendChild(el('rect'));
    g.appendChild(txt);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('roundRect');
    expect(node.type).toBe('node');
    expect(node.label).toBe('StateA');
    expect(node.id).toBe('StateA');
  });

  it('skips g.node without statediagram class (regular flowchart node)', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'flowchart-node';
    g.appendChild(el('rect'));
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  it('skips statediagram g.node with no rect child', () => {
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'no-rect';
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  it('skips statediagram g.node when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'zero-state';
    g.appendChild(el('rect'));
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  it('extracts label from foreignObject in state node', () => {
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'fo-state';
    g.appendChild(el('rect'));
    const fo = el('foreignObject'); fo.textContent = 'Via FO';
    g.appendChild(fo);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.label).toBe('Via FO');
  });

  it('extracts multi-line label from tspan elements', () => {
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'tspan-state';
    g.appendChild(el('rect'));
    const txt = el('text');
    const s1 = el('tspan'); s1.textContent = 'Line1';
    const s2 = el('tspan'); s2.textContent = 'Line2';
    txt.appendChild(s1); txt.appendChild(s2);
    g.appendChild(txt);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.label).toBe('Line1\nLine2');
  });

  it('uses non-premium color fallback when isPremium=false', () => {
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'prem-false';
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    // jsdom returns empty computed style → fallback is used
    expect(node.color).toBe('#dbeafe');
    expect(node.stroke).toBe('#2563eb');
  });

  it('uses premium color fallback when isPremium=true', () => {
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'prem-true';
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, true);
    expect(node.color).toBe('#eff6ff');
    expect(node.stroke).toBe('#3b82f6');
  });

  it('computes geometry from getBBox + cumulative translate transform', () => {
    const outer = el('g'); outer.setAttribute('transform', 'translate(40, 20)');
    const g = el('g');
    g.setAttribute('class', 'node statediagram-state');
    g.id = 'geom-state';
    g.appendChild(el('rect'));
    outer.appendChild(g);
    svg.appendChild(outer);

    // mockBBox: x=0, y=0, w=100, h=50
    // expected cx = 40 + 0 + 50 = 90, cy = 20 + 0 + 25 = 45
    const [node] = parseStateNodes(svg, false);
    expect(node.x).toBe(90);
    expect(node.y).toBe(45);
    expect(node.width).toBe(100);
    expect(node.height).toBe(50);
  });

  // ── Notes ──────────────────────────────────────────────────────────────────

  it('parses statediagram-note as type "note" with shape "note"', () => {
    const g = el('g'); g.classList.add('statediagram-note'); g.id = 'note1';
    const rect = el<SVGRectElement>('rect'); rect.classList.add('outer');
    const txt = el('text'); txt.textContent = 'A note';
    g.appendChild(rect); g.appendChild(txt);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.type).toBe('note');
    expect(node.shape).toBe('note');
    expect(node.label).toBe('A note');
    expect(node.color).toBe('#fef3c7');
    expect(node.stroke).toBe('#d97706');
  });

  it('skips note when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    const g = el('g'); g.classList.add('statediagram-note'); g.id = 'note-zero';
    g.appendChild(el('rect'));
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  it('skips note when no rect child exists', () => {
    const g = el('g'); g.classList.add('statediagram-note'); g.id = 'note-no-rect';
    svg.appendChild(g);
    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });

  // ── v11: end state detected by id ─────────────────────────────────────────

  it('v11: parses end state by "_end-" in id as shape "endCircle"', () => {
    const g = el('g'); g.classList.add('node', 'statediagram-state');
    g.id = 'flowchart_end-0';
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('endCircle');
    expect(node.type).toBe('node');
    expect(node.label).toBe('');
    expect(node.width).toBe(14);
    expect(node.height).toBe(14);
  });

  it('v11: end state centre comes from translate transform', () => {
    const g = el('g'); g.classList.add('node', 'statediagram-state');
    g.id = 'state_end-1';
    g.setAttribute('transform', 'translate(50, 75)');
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.x).toBe(50);
    expect(node.y).toBe(75);
  });

  // ── v11: cluster label via g.cluster-label ─────────────────────────────────

  it('v11: extracts cluster label from g.cluster-label child', () => {
    const g = el('g');
    g.setAttribute('class', 'statediagram-state statediagram-cluster');
    g.id = 'cs-v11';
    g.appendChild(el('rect'));

    const labelG = el('g'); labelG.classList.add('cluster-label');
    const txt = el('text'); txt.textContent = 'V11Cluster';
    labelG.appendChild(txt); g.appendChild(labelG);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.label).toBe('V11Cluster');
  });

  // ── v11: choice / fork / join via anonymous-g path ─────────────────────────

  it('v11: parses <<choice>> from diamond path (M0 {halfH}) as shape "diamond"', () => {
    const g = el('g'); g.classList.add('node', 'statediagram-state'); g.id = 'choice-v11';
    const anonG = el('g');
    const path = el<SVGPathElement>('path');
    // Diamond: M0 {halfH} → halfSize=20, width=height=30
    path.setAttribute('d', 'M0 20 L 30 0 L 0 -20 L -30 0 Z');
    anonG.appendChild(path); g.appendChild(anonG);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('diamond');
    expect(node.type).toBe('node');
    expect(node.label).toBe('');
  });

  it('v11: parses <<fork>>/<<join>> from rect path (M {-halfW} {-halfH}) as shape "forkJoin"', () => {
    const g = el('g'); g.classList.add('node', 'statediagram-state'); g.id = 'fork-v11';
    const anonG = el('g');
    const path = el<SVGPathElement>('path');
    // Fork bar: M -40 -5 → width=80, height=10
    path.setAttribute('d', 'M -40 -5 L 40 -5 L 40 5 L -40 5 Z');
    anonG.appendChild(path); g.appendChild(anonG);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.shape).toBe('forkJoin');
    expect(node.width).toBe(80);
    expect(node.height).toBe(10);
  });

  it('v11: does not parse as choice/fork when g has a rect child (v10 path)', () => {
    const g = el('g'); g.classList.add('node', 'statediagram-state'); g.id = 'v10-choice';
    g.appendChild(el('rect'));  // presence of rect prevents v11 branch
    const anonG = el('g');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M0 20 L 30 0 L 0 -20 Z');
    anonG.appendChild(path); g.appendChild(anonG);
    svg.appendChild(g);

    // Falls through to regular state-box handler; no rect.fork-join → skips v11 block
    // but does enter 2d and tries getBBox on rect → produces a roundRect node
    const nodes = parseStateNodes(svg, false);
    expect(nodes.every(n => n.shape !== 'diamond')).toBe(true);
  });

  // ── v11: note via g.basic path geometry ────────────────────────────────────

  it('v11: parses statediagram-note with g.basic path as type "note"', () => {
    const g = el('g'); g.classList.add('statediagram-note'); g.id = 'note-v11';
    g.setAttribute('transform', 'translate(100, 80)');

    const basicG = el('g'); basicG.classList.add('basic');
    const path = el<SVGPathElement>('path');
    // M -60 -30 → width=120, height=60
    path.setAttribute('d', 'M -60 -30 L 60 -30 L 60 30 L -60 30 Z');
    basicG.appendChild(path); g.appendChild(basicG);

    const txt = el('text'); txt.textContent = 'v11 note';
    g.appendChild(txt);
    svg.appendChild(g);

    const [node] = parseStateNodes(svg, false);
    expect(node.type).toBe('note');
    expect(node.shape).toBe('note');
    expect(node.label).toBe('v11 note');
    expect(node.width).toBe(120);
    expect(node.height).toBe(60);
    expect(node.x).toBe(100);
    expect(node.y).toBe(80);
    expect(node.color).toBe('#fef3c7');
    expect(node.stroke).toBe('#d97706');
  });

  it('v11: skips note with g.basic but no path child', () => {
    const g = el('g'); g.classList.add('statediagram-note'); g.id = 'note-v11-nopath';
    const basicG = el('g'); basicG.classList.add('basic');
    g.appendChild(basicG);
    svg.appendChild(g);

    expect(parseStateNodes(svg, false)).toHaveLength(0);
  });
});

// ─── parseStateEdges ──────────────────────────────────────────────────────────

describe('parseStateEdges', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svg = makeSvg();
    document.body.appendChild(svg);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('returns empty array for empty SVG', () => {
    expect(parseStateEdges(svg, false)).toEqual([]);
  });

  it('parses path inside .transition as a link edge', () => {
    const g = el('g'); g.classList.add('transition', 'edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 20 C 50 20 50 80 100 80');
    g.appendChild(path); svg.appendChild(g);

    const edges = parseStateEdges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('link');
  });

  it('parses path inside .edgePath as a link edge', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 L 200 200 L 300 300');
    g.appendChild(path); svg.appendChild(g);

    const edges = parseStateEdges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('link');
  });

  it('skips path whose d attribute is too short (≤10 chars)', () => {
    const g = el('g'); g.classList.add('transition');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 1 2');
    g.appendChild(path); svg.appendChild(g);
    expect(parseStateEdges(svg, false)).toHaveLength(0);
  });

  it('does not set noSnap on edges outside a statediagram-cluster', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svg.appendChild(g);

    const [edge] = parseStateEdges(svg, false);
    expect(edge.noSnap).toBeUndefined();
    expect(edge.parentClusterId).toBeUndefined();
  });

  it('sets hasArrow=true when path has marker-end attribute', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    path.setAttribute('marker-end', 'url(#arrow)');
    g.appendChild(path); svg.appendChild(g);

    const [edge] = parseStateEdges(svg, false);
    expect(edge.hasArrow).toBe(true);
  });

  it('sets hasArrow=false when path has no marker-end attribute', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svg.appendChild(g);

    const [edge] = parseStateEdges(svg, false);
    expect(edge.hasArrow).toBe(false);
  });

  it('deduplicates identical paths (same transformed pathD)', () => {
    // Two paths with same d and no parent transform → same pathD after translation
    for (let i = 0; i < 3; i++) {
      const g = el('g'); g.classList.add('edgePath');
      const path = el<SVGPathElement>('path');
      path.setAttribute('d', 'M 0 0 L 100 100 L 200 200');
      g.appendChild(path); svg.appendChild(g);
    }
    expect(parseStateEdges(svg, false)).toHaveLength(1);
  });

  it('uses non-premium stroke fallback when isPremium=false', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svg.appendChild(g);

    const [edge] = parseStateEdges(svg, false);
    expect(edge.stroke).toBe('#333');
  });

  it('uses premium stroke fallback when isPremium=true', () => {
    const g = el('g'); g.classList.add('edgePath');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 10 L 100 100');
    g.appendChild(path); svg.appendChild(g);

    const [edge] = parseStateEdges(svg, true);
    expect(edge.stroke).toBe('#94a3b8');
  });
});

// ─── parseStateEdgeLabels ─────────────────────────────────────────────────────

describe('parseStateEdgeLabels', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = makeSvg();
    document.body.appendChild(svg);
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      writable: true,
      value: () => mockBBox(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error – removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
  });

  it('returns empty array for empty SVG', () => {
    expect(parseStateEdgeLabels(svg)).toEqual([]);
  });

  it('skips g.edgeLabel with no text content', () => {
    const g = el('g'); g.classList.add('edgeLabel');
    svg.appendChild(g);
    expect(parseStateEdgeLabels(svg)).toHaveLength(0);
  });

  it('skips g.edgeLabel when getCTM returns null (jsdom default)', () => {
    // jsdom does not implement getCTM() → returns null → label must be silently skipped
    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject'); fo.textContent = 'trigger event';
    g.appendChild(fo); svg.appendChild(g);

    expect(() => parseStateEdgeLabels(svg)).not.toThrow();
    expect(parseStateEdgeLabels(svg)).toHaveLength(0);
  });

  it('returns label with correct defaults when CTM is available', () => {
    // Identity matrix whose inverse().multiply() chain returns a plain matrix object
    const identityResult = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const identityMatrix = {
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
      inverse: () => ({ ...identityResult, multiply: (_: unknown) => identityResult }),
    } as unknown as DOMMatrix;

    Object.defineProperty(SVGElement.prototype, 'getCTM', {
      configurable: true,
      writable: true,
      value: () => identityMatrix,
    });

    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject'); fo.textContent = 'on event';
    g.appendChild(fo); svg.appendChild(g);

    const labels = parseStateEdgeLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('on event');
    expect(labels[0].fontSize).toBe(12);
    expect(labels[0].bold).toBe(false);
    expect(labels[0].color).toBe('#374151');
    expect(labels[0].align).toBe('center');
    expect(labels[0].bgColor).toBe('#ffffff');

    // @ts-expect-error – removing jsdom-undefined property
    delete SVGElement.prototype.getCTM;
  });
});
