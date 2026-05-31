import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitGraphNodes, parseGitGraphEdges, parseGitGraphLabels, snapGitArrowsToNodes, regenGitArrowPaths } from '../../services/GitGraphParser';
import { resetIdCounter } from '../../utils/parser-base';
import type { DiagramNode, DiagramEdge } from '../../types';

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

  it('sets width and height scaling r by 1.4x (min r=10)', () => {
    const circle = el<SVGCircleElement>('circle');
    circle.classList.add('commit', 'commit0');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '15');
    svg.appendChild(circle);

    const [node] = parseGitGraphNodes(svg, false);
    // r = Math.max(15, 10) * 1.4 = 21 → width = 42
    expect(node.width).toBeCloseTo(42);
    expect(node.height).toBeCloseTo(42);
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

  it('sets dash=[8,6] on lifelines', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch0');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].dash).toEqual([8, 6]);
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

  it('uses neutral gray (#9ca3af) for lifeline stroke regardless of branch index', () => {
    const line = el<SVGLineElement>('line');
    line.classList.add('branch', 'branch3');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '100'); line.setAttribute('y2', '0');
    svg.appendChild(line);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: '' } as unknown as CSSStyleDeclaration);

    expect(parseGitGraphEdges(svg, false)[0].stroke).toBe('#9ca3af');
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

  const LINE_STEP = 22;
  const LATERAL = LINE_STEP * 0.5;

  // Helpers: build a DiagramNode as parseGitGraphNodes would after expansion
  const makeCommitNode = (
    x: number, y: number, r = 10,
    gitCommitLabel?: string, gitTagLabel?: string,
    shape: DiagramNode['shape'] = 'circle',
  ): DiagramNode => ({
    id: `test-${Math.random()}`,
    label: '',
    type: 'node',
    shape,
    x, y,
    width: r * 2, height: r * 2,
    color: '#2166f3',
    stroke: '#2166f3',
    gitCommitLabel,
    gitTagLabel,
  });

  beforeEach(() => {
    svg = el<SVGSVGElement>('svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns empty array when no expandedNodes passed', () => {
    expect(parseGitGraphLabels(svg)).toEqual([]);
  });

  it('returns empty array when node has no commit label or tag label', () => {
    expect(parseGitGraphLabels(svg, [makeCommitNode(50, 80)])).toHaveLength(0);
  });

  it('generates a commit label from node gitCommitLabel', () => {
    const nodes = [makeCommitNode(50, 80, 10, 'A')];
    const labels = parseGitGraphLabels(svg, nodes);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('A');
  });

  it('computes x = cx - LATERAL and y = cy + r + LINE_STEP', () => {
    const cx = 100, cy = 120, r = 10;
    const nodes = [makeCommitNode(cx, cy, r, 'B')];
    const [label] = parseGitGraphLabels(svg, nodes);
    expect(label.x).toBeCloseTo(cx - LATERAL);
    expect(label.y).toBeCloseTo(cy + r + LINE_STEP);
  });

  it('sets rotation to -Math.PI / 5.5', () => {
    const [label] = parseGitGraphLabels(svg, [makeCommitNode(50, 80, 10, 'D')]);
    expect(label.rotation).toBeCloseTo(-Math.PI / 5.5);
  });

  it('sets fontSize=11, bold=false, align=left', () => {
    const [label] = parseGitGraphLabels(svg, [makeCommitNode(50, 80, 10, 'E')]);
    expect(label.fontSize).toBe(11);
    expect(label.bold).toBe(false);
    expect(label.align).toBe('left');
  });

  it('skips nodes with no commit label', () => {
    const nodes = [makeCommitNode(50, 80), makeCommitNode(150, 80, 10, 'Z')];
    const labels = parseGitGraphLabels(svg, nodes);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('Z');
    expect(labels[0].x).toBeCloseTo(150 - LATERAL);
  });

  it('generates labels for multiple nodes in order', () => {
    const nodes = [makeCommitNode(50, 80, 10, 'X'), makeCommitNode(150, 80, 10, 'Y')];
    const labels = parseGitGraphLabels(svg, nodes);
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('X');
    expect(labels[0].x).toBeCloseTo(50 - LATERAL);
    expect(labels[1].text).toBe('Y');
    expect(labels[1].x).toBeCloseTo(150 - LATERAL);
  });

  it('excludes roundRect (branch label pill) nodes from label generation', () => {
    const nodes = [makeCommitNode(50, 80, 10, 'A', undefined, 'roundRect')];
    expect(parseGitGraphLabels(svg, nodes)).toHaveLength(0);
  });

  it('mergeCircle nodes also generate commit labels', () => {
    const nodes = [makeCommitNode(80, 80, 10, 'M', undefined, 'mergeCircle')];
    const labels = parseGitGraphLabels(svg, nodes);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('M');
  });
});

// ─── snapGitArrowsToNodes ─────────────────────────────────────────────────────

describe('snapGitArrowsToNodes', () => {
  const makeNode = (id: string, x: number, y: number, shape: DiagramNode['shape'] = 'circle'): DiagramNode => ({
    id, label: '', type: 'node', shape, x, y, width: 20, height: 20, color: '#000', stroke: '#000',
  });

  const makeArrow = (id: string, pathD: string): DiagramEdge => ({
    id, pathD, stroke: '#000', type: 'link', hasArrow: false,
  });

  const makeLifeline = (pathD: string): DiagramEdge => ({
    id: 'git-lifeline-1', pathD, stroke: '#9ca3af', type: 'structural', hasArrow: false,
  });

  it('returns edges unchanged when no commit nodes exist', () => {
    const edges = [makeArrow('git-arrow-1', 'M 0 0 L 100 0')];
    const result = snapGitArrowsToNodes(edges, []);
    expect(result[0].fromNodeId).toBeUndefined();
    expect(result[0].toNodeId).toBeUndefined();
  });

  it('does not modify non-arrow edges (lifelines stay untouched)', () => {
    const lifeline = makeLifeline('M 0 80 L 500 80');
    const node = makeNode('n1', 50, 80);
    const result = snapGitArrowsToNodes([lifeline], [node]);
    expect(result[0].fromNodeId).toBeUndefined();
    expect(result[0].toNodeId).toBeUndefined();
  });

  it('assigns fromNodeId to the nearest node to the start point', () => {
    const nodes = [makeNode('n1', 50, 80), makeNode('n2', 150, 80)];
    const arrow = makeArrow('git-arrow-1', 'M 50 80 L 150 80');
    const [result] = snapGitArrowsToNodes([arrow], nodes);
    expect(result.fromNodeId).toBe('n1');
  });

  it('assigns toNodeId to the nearest node to the end point', () => {
    const nodes = [makeNode('n1', 50, 80), makeNode('n2', 150, 80)];
    const arrow = makeArrow('git-arrow-1', 'M 50 80 L 150 80');
    const [result] = snapGitArrowsToNodes([arrow], nodes);
    expect(result.toNodeId).toBe('n2');
  });

  it('correctly matches cross-branch arrow start/end after coordinate expansion', () => {
    // Simulates a branch-off arrow after expandGitBranchSpacing:
    // start near main commit (x=130, y=30), end near feature first commit (x=220, y=150)
    const nodes = [
      makeNode('main-1',    130, 30),
      makeNode('feature-1', 220, 150),
      makeNode('main-2',    310, 30),
    ];
    const arrow = makeArrow('git-arrow-2', 'M 130 30 L 130 150 L 220 150');
    const [result] = snapGitArrowsToNodes([arrow], nodes);
    expect(result.fromNodeId).toBe('main-1');
    expect(result.toNodeId).toBe('feature-1');
  });

  it('skips snap when path has no recognisable start point', () => {
    const node = makeNode('n1', 50, 80);
    const arrow = makeArrow('git-arrow-1', 'Z');
    const [result] = snapGitArrowsToNodes([arrow], [node]);
    expect(result.fromNodeId).toBeUndefined();
  });

  it('only considers commit-shaped nodes (excludes roundRect branch labels)', () => {
    const commitNode  = makeNode('commit', 100, 80, 'circle');
    const branchLabel = makeNode('label',   20, 80, 'roundRect');
    // Arrow start is closer to branchLabel but it should not be matched
    const arrow = makeArrow('git-arrow-1', 'M 30 80 L 100 80');
    const [result] = snapGitArrowsToNodes([arrow], [commitNode, branchLabel]);
    expect(result.fromNodeId).toBe('commit');
  });
});

// ─── regenGitArrowPaths ───────────────────────────────────────────────────────

describe('regenGitArrowPaths', () => {
  const makeNode = (id: string, x: number, y: number): DiagramNode => ({
    id, label: '', type: 'node', shape: 'circle', x, y, width: 20, height: 20, color: '#000', stroke: '#000',
  });

  const makeArrow = (fromNodeId: string, toNodeId: string): DiagramEdge => ({
    id: 'git-arrow-1', pathD: 'M 0 0 L 1 1', stroke: '#000', type: 'link', hasArrow: false, fromNodeId, toNodeId,
  });

  const makeLifeline = (): DiagramEdge => ({
    id: 'git-lifeline-1', pathD: 'M 0 80 L 500 80', stroke: '#9ca3af', type: 'structural', hasArrow: false,
  });

  it('does not modify non-arrow edges', () => {
    const lifeline = makeLifeline();
    const result = regenGitArrowPaths([lifeline], []);
    expect(result[0].pathD).toBe('M 0 80 L 500 80');
  });

  it('leaves edge unchanged when fromNodeId or toNodeId is missing', () => {
    const edge: DiagramEdge = { id: 'git-arrow-1', pathD: 'M 0 0 L 1 1', stroke: '#000', type: 'link', hasArrow: false };
    const result = regenGitArrowPaths([edge], [makeNode('n1', 50, 80)]);
    expect(result[0].pathD).toBe('M 0 0 L 1 1');
  });

  it('generates a straight horizontal path for same-branch commits (same Y)', () => {
    const nodes = [makeNode('a', 50, 80), makeNode('b', 150, 80)];
    const result = regenGitArrowPaths([makeArrow('a', 'b')], nodes);
    expect(result[0].pathD).toBe('M 50 80 L 150 80');
  });

  it('generates a vertical-first path with Q curve for branch-off (y2 > y1)', () => {
    const nodes = [makeNode('main', 130, 30), makeNode('feat', 220, 150)];
    const result = regenGitArrowPaths([makeArrow('main', 'feat')], nodes);
    const d = result[0].pathD;
    // Must start with M at from-node centre
    expect(d).toMatch(/^M 130 30/);
    // Must contain a Q (quadratic bezier) for the rounded corner
    expect(d).toContain('Q');
    // Must end at to-node centre
    expect(d).toMatch(/L 220 150$/);
  });

  it('generates a horizontal-first path with Q curve for merge (y2 < y1)', () => {
    const nodes = [makeNode('feat', 220, 150), makeNode('main', 310, 30)];
    const result = regenGitArrowPaths([makeArrow('feat', 'main')], nodes);
    const d = result[0].pathD;
    expect(d).toMatch(/^M 220 150/);
    expect(d).toContain('Q');
    expect(d).toMatch(/L 310 30$/);
  });

  it('corner radius is clamped when segments are very short', () => {
    // Tiny vertical segment: y difference = 10 → r should be at most 5 (half of 10)
    const nodes = [makeNode('a', 100, 0), makeNode('b', 200, 10)];
    const result = regenGitArrowPaths([makeArrow('a', 'b')], nodes);
    const d = result[0].pathD;
    // Q control point y must be between y1=0 and y2=10
    const qMatch = d.match(/Q ([\d.]+) ([\d.]+)/);
    expect(qMatch).not.toBeNull();
    const qY = parseFloat(qMatch![2]);
    expect(qY).toBeGreaterThanOrEqual(0);
    expect(qY).toBeLessThanOrEqual(10);
  });

  it('rebuilds paths for multiple arrows independently', () => {
    const nodes = [
      makeNode('a', 50, 80), makeNode('b', 150, 80),
      makeNode('c', 150, 200), makeNode('d', 250, 80),
    ];
    const edges = [makeArrow('a', 'b'), { ...makeArrow('b', 'c'), id: 'git-arrow-2' }];
    const result = regenGitArrowPaths(edges, nodes);
    expect(result[0].pathD).toBe('M 50 80 L 150 80');   // same branch
    expect(result[1].pathD).toContain('Q');               // branch-off
  });
});
