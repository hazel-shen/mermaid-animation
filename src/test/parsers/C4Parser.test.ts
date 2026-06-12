import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseC4Nodes,
  parseC4Edges,
  parseC4NodeLabels,
  parseC4EdgeLabels,
} from '../../services/C4Parser';
import { resetIdCounter } from '../../utils/parser-base';

// jsdom does not implement getBBox — provide a sensible default.
const mockBBox = (x = 0, y = 0, width = 100, height = 50): DOMRect =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect);

const NS = 'http://www.w3.org/2000/svg';
const makeSvg = () => document.createElementNS(NS, 'svg') as SVGSVGElement;
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

const setAttrs = (e: Element, attrs: Record<string, string>) =>
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));

/** Builds a g.person-man element group (System / Container / Component). */
const makeRectElement = (svg: SVGSVGElement, id: string, opts: {
  transform?: string;
  rect?: Record<string, string>;
  texts?: { content: string; bold?: boolean; italic?: boolean }[];
} = {}) => {
  const g = el<SVGGElement>('g');
  g.setAttribute('class', 'person-man');
  if (id) g.id = id;
  if (opts.transform) g.setAttribute('transform', opts.transform);
  const rect = el<SVGRectElement>('rect');
  setAttrs(rect, { x: '0', y: '0', width: '120', height: '60', fill: '#1168bd', stroke: '#073b6f', ...opts.rect });
  g.appendChild(rect);
  for (const t of opts.texts ?? []) {
    const text = el<SVGTextElement>('text');
    text.textContent = t.content;
    const styles = [
      t.bold ? 'font-weight: 700' : '',
      t.italic ? 'font-style: italic' : '',
    ].filter(Boolean).join('; ');
    if (styles) text.setAttribute('style', styles);
    g.appendChild(text);
  }
  svg.appendChild(g);
  return g;
};

/** Builds a boundary group: unnamed <g> with a dashed rect + title text. */
const makeBoundary = (svg: SVGSVGElement, opts: {
  id?: string;
  rect?: Record<string, string>;
  title?: string;
} = {}) => {
  const g = el<SVGGElement>('g');
  if (opts.id) g.id = opts.id;
  const rect = el<SVGRectElement>('rect');
  setAttrs(rect, {
    x: '10', y: '20', width: '400', height: '300',
    'stroke-dasharray': '7.0,7.0', fill: 'none', stroke: '#444444',
    ...opts.rect,
  });
  g.appendChild(rect);
  if (opts.title) {
    const text = el<SVGTextElement>('text');
    text.textContent = opts.title;
    g.appendChild(text);
  }
  svg.appendChild(g);
  return g;
};

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
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

// ─── parseC4Nodes ─────────────────────────────────────────────────────────────

