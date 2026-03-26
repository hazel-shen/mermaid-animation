import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitGraphNodes, parseGitGraphEdges, parseGitGraphLabels } from '../../services/GitGraphParser';
import { resetIdCounter } from '../../utils/parser-base';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;

// Default BRANCH_PALETTE from GitGraphParser (index 0–7)
const PALETTE = [
  '#2166f3',
  '#e6a817',
  '#6db33f',
  '#e05d44',
  '#8338ec',
  '#fb5607',
  '#3a86ff',
  '#ff006e',
];

// ─── parseGitGraphNodes ───────────────────────────────────────────────────────

describe('parseGitGraphNodes', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for empty SVG', () => {
    expect(parseGitGraphNodes(svg, false)).toEqual([]);
  });

  // ── Regular commit circles ──────────────────────────────────────────────────

  it('finds a regular commit circle via circle.commit selector', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '80');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    const nodes = parseGitGraphNodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('circle');
    expect(nodes[0].type).toBe('node');
  });

  it('sets cx/cy from circle attributes', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '200');
    circle.setAttribute('r', '12');
    svg.appendChild(circle);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.x).toBe(100);
    expect(node.y).toBe(200);
  });

  it('accumulates parent transform into cx/cy', () => {
    const g = el('g');
    g.setAttribute('transform', 'translate(30, 40)');
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', '10');
    g.appendChild(circle);
    svg.appendChild(g);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.x).toBe(80);
    expect(node.y).toBe(100);
  });

  it('sets width and height as r * 2', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '15');
    svg.appendChild(circle);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.width).toBe(30);
    expect(node.height).toBe(30);
  });

  it('falls back to BRANCH_PALETTE color by branchIdx when computed fill is absent', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit2');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.color).toBe(PALETTE[2]);
    expect(node.stroke).toBe(PALETTE[2]);
  });

  it('uses computed fill when available', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'rgb(255, 0, 0)' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.color).toBe('rgb(255, 0, 0)');
  });

  it('defaults branchIdx to 0 when no commitN class is present', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.color).toBe(PALETTE[0]);
  });

  // ── Merge commits ───────────────────────────────────────────────────────────

  it('skips circle.commit-merge inner ring circles', () => {
    const inner = el<SVGCircleElement>('circle');
    inner.classList.add('commit', 'commit-merge', 'commit0');
    inner.setAttribute('cx', '50');
    inner.setAttribute('cy', '50');
    inner.setAttribute('r', '6');
    svg.appendChild(inner);

    expect(parseGitGraphNodes(svg, false)).toHaveLength(0);
  });

  it('identifies merge commit outer ring as shape=mergeCircle', () => {
    // Inner ring (commit-merge) — registers position
    const inner = el<SVGCircleElement>('circle');
    inner.classList.add('commit', 'commit-merge', 'commit0');
    inner.setAttribute('cx', '50');
    inner.setAttribute('cy', '80');
    inner.setAttribute('r', '6');
    svg.appendChild(inner);

    // Outer ring — same position, no commit-merge class
    const outer = el<SVGCircleElement>('circle');
    outer.classList.add('commit', 'commit0');
    outer.setAttribute('cx', '50');
    outer.setAttribute('cy', '80');
    outer.setAttribute('r', '10');
    svg.appendChild(outer);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const nodes = parseGitGraphNodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('mergeCircle');
  });

  it('regular commit at different position stays shape=circle even with a nearby merge', () => {
    const inner = el<SVGCircleElement>('circle');
    inner.classList.add('commit', 'commit-merge', 'commit0');
    inner.setAttribute('cx', '50');
    inner.setAttribute('cy', '80');
    inner.setAttribute('r', '6');
    svg.appendChild(inner);

    const regular = el<SVGCircleElement>('circle');
    regular.classList.add('commit', 'commit0');
    regular.setAttribute('cx', '150');
    regular.setAttribute('cy', '80');
    regular.setAttribute('r', '10');
    svg.appendChild(regular);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const nodes = parseGitGraphNodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('circle');
  });

  // ── Branch label pills ──────────────────────────────────────────────────────

  it('finds branch label via rect.branchLabelBkg and g.branchLabel', () => {
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('branchLabelBkg');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '20');
    rect.setAttribute('width', '80');
    rect.setAttribute('height', '24');
    svg.appendChild(rect);

    const labelG = el('g');
    labelG.classList.add('branchLabel');
    const innerG = el('g');
    innerG.classList.add('label');
    const text = el('text');
    text.textContent = 'main';
    innerG.appendChild(text);
    labelG.appendChild(innerG);
    svg.appendChild(labelG);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const nodes = parseGitGraphNodes(svg, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].shape).toBe('roundRect');
    expect(nodes[0].label).toBe('main');
  });

  it('computes branch label centre from rect x/y + width/height', () => {
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('branchLabelBkg');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '20');
    rect.setAttribute('width', '80');
    rect.setAttribute('height', '24');
    svg.appendChild(rect);

    const labelG = el('g');
    labelG.classList.add('branchLabel');
    svg.appendChild(labelG);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.x).toBe(50);  // 10 + 80/2
    expect(node.y).toBe(32);  // 20 + 24/2
    expect(node.width).toBe(80);
    expect(node.height).toBe(24);
  });

  it('accumulates parent transform into branch label position', () => {
    const g = el('g');
    g.setAttribute('transform', 'translate(100, 50)');

    const rect = el<SVGRectElement>('rect');
    rect.classList.add('branchLabelBkg');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '60');
    rect.setAttribute('height', '20');
    g.appendChild(rect);
    svg.appendChild(g);

    const labelG = el('g');
    labelG.classList.add('branchLabel');
    svg.appendChild(labelG);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.x).toBe(130);  // 100 + 0 + 60/2
    expect(node.y).toBe(60);   // 50 + 0 + 20/2
  });

  it('falls back to BRANCH_PALETTE for branch label fill when computed is absent', () => {
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('branchLabelBkg');
    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
    rect.setAttribute('width', '60'); rect.setAttribute('height', '20');
    svg.appendChild(rect);

    const labelG = el('g'); labelG.classList.add('branchLabel');
    svg.appendChild(labelG);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.color).toBe(PALETTE[0]);
  });

  it('uses computed fill for branch label when available', () => {
    const rect = el<SVGRectElement>('rect');
    rect.classList.add('branchLabelBkg');
    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
    rect.setAttribute('width', '60'); rect.setAttribute('height', '20');
    svg.appendChild(rect);

    const labelG = el('g'); labelG.classList.add('branchLabel');
    svg.appendChild(labelG);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'rgb(33, 102, 243)' } as unknown as CSSStyleDeclaration);

    const [node] = parseGitGraphNodes(svg, false);
    expect(node.color).toBe('rgb(33, 102, 243)');
  });

  it('pairs multiple branch labels with their rects by index', () => {
    for (let i = 0; i < 2; i++) {
      const rect = el<SVGRectElement>('rect');
      rect.classList.add('branchLabelBkg');
      rect.setAttribute('x', String(i * 100));
      rect.setAttribute('y', '0');
      rect.setAttribute('width', '60');
      rect.setAttribute('height', '20');
      svg.appendChild(rect);
    }

    for (const name of ['main', 'feat']) {
      const labelG = el('g'); labelG.classList.add('branchLabel');
      const innerG = el('g');
      const text = el('text'); text.textContent = name;
      innerG.appendChild(text); labelG.appendChild(innerG);
      svg.appendChild(labelG);
    }

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);

    const nodes = parseGitGraphNodes(svg, false);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].label).toBe('main');
    expect(nodes[1].label).toBe('feat');
  });
});

