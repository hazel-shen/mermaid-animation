import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseMindmapNodes, parseMindmapEdges } from '../../services/MindmapParser';
import { resetIdCounter } from '../../utils/parser-base';

// jsdom does not implement getBBox — mock it globally per test suite.
// Default bbox is symmetric around origin: x=-50,y=-25,w=100,h=50.
// This means: cx = tx + (-50) + 50 = tx, cy = ty + (-25) + 25 = ty,
// so node.x equals the g's translate x, and node.y equals the g's translate y.
const mockBBox = (x = -50, y = -25, width = 100, height = 50): DOMRect =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect);

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

// Palettes copied from MindmapParser — used to assert colour values.
const SECTION_PALETTE: [string, string][] = [
  ['#c4b5fd', '#7c3aed'], // 0
  ['#a5f3fc', '#0e7490'], // 1
  ['#bbf7d0', '#15803d'], // 2
  ['#fde68a', '#b45309'], // 3
  ['#fca5a5', '#b91c1c'], // 4
  ['#bfdbfe', '#1d4ed8'], // 5
  ['#d9f99d', '#4d7c0f'], // 6
  ['#f5d0fe', '#9333ea'], // 7
];
const ROOT_FILL   = '#1e3a8a';
const ROOT_STROKE = '#1e40af';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Creates a g.mindmap-node with the given extra classes. */
const mindmapG = (classes: string[], id = '', transform?: string): SVGGElement => {
  const g = el<SVGGElement>('g');
  g.setAttribute('class', ['mindmap-node', ...classes].join(' '));
  if (id) g.id = id;
  if (transform) g.setAttribute('transform', transform);
  return g;
};

/** Appends a span.nodeLabel inside g (Mermaid 11 htmlLabels structure). */
const addNodeLabel = (g: SVGGElement, text: string): void => {
  const fo = el('foreignObject');
  const span = document.createElement('span');
  span.className = 'nodeLabel';
  span.textContent = text;
  fo.appendChild(span);
  g.appendChild(fo);
};

/** Appends a <text> child directly on g (SVG text fallback). */
const addTextLabel = (g: SVGGElement, text: string): void => {
  const txt = el<SVGTextElement>('text');
  txt.textContent = text;
  g.appendChild(txt);
};

// ─── parseMindmapNodes ────────────────────────────────────────────────────────