describe('parseC4Nodes', () => {
  let svg: SVGSVGElement;
  beforeEach(() => { svg = makeSvg(); document.body.appendChild(svg); });

  it('returns empty array for empty SVG', () => {
    expect(parseC4Nodes(svg, false)).toEqual([]);
  });

  it('parses a boundary (dashed rect) as a cluster node, before elements', () => {
    makeBoundary(svg, { id: 'b1', title: '網路銀行系統' });
    makeRectElement(svg, 'web_app');

    const nodes = parseC4Nodes(svg, false);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe('cluster');
    expect(nodes[0].id).toBe('b1');
    // centre = (x + w/2, y + h/2) = (10 + 200, 20 + 150)
    expect(nodes[0].x).toBe(210);
    expect(nodes[0].y).toBe(170);
    expect(nodes[0].width).toBe(400);
    expect(nodes[0].height).toBe(300);
  });

  it('leaves node labels empty — text is emitted as positioned labels instead', () => {
    makeBoundary(svg, { id: 'b1', title: '網路銀行系統' });
    makeRectElement(svg, 'api', { texts: [{ content: 'API 應用程式', bold: true }] });

    const nodes = parseC4Nodes(svg, false);
    expect(nodes.every(n => n.label === '')).toBe(true);
  });

  it('marks element nodes preserveColor so the dark theme keeps C4 semantic colors', () => {
    makeBoundary(svg, { id: 'b1' });
    makeRectElement(svg, 'api');

    const nodes = parseC4Nodes(svg, false);
    expect(nodes.find(n => n.id === 'api')!.preserveColor).toBe(true);
    // Boundaries stay themeable (structural, not semantic)
    expect(nodes.find(n => n.id === 'b1')!.preserveColor).toBeUndefined();
  });

  it('skips boundaries with zero width or height', () => {
    makeBoundary(svg, { rect: { width: '0' } });
    expect(parseC4Nodes(svg, false)).toEqual([]);
  });

  it('parses a rect element (System/Container) as roundRect with transform applied', () => {
    makeRectElement(svg, 'api', { transform: 'translate(200, 100)' });

    const nodes = parseC4Nodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('roundRect');
    expect(nodes[0].type).toBe('node');
    expect(nodes[0].id).toBe('api');
    // centre = translate + rect x/y + half size = (200 + 60, 100 + 30)
    expect(nodes[0].x).toBe(260);
    expect(nodes[0].y).toBe(130);
    expect(nodes[0].width).toBe(120);
    expect(nodes[0].height).toBe(60);
  });

  it('classifies elements containing an <image> as c4Person and captures the icon box', () => {
    const g = makeRectElement(svg, 'customer', { transform: 'translate(100, 50)' });
    const image = el<SVGImageElement>('image');
    setAttrs(image, { x: '36', y: '20', width: '48', height: '48' });
    g.appendChild(image);

    const nodes = parseC4Nodes(svg, false);
    expect(nodes[0].shape).toBe('c4Person');
    // icon box = group translate + image x/y
    expect(nodes[0].c4IconBox).toEqual({ x: 136, y: 70, width: 48, height: 48 });
  });

  it('classifies elements with 2+ direct paths and no rect as cylinder (ContainerDb)', () => {
    const g = el<SVGGElement>('g');
    g.setAttribute('class', 'person-man');
    g.id = 'database';
    g.appendChild(el('path'));
    g.appendChild(el('path'));
    svg.appendChild(g);

    const nodes = parseC4Nodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('cylinder');
    // Geometry comes from rectCenter() over the mocked 100×50 bbox
    expect(nodes[0].width).toBe(100);
    expect(nodes[0].height).toBe(50);
  });

  it('skips rect elements with zero dimensions', () => {
    makeRectElement(svg, 'broken', { rect: { width: '0' } });
    expect(parseC4Nodes(svg, false)).toEqual([]);
  });

  it('does not treat dashed rects inside person-man groups as boundaries', () => {
    const g = makeRectElement(svg, 'node1');
    const inner = el<SVGRectElement>('rect');
    setAttrs(inner, { width: '10', height: '10', 'stroke-dasharray': '2,2' });
    g.appendChild(inner);

    const nodes = parseC4Nodes(svg, false);
    expect(nodes.filter(n => n.type === 'cluster')).toHaveLength(0);
  });
});

// ─── parseC4Edges ─────────────────────────────────────────────────────────────

describe('parseC4Edges', () => {
  let svg: SVGSVGElement;
  beforeEach(() => { svg = makeSvg(); document.body.appendChild(svg); });

  const makeLine = (attrs: Record<string, string>, parent: Element = svg) => {
    const line = el<SVGLineElement>('line');
    setAttrs(line, { x1: '0', y1: '0', x2: '100', y2: '0', ...attrs });
    parent.appendChild(line);
    return line;
  };

  it('parses a <line> with marker-end as a forward edge preserving original geometry', () => {
    makeLine({ 'marker-end': 'url(#arrowhead)' });

    const edges = parseC4Edges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].pathD).toBe('M 0 0 L 100 0');
    expect(edges[0].type).toBe('link');
    expect(edges[0].hasArrow).toBe(true);
    expect(edges[0].arrowEnd).toBe('default');
    expect(edges[0].arrowStart).toBeUndefined();
    // Mermaid endpoints already sit on node borders — geometry must be kept
    expect(edges[0].noSnap).toBe(true);
    expect(edges[0].fromNodeId).toBeUndefined();
    expect(edges[0].toNodeId).toBeUndefined();
    // Mermaid paints rels after shapes — lines overlay the node boxes
    expect(edges[0].aboveNodes).toBe(true);
  });

  it('sets arrowStart for BiRel lines with marker-start', () => {
    makeLine({ 'marker-end': 'url(#a)', 'marker-start': 'url(#a)' });
    expect(parseC4Edges(svg, false)[0].arrowStart).toBe('default');
  });

  it('ignores lines without any marker', () => {
    makeLine({});
    expect(parseC4Edges(svg, false)).toEqual([]);
  });

  it('ignores lines inside g.person-man groups', () => {
    const g = el<SVGGElement>('g');
    g.setAttribute('class', 'person-man');
    svg.appendChild(g);
    makeLine({ 'marker-end': 'url(#a)' }, g);
    expect(parseC4Edges(svg, false)).toEqual([]);
  });

  it('parses a curved <path> with marker-end, applying ancestor transforms', () => {
    const g = el<SVGGElement>('g');
    g.setAttribute('transform', 'translate(10, 20)');
    svg.appendChild(g);
    const path = el<SVGPathElement>('path');
    setAttrs(path, { d: 'M 0 0 Q 50 50 100 0', 'marker-end': 'url(#a)' });
    g.appendChild(path);

    const edges = parseC4Edges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].pathD).toBe('M 10,20 Q 60,70 110,20');
  });

  it('ignores paths with a trivially short d attribute', () => {
    const path = el<SVGPathElement>('path');
    setAttrs(path, { d: 'M 0', 'marker-end': 'url(#a)' });
    svg.appendChild(path);
    expect(parseC4Edges(svg, false)).toEqual([]);
  });
});