// ─── parseGitGraphEdges ───────────────────────────────────────────────────────

describe('parseGitGraphEdges', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for empty SVG', () => {
    expect(parseGitGraphEdges(svg, false)).toEqual([]);
  });

  // ── Branch lifelines ────────────────────────────────────────────────────────

  it('finds branch lifeline via line.branch selector', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '50');
    line.setAttribute('x2', '300'); line.setAttribute('y2', '50');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    const edges = parseGitGraphEdges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('structural');
  });

  it('sets dash=[6,4] on lifelines', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].dash).toEqual([6, 4]);
  });

  it('sets hasArrow=false on lifelines', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].hasArrow).toBe(false);
  });

  it('applies parent transform to lifeline coordinates', () => {
    const g = el('g');
    g.setAttribute('transform', 'translate(10, 20)');
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    g.appendChild(line);
    svg.appendChild(g);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    const [edge] = parseGitGraphEdges(svg, false);
    expect(edge.pathD).toBe('M 10 20 L 110 20');
  });

  it('uses branchIdx from branch class for stroke fallback', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch3');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].stroke).toBe(PALETTE[3]);
  });

  it('deduplicates lifelines with identical path d', () => {
    for (let i = 0; i < 2; i++) {
      const line = el<SVGLineElement>('line');
      line.classList.add('branch', 'branch0');
      line.setAttribute('x1', '0'); line.setAttribute('y1', '50');
      line.setAttribute('x2', '300'); line.setAttribute('y2', '50');
      svg.appendChild(line);
    }

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)).toHaveLength(1);
  });

  // ── Commit arrows ───────────────────────────────────────────────────────────

  it('finds commit arrow via g.commit-arrows > path', () => {
    const g = el('g'); g.classList.add('commit-arrows');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 50 L 100 50');
    g.appendChild(path);
    svg.appendChild(g);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    const edges = parseGitGraphEdges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('link');
  });

  it('sets hasArrow=false on commit arrows', () => {
    const g = el('g'); g.classList.add('commit-arrows');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 50 L 100 50');
    g.appendChild(path);
    svg.appendChild(g);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].hasArrow).toBe(false);
  });

  it('finds commit arrow via path.arrow selector', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('arrow', 'arrow1');
    path.setAttribute('d', 'M 0 0 L 50 50');
    svg.appendChild(path);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    const edges = parseGitGraphEdges(svg, false);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('link');
  });

  it('uses arrowIdx from arrow class for stroke fallback', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('arrow', 'arrow5');
    path.setAttribute('d', 'M 0 0 L 50 50');
    svg.appendChild(path);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].stroke).toBe(PALETTE[5]);
  });

  it('skips arrow path with d length ≤ 4', () => {
    const path = el<SVGPathElement>('path');
    path.classList.add('arrow', 'arrow0');
    path.setAttribute('d', 'M 0');
    svg.appendChild(path);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)).toHaveLength(0);
  });

  it('deduplicates arrows with identical translated path d', () => {
    const g = el('g'); g.classList.add('commit-arrows');
    for (let i = 0; i < 2; i++) {
      const path = el<SVGPathElement>('path');
      path.setAttribute('d', 'M 10 50 L 100 50');
      g.appendChild(path);
    }
    svg.appendChild(g);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)).toHaveLength(1);
  });

  it('returns both lifeline and arrow edges together', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '200'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    const g = el('g'); g.classList.add('commit-arrows');
    const path = el<SVGPathElement>('path');
    path.setAttribute('d', 'M 10 50 L 100 50');
    g.appendChild(path);
    svg.appendChild(g);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    const edges = parseGitGraphEdges(svg, false);
    expect(edges).toHaveLength(2);
    expect(edges.find(e => e.type === 'structural')).toBeDefined();
    expect(edges.find(e => e.type === 'link')).toBeDefined();
  });
});