describe('parseMindmapNodes', () => {
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
    // @ts-expect-error – intentionally removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
  });

  // ── guard ──────────────────────────────────────────────────────────────────

  it('returns empty array for empty SVG', () => {
    expect(parseMindmapNodes(svg, false)).toEqual([]);
  });

  it('skips g.mindmap-node when getBBox throws (hidden/unrendered element)', () => {
    // Override to throw so both rectCenter and the fallback catch-block skip the node
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => {
      throw new Error('not rendered');
    };
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    expect(parseMindmapNodes(svg, false)).toHaveLength(0);
  });

  // ── root node detection ────────────────────────────────────────────────────

  it('detects root via section-root class and sets shape=circle when circle child present', () => {
    const g = mindmapG(['section-root']);
    g.appendChild(el('circle'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('circle');
  });

  it('detects root via section--1 class as well', () => {
    const g = mindmapG(['section--1']);
    g.appendChild(el('circle'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('circle');
  });

  it('uses ROOT_PALETTE for root node color regardless of section index', () => {
    const g = mindmapG(['section-root']);
    g.appendChild(el('circle'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.color).toBe(ROOT_FILL);
    expect(node.stroke).toBe(ROOT_STROKE);
  });

  // ── section palette ────────────────────────────────────────────────────────

  it('uses SECTION_PALETTE[0] for section-0 branch node', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.color).toBe(SECTION_PALETTE[0][0]);
    expect(node.stroke).toBe(SECTION_PALETTE[0][1]);
  });

  it('uses SECTION_PALETTE[3] for section-3 branch node', () => {
    const g = mindmapG(['section-3', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.color).toBe(SECTION_PALETTE[3][0]);
    expect(node.stroke).toBe(SECTION_PALETTE[3][1]);
  });

  it('wraps SECTION_PALETTE at index 8 back to index 0', () => {
    const g = mindmapG(['section-8', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.color).toBe(SECTION_PALETTE[0][0]); // 8 % 8 === 0
  });

  it('defaults to SECTION_PALETTE[0] when no section-N class is present', () => {
    const g = mindmapG(['node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.color).toBe(SECTION_PALETTE[0][0]);
  });

  it('ignores isPremium — always uses SECTION_PALETTE colors', () => {
    const g = mindmapG(['section-1', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, true);
    expect(node.color).toBe(SECTION_PALETTE[1][0]);
    expect(node.stroke).toBe(SECTION_PALETTE[1][1]);
  });

  // ── shape detection via node-<shape> class ─────────────────────────────────

  it('node-cloud class → shape=cloud', () => {
    const g = mindmapG(['section-0', 'node-cloud']);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('cloud');
  });

  it('node-bang class → shape=bang', () => {
    const g = mindmapG(['section-0', 'node-bang']);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('bang');
  });

  it('node-hexagon class → shape=hexagon', () => {
    const g = mindmapG(['section-0', 'node-hexagon']);
    g.appendChild(el('polygon'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('hexagon');
  });

  it('node-rect class → shape=rect', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('rect');
  });

  it('node-circle class → shape=circle', () => {
    const g = mindmapG(['section-0', 'node-circle']);
    g.appendChild(el('circle'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('circle');
  });

  // ── shape detection via SVG element fallback (no node-<shape> class) ────────

  it('circle.label-container → shape=circle', () => {
    const g = mindmapG(['section-0']);
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('label-container');
    g.appendChild(circle);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('circle');
  });

  it('rect.label-container → shape=rect', () => {
    const g = mindmapG(['section-0']);
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('label-container');
    g.appendChild(rect);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('rect');
  });

  it('polygon.label-container → shape=hexagon', () => {
    const g = mindmapG(['section-0']);
    const poly = el<SVGPolygonElement>('polygon');
    poly.classList.add('label-container');
    g.appendChild(poly);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('hexagon');
  });

  it('path.node-bkg without arcs → shape=roundRect', () => {
    const g = mindmapG(['section-0']);
    const path = el<SVGPathElement>('path');
    path.classList.add('node-bkg');
    // Relative commands only, no arc → classifyMindmapPath returns 'roundRect'
    path.setAttribute('d', 'M0 0 v-24 q0,-5 5,-5 h62 q5,0 5,5');
    g.appendChild(path);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.shape).toBe('roundRect');
  });

  // ── label extraction ───────────────────────────────────────────────────────

  it('extracts label from span.nodeLabel (Mermaid 11 htmlLabels)', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    addNodeLabel(g, 'Hello World');
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.label).toBe('Hello World');
  });

  it('extracts label from foreignObject text when no .nodeLabel span', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    const fo = el('foreignObject');
    fo.textContent = 'FO label';
    g.appendChild(fo);
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.label).toBe('FO label');
  });

  it('extracts label from <text> element as final fallback', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    addTextLabel(g, 'SVG text');
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.label).toBe('SVG text');
  });

  it('trims whitespace from label', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    addTextLabel(g, '  trimmed  ');
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.label).toBe('trimmed');
  });

  // ── id ─────────────────────────────────────────────────────────────────────

  it('uses g.id as node id when set', () => {
    const g = mindmapG(['section-0', 'node-rect'], 'node_42');
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.id).toBe('node_42');
  });

  it('generates id via nextId("mindmap") when g has no id', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.id).toBe('mindmap-1');
  });

  // ── position from transform ────────────────────────────────────────────────

  it('derives x/y from g transform="translate(x, y)" for non-cloud shapes', () => {
    // mockBBox is symmetric (-50,-25,100,50):
    //   cx = tx + bbox.x + bbox.width/2 = tx + (-50) + 50 = tx
    //   cy = ty + bbox.y + bbox.height/2 = ty + (-25) + 25 = ty
    const g = mindmapG(['section-0', 'node-rect'], '', 'translate(150, 200)');
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.x).toBe(150);
    expect(node.y).toBe(200);
  });

  it('derives x/y from g transform for cloud shapes (uses getCumulativeTransform directly)', () => {
    const g = mindmapG(['section-0', 'node-cloud'], '', 'translate(80, 120)');
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.x).toBe(80);
    expect(node.y).toBe(120);
  });

  it('accumulates nested transform for position', () => {
    const outer = el('g');
    outer.setAttribute('transform', 'translate(100, 50)');
    const g = mindmapG(['section-0', 'node-rect'], '', 'translate(30, 20)');
    g.appendChild(el('rect'));
    outer.appendChild(g);
    svg.appendChild(outer);

    // getCumulativeTransform walks up: g(30,20) + outer(100,50) = (130, 70)
    // rectCenter(rect, svg): getCumulativeTransform(rect, svg) also = (130, 70) (rect is inside g)
    // cx = 130 + (-50) + 50 = 130
    const [node] = parseMindmapNodes(svg, false);
    expect(node.x).toBe(130);
    expect(node.y).toBe(70);
  });

  // ── node type ──────────────────────────────────────────────────────────────

  it('sets type="node" on all mindmap nodes', () => {
    const g = mindmapG(['section-0', 'node-rect']);
    g.appendChild(el('rect'));
    svg.appendChild(g);

    const [node] = parseMindmapNodes(svg, false);
    expect(node.type).toBe('node');
  });

  // ── multiple nodes ─────────────────────────────────────────────────────────

  it('parses multiple nodes in DOM order', () => {
    const root = mindmapG(['section-root'], 'root');
    root.appendChild(el('circle'));

    const branch = mindmapG(['section-2', 'node-rect'], 'branch');
    branch.appendChild(el('rect'));

    svg.appendChild(root);
    svg.appendChild(branch);

    const nodes = parseMindmapNodes(svg, false);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('root');
    expect(nodes[1].id).toBe('branch');
  });
});