// ─── parseC4NodeLabels ────────────────────────────────────────────────────────

describe('parseC4NodeLabels', () => {
  let svg: SVGSVGElement;
  beforeEach(() => { svg = makeSvg(); document.body.appendChild(svg); });

  it('emits all element texts including the bold name at SVG positions', () => {
    makeRectElement(svg, 'api', {
      texts: [
        { content: '<<container>>', italic: true },
        { content: 'API 應用程式', bold: true },
        { content: '透過 JSON/HTTPS 提供服務。' },
      ],
    });

    const labels = parseC4NodeLabels(svg);
    expect(labels.map(l => l.text)).toEqual([
      '<<container>>', 'API 應用程式', '透過 JSON/HTTPS 提供服務。',
    ]);

    const name = labels.find(l => l.text === 'API 應用程式')!;
    expect(name.bold).toBe(true);
    expect(name.color).toBe('rgba(255,255,255,1)');
    // centre of the mocked 100×50 bbox
    expect(name.x).toBe(50);
    expect(name.y).toBe(25);

    const type = labels.find(l => l.text === '<<container>>')!;
    expect(type.bold).toBe(false);
    expect(type.color).toBe('rgba(255,255,255,0.65)');
  });

  it('follows UpdateElementStyle($fontColor) via the fill attribute', () => {
    const g = makeRectElement(svg, 'api', { texts: [{ content: 'Styled Name', bold: true }] });
    g.querySelector('text')!.setAttribute('fill', '#ff0000');

    const labels = parseC4NodeLabels(svg);
    expect(labels[0].color).toBe('#ff0000');
  });

  it('keeps the default white scheme when fill is Mermaid default white', () => {
    const g = makeRectElement(svg, 'api', { texts: [{ content: 'Plain Name', bold: true }] });
    g.querySelector('text')!.setAttribute('fill', '#FFFFFF');

    const labels = parseC4NodeLabels(svg);
    expect(labels[0].color).toBe('rgba(255,255,255,1)');
  });

  it('emits boundary titles as bold dark labels', () => {
    makeBoundary(svg, { title: '網路銀行系統' });

    const labels = parseC4NodeLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('網路銀行系統');
    expect(labels[0].bold).toBe(true);
    expect(labels[0].color).toBe('#444444');
  });

  it('ignores free-standing text outside element and boundary groups', () => {
    const text = el<SVGTextElement>('text');
    text.textContent = 'edge label';
    svg.appendChild(text);
    expect(parseC4NodeLabels(svg)).toEqual([]);
  });
});

// ─── parseC4EdgeLabels ────────────────────────────────────────────────────────

describe('parseC4EdgeLabels', () => {
  let svg: SVGSVGElement;
  beforeEach(() => { svg = makeSvg(); document.body.appendChild(svg); });

  it('parses free-standing relationship texts with a background color', () => {
    const text = el<SVGTextElement>('text');
    text.textContent = '呼叫';
    svg.appendChild(text);

    const labels = parseC4EdgeLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('呼叫');
    expect(labels[0].bgColor).toBe('rgba(255,255,255,0.5)');
    // centre of the mocked 100×50 bbox
    expect(labels[0].x).toBe(50);
    expect(labels[0].y).toBe(25);
  });

  it('excludes texts inside person-man groups and boundary groups', () => {
    makeRectElement(svg, 'api', { texts: [{ content: 'node text' }] });
    makeBoundary(svg, { title: 'boundary title' });

    expect(parseC4EdgeLabels(svg)).toEqual([]);
  });

  it('follows UpdateRelStyle($textColor) via the fill attribute', () => {
    const styled = el<SVGTextElement>('text');
    styled.textContent = '紅字';
    styled.setAttribute('fill', 'red');
    svg.appendChild(styled);

    const plain = el<SVGTextElement>('text');
    plain.textContent = '預設';
    plain.setAttribute('fill', '#444444'); // Mermaid's default rel text color
    svg.appendChild(plain);

    const labels = parseC4EdgeLabels(svg);
    expect(labels.find(l => l.text === '紅字')!.color).toBe('red');
    expect(labels.find(l => l.text === '預設')!.color).toBe('#333333');
  });
});
