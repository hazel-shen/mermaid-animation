import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseErNodes, parseErEdges } from '../../services/ErParser';
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
    expect(node.stroke).toBe('#16a34a');
  });

  it('uses premium default colors when isPremium=true', () => {
    const g = el('g'); g.classList.add('er', 'entityBox');
    g.appendChild(el('rect'));
    svgElement.appendChild(g);

    const [node] = parseErNodes(svgElement, true);
    expect(node.color).toBe('#f0fdf4');
    expect(node.stroke).toBe('#16a34a');
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
});