// ─── parseMindmapEdges ────────────────────────────────────────────────────────

describe('parseMindmapEdges', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
    // Edges only use getCumulativeTransform (reads attributes) and applyTranslateToPathD
    // — no getBBox calls — so no getBBox mock is needed here.
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  const makeEdgePaths = (): SVGGElement => {
    const g = el<SVGGElement>('g');
    g.classList.add('edgePaths');
    svg.appendChild(g);
    return g;
  };

  const addPath = (
    container: SVGGElement,
    d: string,
    classes: string[] = [],
    id = '',
  ): SVGPathElement => {
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', d);
    if (classes.length) path.setAttribute('class', classes.join(' '));
    if (id) path.id = id;
    container.appendChild(path);
    return path;
  };

  // ── guard ──────────────────────────────────────────────────────────────────

  it('returns empty array for empty SVG', () => {
    expect(parseMindmapEdges(svg, false)).toEqual([]);
  });

  // ── Mermaid 11 g.edgePaths paths ──────────────────────────────────────────

  it('finds edge paths inside g.edgePaths', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100');

    expect(parseMindmapEdges(svg, false)).toHaveLength(1);
  });

  it('skips path with d string of length ≤ 5', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0'); // length 5, not > 5
    addPath(container, 'M 10'); // length 4

    expect(parseMindmapEdges(svg, false)).toHaveLength(0);
  });

  it('uses section-edge-N class for stroke colour', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100', ['section-edge-3']);

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.stroke).toBe(SECTION_PALETTE[3][1]);
  });

  it('wraps section-edge palette at index 8 back to 0', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100', ['section-edge-8']);

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.stroke).toBe(SECTION_PALETTE[0][1]); // 8 % 8 === 0
  });

  it('defaults to SECTION_PALETTE[0][1] stroke when no section-edge class', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100');

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.stroke).toBe(SECTION_PALETTE[0][1]);
  });

  it('sets type=link, hasArrow=false, noSnap=true on edgePaths edges', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100');

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.type).toBe('link');
    expect(edge.hasArrow).toBe(false);
    expect(edge.noSnap).toBe(true);
  });

  it('applies ancestor translate transform to pathD coordinates', () => {
    const wrapper = el<SVGGElement>('g');
    wrapper.setAttribute('transform', 'translate(10, 20)');
    const container = el<SVGGElement>('g');
    container.classList.add('edgePaths');
    wrapper.appendChild(container);
    svg.appendChild(wrapper);

    addPath(container, 'M 0 0 L 100 50');

    const [edge] = parseMindmapEdges(svg, false);
    // applyTranslateToPathD shifts M and L by (10, 20)
    expect(edge.pathD).toContain('10,20');   // M 0+10, 0+20
    expect(edge.pathD).toContain('110,70');  // L 100+10, 50+20
  });

  it('uses path.id as edge id when set', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100', [], 'edge-abc');

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.id).toBe('edge-abc');
  });

  it('generates id via nextId("mindmap-edge") when path has no id', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100');

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.id).toBe('mindmap-edge-1');
  });

  // ── legacy fallback ────────────────────────────────────────────────────────

  it('does NOT use legacy fallback when g.edgePaths has at least one valid path', () => {
    const container = makeEdgePaths();
    addPath(container, 'M 0 0 L 100 100');

    // Also add a legacy path.edge in the SVG root — should be ignored
    const legacyPath = el<SVGPathElement>('path');
    legacyPath.classList.add('edge');
    legacyPath.setAttribute('d', 'M 0 0 L 200 200');
    svg.appendChild(legacyPath);

    expect(parseMindmapEdges(svg, false)).toHaveLength(1);
  });

  it('legacy fallback: finds path.edge when no g.edgePaths container', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('edge');
    path.setAttribute('d', 'M 0 0 L 100 100');
    svg.appendChild(path);

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.type).toBe('link');
    expect(edge.noSnap).toBe(true);
  });

  it('legacy fallback: skips path.edge with d length ≤ 5', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('edge');
    path.setAttribute('d', 'M 0 0');
    svg.appendChild(path);

    expect(parseMindmapEdges(svg, false)).toHaveLength(0);
  });

  it('legacy fallback: finds <line> elements and converts to M…L pathD', () => {
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '10'); line.setAttribute('y1', '20');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '80');
    svg.appendChild(line);

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.pathD).toBe('M 10 20 L 100 80');
  });

  it('legacy fallback: skips line shorter than 10px', () => {
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '5'); line.setAttribute('y2', '0'); // length = 5 < 10
    svg.appendChild(line);

    expect(parseMindmapEdges(svg, false)).toHaveLength(0);
  });

  it('legacy fallback: line applies ancestor transform to coordinates', () => {
    const wrapper = el<SVGGElement>('g');
    wrapper.setAttribute('transform', 'translate(50, 30)');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    wrapper.appendChild(line);
    svg.appendChild(wrapper);

    const [edge] = parseMindmapEdges(svg, false);
    expect(edge.pathD).toBe('M 50 30 L 150 30');
  });
});
