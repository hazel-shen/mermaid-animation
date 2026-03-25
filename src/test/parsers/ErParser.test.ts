import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseErNodes, parseErEdges, parseErEdgeLabels } from '../../services/ErParser';
import { resetIdCounter } from '../../utils/parser-base';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;
const mockBBox = (x = 0, y = 0, w = 120, h = 60): DOMRect =>
  ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect);

describe('parseErNodes', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = el<SVGSVGElement>('svg');
    document.body.appendChild(svgElement);
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true, writable: true,
      value: () => mockBBox(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error intentionally removing jsdom-undefined property
    delete SVGElement.prototype.getBBox;
    vi.restoreAllMocks();
  });

  it('returns empty array for an empty SVG', () => {
    expect(parseErNodes(svgElement, false)).toEqual([]);
  });

  it('finds entity box via g.er.entityBox selector', () => {
    const g = el('g'); g.classList.add('er', 'entityBox'); g.id = 'entity-User';
    const rect = el('rect');
    g.appendChild(rect);
    svgElement.appendChild(g);

    const nodes = parseErNodes(svgElement, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('entity-User');
    expect(nodes[0].shape).toBe('rect');
    expect(nodes[0].type).toBe('node');
  });

  it('finds entity box via g[class*="entity"] selector', () => {
    const g = el('g'); g.classList.add('entityGroup');
    const rect = el('rect');
    g.appendChild(rect);
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)).toHaveLength(1);
  });

  it('computes cx/cy from BBox centre', () => {
    // BBox: x=10, y=20, w=80, h=40 → cx=50, cy=40
    const g = el('g'); g.classList.add('er', 'entityBox');
    const rect = el('rect');
    (rect as unknown as SVGGraphicsElement).getBBox = () => mockBBox(10, 20, 80, 40);
    g.appendChild(rect);
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, false);
    expect(node.x).toBe(50);
    expect(node.y).toBe(40);
    expect(node.width).toBe(80);
    expect(node.height).toBe(40);
  });

  it('extracts label from first <text> inside the group', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    const rect = el('rect');
    const txt = el('text'); txt.textContent = '  Order  ';
    g.appendChild(rect); g.appendChild(txt);
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)[0].label).toBe('Order');
  });

  it('uses empty label when no <text> child exists', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)[0].label).toBe('');
  });

  it('uses g.id as node id when available', () => {
    const g = el('g'); g.classList.add('er', 'entityBox'); g.id = 'entity-Product';
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)[0].id).toBe('entity-Product');
  });

  it('falls back to sequential id when g has no id', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)[0].id).toBe('er-entity-1');
  });

  it('deduplicates nodes with the same id', () => {
    for (let i = 0; i < 2; i++) {
      const g = el('g'); g.classList.add('er', 'entityBox'); g.id = 'entity-Same';
      g.appendChild(el('rect'));
      svgElement.appendChild(g);
    }
    expect(parseErNodes(svgElement, false)).toHaveLength(1);
  });

  it('skips group without a rect child', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('text'));
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)).toHaveLength(0);
  });

  it('skips rect with zero-dimension BBox', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    const rect = el('rect');
    (rect as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);
    g.appendChild(rect);
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)).toHaveLength(0);
  });

  it('uses non-premium default colors when isPremium=false', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, false);
    expect(node.color).toBe('#dcfce7');
    expect(node.stroke).toBe('#0c26e9');
  });

  it('uses premium default colors when isPremium=true', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, true);
    expect(node.color).toBe('#f0fdf4');
    expect(node.stroke).toBe('#0c26e9');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseErNodes — v11 (g.node[id^="entity-"] with path geometry)', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = el<SVGSVGElement>('svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /** Build a v11 entity node with path-based outline. */
  const makeV11Node = (id: string, halfW = 60, halfH = 30, tx = 200, ty = 150) => {
    const g = el('g');
    g.classList.add('node');
    g.id = id;
    g.setAttribute('transform', `translate(${tx}, ${ty})`);

    const anonG = el('g');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', `M ${-halfW} ${-halfH} L ${halfW} ${-halfH} L ${halfW} ${halfH} L ${-halfW} ${halfH} Z`);
    anonG.appendChild(path);
    g.appendChild(anonG);
    return g;
  };

  it('parses width and height from path d attribute', () => {
    svgElement.appendChild(makeV11Node('entity-Order', 60, 30));

    const [node] = parseErNodes(svgElement, false);
    expect(node.width).toBe(120);
    expect(node.height).toBe(60);
  });

  it('computes centre from translate transform', () => {
    svgElement.appendChild(makeV11Node('entity-Order', 60, 30, 200, 150));

    const [node] = parseErNodes(svgElement, false);
    expect(node.x).toBe(200);
    expect(node.y).toBe(150);
  });

  it('extracts label from g.label.name foreignObject', () => {
    const g = makeV11Node('entity-User');
    const labelG = el('g');
    labelG.classList.add('label', 'name');
    const fo = el('foreignObject'); fo.textContent = '  User  ';
    labelG.appendChild(fo);
    g.appendChild(labelG);
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)[0].label).toBe('User');
  });

  it('falls back to id-derived label when no label foreignObject', () => {
    svgElement.appendChild(makeV11Node('entity-Product-0'));

    expect(parseErNodes(svgElement, false)[0].label).toBe('Product');
  });

  it('builds classLines with erAttr rows from attribute groups', () => {
    const g = makeV11Node('entity-Item');

    const addAttrGroup = (cls: string, text: string) => {
      const ag = el('g'); ag.classList.add(cls);
      const fo = el('foreignObject'); fo.textContent = text;
      ag.appendChild(fo); g.appendChild(ag);
    };
    addAttrGroup('attribute-type', 'int');
    addAttrGroup('attribute-name', 'id');
    addAttrGroup('attribute-keys', 'PK');
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, false);
    expect(node.classLines).toBeDefined();
    const erRow = node.classLines!.find(cl => cl.erAttr);
    expect(erRow?.erAttr).toEqual({ type: 'int', name: 'id', key: 'PK' });
  });

  it('deduplicates v11 nodes with the same id', () => {
    for (let i = 0; i < 2; i++) svgElement.appendChild(makeV11Node('entity-Dup'));
    expect(parseErNodes(svgElement, false)).toHaveLength(1);
  });

  it('skips v11 node with zero-dimension path', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'entity-Bad';
    const anonG = el('g');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 0 0 Z');  // matches but gives width=0
    anonG.appendChild(path); g.appendChild(anonG);
    svgElement.appendChild(g);

    expect(parseErNodes(svgElement, false)).toHaveLength(0);
  });

  it('parses rect-based v11 entity (no attributes)', () => {
    const g = el('g'); g.classList.add('node'); g.id = 'entity-Simple';
    g.setAttribute('transform', 'translate(100, 80)');
    const rect = el('rect');
    rect.setAttribute('x', '-50'); rect.setAttribute('y', '-20');
    rect.setAttribute('width', '100'); rect.setAttribute('height', '40');
    g.appendChild(rect);
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, false);
    expect(node.width).toBe(100);
    expect(node.height).toBe(40);
    expect(node.x).toBe(100);
    expect(node.y).toBe(80);
  });

  it('v10 fallback does not run when v11 nodes are found', () => {
    // v11 node
    svgElement.appendChild(makeV11Node('entity-A'));
    // v10 node that would also match
    const g = el('g'); g.classList.add('er', 'entityBox'); g.id = 'entity-B';
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    // Only the v11 node should be returned (v10 fallback is skipped)
    const nodes = parseErNodes(svgElement, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('entity-A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseErEdges', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = el<SVGSVGElement>('svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for an empty SVG', () => {
    expect(parseErEdges(svgElement, false)).toEqual([]);
  });

  it('finds relationship path via .er.relationshipLine selector', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)).toHaveLength(1);
  });

  it('finds relationship path via path[class*="relationship"] selector', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('relationship-line');
    path.setAttribute('d', 'M 0 0 L 100 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)).toHaveLength(1);
  });

  it('finds relationship path via path.er selector', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er');
    path.setAttribute('d', 'M 0 0 L 100 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)).toHaveLength(1);
  });

  it('skips path with d attribute length ≤ 10', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)).toHaveLength(0);
  });

  it('sets hasArrow=true when marker-end attribute is present', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    path.setAttribute('marker-end', 'url(#erRelation)');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].hasArrow).toBe(true);
  });

  it('sets hasArrow=false when no marker-end attribute', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].hasArrow).toBe(false);
  });

  it('sets noSnap=true on every edge', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].noSnap).toBe(true);
  });

  it('sets type="link" on every edge', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].type).toBe('link');
  });

  it('uses non-premium stroke fallback when computed stroke is absent', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].stroke).toBe('#333');
  });

  it('uses premium stroke fallback when computed stroke is absent and isPremium=true', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, true)[0].stroke).toBe('#94a3b8');
  });

  it('uses computed stroke when present', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'rgb(22, 163, 74)',
    } as unknown as CSSStyleDeclaration);
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].stroke).toBe('rgb(22, 163, 74)');
  });

  it('finds relationship path via path.relationshipLine selector (v11)', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('relationshipLine');  // no .er prefix in v11
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)).toHaveLength(1);
  });

  it.each([
    ['url(#mermaid-hidden-0_er-zeroOrMoreEnd)', 'erZeroOrMany'],
    ['url(#ZERO_OR_MORE_END)',                  'erZeroOrMany'],
    ['url(#mermaid-hidden-0_er-oneOrMoreEnd)',  'erMany'],
    ['url(#ONE_OR_MORE_END)',                   'erMany'],
    ['url(#mermaid-hidden-0_er-zeroOrOneEnd)',  'erZeroOrOne'],
    ['url(#ZERO_OR_ONE_END)',                   'erZeroOrOne'],
    ['url(#mermaid-hidden-0_er-onlyOneEnd)',    'erOne'],
    ['url(#ONLY_ONE_END)',                      'erOne'],
  ])('arrowEnd: marker-end="%s" → %s', (markerUrl, expected) => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    path.setAttribute('marker-end', markerUrl);
    svgElement.appendChild(path);

    const edge = parseErEdges(svgElement, false)[0];
    expect(edge.arrowEnd).toBe(expected);
    expect(edge.hasArrow).toBe(true);
  });

  it('sets arrowStart from marker-start attribute', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    path.setAttribute('marker-start', 'url(#mermaid-hidden-0_er-zeroOrMoreStart)');
    svgElement.appendChild(path);

    const edge = parseErEdges(svgElement, false)[0];
    expect(edge.arrowStart).toBe('erZeroOrMany');
    expect(edge.hasArrow).toBe(true);
  });

  it('sets hasArrow=true when only arrowStart is set', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    path.setAttribute('marker-start', 'url(#mermaid-hidden-0_er-onlyOneStart)');
    svgElement.appendChild(path);

    expect(parseErEdges(svgElement, false)[0].hasArrow).toBe(true);
  });

  it('arrowEnd and arrowStart are undefined when markers are absent', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('er', 'relationshipLine');
    path.setAttribute('d', 'M 0 0 L 100 0 L 200 100');
    svgElement.appendChild(path);

    const edge = parseErEdges(svgElement, false)[0];
    expect(edge.arrowEnd).toBeUndefined();
    expect(edge.arrowStart).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseErEdgeLabels', () => {
  let svgElement: SVGSVGElement;

  const identityMatrix = {
    a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    inverse: function() { return this; },
    multiply: function(m: unknown) { return m; },
  } as unknown as DOMMatrix;

  beforeEach(() => {
    svgElement = el<SVGSVGElement>('svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for an empty SVG', () => {
    expect(parseErEdgeLabels(svgElement)).toEqual([]);
  });

  it('skips edgeLabel group with empty text', () => {
    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject'); fo.textContent = '   ';
    g.appendChild(fo);
    svgElement.appendChild(g);

    expect(parseErEdgeLabels(svgElement)).toHaveLength(0);
  });

  it('returns empty when getCTM is unavailable (jsdom default)', () => {
    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject'); fo.textContent = 'has';
    g.appendChild(fo);
    svgElement.appendChild(g);

    // jsdom does not implement getCTM → returns null → skipped silently
    expect(parseErEdgeLabels(svgElement)).toHaveLength(0);
  });

  it('extracts text and computes centre when CTM is available', () => {
    const g = el('g'); g.classList.add('edgeLabel');
    const fo = el('foreignObject'); fo.textContent = 'places';
    g.appendChild(fo);
    svgElement.appendChild(g);

    // bbox: x=10, y=20, w=80, h=40 → centre (50, 40)
    (g as unknown as SVGGraphicsElement).getBBox = () =>
      ({ x: 10, y: 20, width: 80, height: 40 } as DOMRect);
    (g as unknown as SVGGraphicsElement).getCTM = () => identityMatrix as unknown as DOMMatrix;
    (svgElement as unknown as SVGGraphicsElement).getCTM = () => identityMatrix as unknown as DOMMatrix;

    const labels = parseErEdgeLabels(svgElement);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('places');
    expect(labels[0].x).toBeCloseTo(50);
    expect(labels[0].y).toBeCloseTo(40);
    expect(labels[0].align).toBe('center');
  });
});