// ─── parseGitGraphLabels ──────────────────────────────────────────────────────

describe('parseGitGraphLabels', () => {
  let svg: SVGSVGElement;

  const GAP = 30;
  const LATERAL = GAP * 0.5;

  const makeCircle = (cx: number, cy: number, r = 10, cls = 'commit commit0') => {
    const circle = el<SVGCircleElement>('circle');
    circle.setAttribute('class', cls);
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(r));
    return circle;
  };

  const makeLabel = (text: string) => {
    const g = el('g'); g.classList.add('commit-labels');
    const innerG = el('g');
    const txt = el<SVGTextElement>('text');
    txt.classList.add('commit-label');
    txt.textContent = text;
    innerG.appendChild(txt);
    g.appendChild(innerG);
    return g;
  };

  beforeEach(() => {
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array for empty SVG', () => {
    expect(parseGitGraphLabels(svg)).toEqual([]);
  });

  it('skips commit-label with empty text content', () => {
    svg.appendChild(makeCircle(50, 80));
    const g = makeLabel('');
    svg.appendChild(g);

    expect(parseGitGraphLabels(svg)).toHaveLength(0);
  });

  it('skips commit-label with whitespace-only text', () => {
    svg.appendChild(makeCircle(50, 80));
    const g = makeLabel('   ');
    svg.appendChild(g);

    expect(parseGitGraphLabels(svg)).toHaveLength(0);
  });

  it('pairs commit-label text with commit circle by DOM index', () => {
    svg.appendChild(makeCircle(50, 80));
    svg.appendChild(makeLabel('A'));

    const labels = parseGitGraphLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('A');
  });

  it('computes x = cx - LATERAL and y = cy + r + GAP', () => {
    const cx = 100, cy = 120, r = 10;
    svg.appendChild(makeCircle(cx, cy, r));
    svg.appendChild(makeLabel('B'));

    const [label] = parseGitGraphLabels(svg);
    expect(label.x).toBeCloseTo(cx - LATERAL);
    expect(label.y).toBeCloseTo(cy + r + GAP);
  });

  it('accounts for parent transform in circle position', () => {
    const g = el('g');
    g.setAttribute('transform', 'translate(40, 60)');
    g.appendChild(makeCircle(10, 20, 10));
    svg.appendChild(g);
    svg.appendChild(makeLabel('C'));

    const [label] = parseGitGraphLabels(svg);
    // world cx = 40+10 = 50, world cy = 60+20 = 80
    expect(label.x).toBeCloseTo(50 - LATERAL);
    expect(label.y).toBeCloseTo(80 + 10 + GAP);
  });

  it('sets rotation to -Math.PI / 5.5', () => {
    svg.appendChild(makeCircle(50, 80));
    svg.appendChild(makeLabel('D'));

    const [label] = parseGitGraphLabels(svg);
    expect(label.rotation).toBeCloseTo(-Math.PI / 5.5);
  });

  it('sets fontSize=11, bold=false, align=left', () => {
    svg.appendChild(makeCircle(50, 80));
    svg.appendChild(makeLabel('E'));

    const [label] = parseGitGraphLabels(svg);
    expect(label.fontSize).toBe(11);
    expect(label.bold).toBe(false);
    expect(label.align).toBe('left');
  });

  it('skips label when circle count is less than label index', () => {
    // 1 circle, 2 labels — second label should be skipped
    svg.appendChild(makeCircle(50, 80));
    svg.appendChild(makeLabel('A'));
    svg.appendChild(makeLabel('B'));

    const labels = parseGitGraphLabels(svg);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('A');
  });

  it('pairs multiple labels with circles in order', () => {
    svg.appendChild(makeCircle(50, 80));
    svg.appendChild(makeCircle(150, 80));
    svg.appendChild(makeLabel('X'));
    svg.appendChild(makeLabel('Y'));

    const labels = parseGitGraphLabels(svg);
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('X');
    expect(labels[0].x).toBeCloseTo(50 - LATERAL);
    expect(labels[1].text).toBe('Y');
    expect(labels[1].x).toBeCloseTo(150 - LATERAL);
  });

  it('excludes commit-merge circles from circle pairing', () => {
    // commit-merge inner circle should not count as a pairing target
    svg.appendChild(makeCircle(50, 80, 6, 'commit commit-merge commit0'));
    svg.appendChild(makeCircle(150, 80, 10, 'commit commit0'));
    svg.appendChild(makeLabel('Z'));

    const labels = parseGitGraphLabels(svg);
    expect(labels).toHaveLength(1);
    // Should pair with the non-merge circle at cx=150
    expect(labels[0].x).toBeCloseTo(150 - LATERAL);
  });
});
