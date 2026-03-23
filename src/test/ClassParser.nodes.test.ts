import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseClassNodes } from '../services/ClassParser';
import { resetIdCounter } from '../utils/parser-base';

/**
 * jsdom does not implement SVGElement.getBBox(), so we mock it globally.
 * The mock returns a non-zero bounding box so node-validation checks pass.
 */
const mockBBox = (x = -50, y = -25, width = 100, height = 50): DOMRect =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect);

describe('parseClassNodes', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
    // jsdom does not implement getBBox — define it so dimension checks pass
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      writable: true,
      value: () => mockBBox(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error intentionally removing the jsdom-undefined property
    delete SVGElement.prototype.getBBox;
  });

  it('should return empty array for empty SVG', () => {
    expect(parseClassNodes(svgElement, false)).toEqual([]);
  });

  // ── v1 renderer (g.classGroup) ─────────────────────────────────────────

  it('should parse v1 g.classGroup nodes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.id = 'classGroup-Animal';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Animal';

    g.appendChild(rect);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('classGroup-Animal');
    expect(nodes[0].label).toBe('Animal');
    expect(nodes[0].type).toBe('node');
    expect(nodes[0].shape).toBe('rect');
  });

  it('should parse v1 g.cluster nodes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('cluster');
    g.id = 'cluster-Pkg';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Pkg';

    g.appendChild(rect);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].label).toBe('Pkg');
  });

  it('should skip v1 nodes without a rect child', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(0);
  });

  it('should skip v1 nodes when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(0);
  });

  it('should not duplicate v1 nodes with the same id', () => {
    for (let i = 0; i < 2; i++) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('classGroup');
      g.id = 'same-id';
      g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
      svgElement.appendChild(g);
    }

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
  });

  it('should skip v1 nodes inside <defs>', () => {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.id = 'hidden-node';
    g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    defs.appendChild(g);
    svgElement.appendChild(defs);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(0);
  });

  it('should use non-premium fallback colors for v1 nodes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    // getComputedStyle in jsdom returns empty fill/stroke, so fallbacks apply
    expect(nodes[0].color).toBe('#fff');
    expect(nodes[0].stroke).toBe('#333');
  });

  it('should use premium fallback colors for v1 nodes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, true);

    expect(nodes[0].color).toBe('#f8fafc');
    expect(nodes[0].stroke).toBe('#94a3b8');
  });

  it('should apply cumulative transform to v1 node center coordinates', () => {
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outer.setAttribute('transform', 'translate(200, 100)');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('classGroup');
    g.setAttribute('transform', 'translate(10, 5)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    // getBBox is mocked to return x=-50,y=-25,w=100,h=50
    // getCumulativeTransform(rect, svg) walks: rect → g(+10,+5) → outer(+200,+100) = tx=210, ty=105
    // cx = tx + bbox.x + bbox.w/2 = 210 + (-50) + 50 = 210
    // cy = ty + bbox.y + bbox.h/2 = 105 + (-25) + 25 = 105

    g.appendChild(rect);
    outer.appendChild(g);
    svgElement.appendChild(outer);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].x).toBe(210);
    expect(nodes[0].y).toBe(105);
    expect(nodes[0].width).toBe(100);
    expect(nodes[0].height).toBe(50);
  });

  // ── v2 renderer (g.node) ───────────────────────────────────────────────

  it('should prefer v2 g.node over v1 g.classGroup when both are present', () => {
    // Add a v2 node
    const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gNode.classList.add('node');
    gNode.id = 'classId-Animal-0';
    gNode.setAttribute('transform', 'translate(150, 80)');
    const rectOuter = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectOuter.classList.add('outer');
    gNode.appendChild(rectOuter);
    svgElement.appendChild(gNode);

    // Add a v1 node (should be skipped because v2 nodes were found)
    const gClass = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gClass.classList.add('classGroup');
    gClass.id = 'classGroup-Animal';
    gClass.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    svgElement.appendChild(gClass);

    const nodes = parseClassNodes(svgElement, false);

    // Only the v2 node should be present
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('classId-Animal-0');
  });

  it('should parse v2 g.node with rect.outer and extract center from transform', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-Dog-0';
    g.setAttribute('transform', 'translate(300, 200)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    // getBBox mocked: x=-50,y=-25,w=100,h=50
    // cx = 300 + (-50) + 50 = 300; cy = 200 + (-25) + 25 = 200
    g.appendChild(rect);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('classId-Dog-0');
    expect(nodes[0].x).toBe(300);
    expect(nodes[0].y).toBe(200);
    expect(nodes[0].width).toBe(100);
    expect(nodes[0].height).toBe(50);
  });

  it('should skip v2 g.node elements inside <defs>', () => {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-Hidden-0';
    g.setAttribute('transform', 'translate(100, 100)');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);
    defs.appendChild(g);
    svgElement.appendChild(defs);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(0);
  });

  it('should skip v2 g.node when getBBox returns zero dimensions', () => {
    (SVGElement.prototype as unknown as SVGGraphicsElement).getBBox = () => mockBBox(0, 0, 0, 0);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-Empty-0';
    g.setAttribute('transform', 'translate(100, 100)');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(0);
  });

  it('should not duplicate v2 nodes with the same id', () => {
    for (let i = 0; i < 2; i++) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('node');
      g.id = 'classId-Dup-0';
      g.setAttribute('transform', 'translate(100, 100)');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('outer');
      g.appendChild(rect);
      svgElement.appendChild(g);
    }

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
  });

  it('should set classLines to undefined when g.label is absent in v2 node', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-NoLabel-0';
    g.setAttribute('transform', 'translate(100, 100)');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].classLines).toBeUndefined();
  });

  it('should use text element as fallback label when classLines is empty in v2 node', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-FallbackLabel-0';
    g.setAttribute('transform', 'translate(100, 100)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);

    // No g.label — classLines will be empty; fallback reads from <text>
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'MyClass';
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes[0].label).toBe('MyClass');
    expect(nodes[0].classLines).toBeUndefined();
  });

  it('should insert a divider ClassLine when a line.divider separates foreignObjects', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-WithDivider-0';
    g.setAttribute('transform', 'translate(100, 100)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);

    // Divider line sits at Y = 0 (local coords)
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.classList.add('divider');
    divider.setAttribute('y1', '0');
    divider.setAttribute('y2', '0');
    g.appendChild(divider);

    const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelG.classList.add('label');

    // Title above divider (foY = -10 < dividerY 0)
    const foTitle = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foTitle.classList.add('classTitle');
    foTitle.setAttribute('width', '80');
    foTitle.setAttribute('transform', 'translate(0, -10)');
    const spanTitle = document.createElement('span');
    spanTitle.textContent = 'Animal';
    foTitle.appendChild(spanTitle);

    // Member below divider (foY = 10 > dividerY 0)
    const foMember = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foMember.setAttribute('width', '80');
    foMember.setAttribute('transform', 'translate(0, 10)');
    const spanMember = document.createElement('span');
    spanMember.textContent = '+sound()';
    foMember.appendChild(spanMember);

    labelG.appendChild(foTitle);
    labelG.appendChild(foMember);
    g.appendChild(labelG);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);
    const lines = nodes[0].classLines!;

    expect(lines.some(l => l.divider === true)).toBe(true);
    expect(lines.some(l => l.text === 'Animal')).toBe(true);
    expect(lines.some(l => l.text === '+sound()')).toBe(true);
    // Divider must appear between the title and the member
    const dividerIdx = lines.findIndex(l => l.divider);
    const titleIdx   = lines.findIndex(l => l.text === 'Animal');
    const memberIdx  = lines.findIndex(l => l.text === '+sound()');
    expect(titleIdx).toBeLessThan(dividerIdx);
    expect(dividerIdx).toBeLessThan(memberIdx);
  });

  it('should filter out foreignObjects with zero width from classLines', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-ZeroWidth-0';
    g.setAttribute('transform', 'translate(100, 100)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);

    const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelG.classList.add('label');

    const foValid = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foValid.classList.add('classTitle');
    foValid.setAttribute('width', '80');
    foValid.setAttribute('transform', 'translate(0, -10)');
    const spanValid = document.createElement('span');
    spanValid.textContent = 'Dog';
    foValid.appendChild(spanValid);

    // This foreignObject has width=0 — should be filtered out
    const foZero = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foZero.setAttribute('width', '0');
    foZero.setAttribute('transform', 'translate(0, 5)');
    const spanZero = document.createElement('span');
    spanZero.textContent = 'hidden';
    foZero.appendChild(spanZero);

    labelG.appendChild(foValid);
    labelG.appendChild(foZero);
    g.appendChild(labelG);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);
    const lines = nodes[0].classLines!;

    expect(lines.some(l => l.text === 'hidden')).toBe(false);
    expect(lines.some(l => l.text === 'Dog')).toBe(true);
  });

  it('should sort foreignObjects by foY so classLines appear in visual order', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-Sorted-0';
    g.setAttribute('transform', 'translate(100, 100)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);

    const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelG.classList.add('label');

    // Add member BEFORE title in DOM order, but with a larger foY
    const foMember = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foMember.setAttribute('width', '80');
    foMember.setAttribute('transform', 'translate(0, 10)');
    const spanMember = document.createElement('span');
    spanMember.textContent = '+bark()';
    foMember.appendChild(spanMember);

    const foTitle = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foTitle.classList.add('classTitle');
    foTitle.setAttribute('width', '80');
    foTitle.setAttribute('transform', 'translate(0, -10)');
    const spanTitle = document.createElement('span');
    spanTitle.textContent = 'Labrador';
    foTitle.appendChild(spanTitle);

    labelG.appendChild(foMember); // member appended first in DOM
    labelG.appendChild(foTitle);
    g.appendChild(labelG);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);
    const lines = nodes[0].classLines!;

    const titleIdx  = lines.findIndex(l => l.text === 'Labrador');
    const memberIdx = lines.findIndex(l => l.text === '+bark()');
    expect(titleIdx).toBeLessThan(memberIdx);
  });

  it('should parse classLines from g.label foreignObjects in v2 nodes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.id = 'classId-Cat-0';
    g.setAttribute('transform', 'translate(100, 100)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('outer');
    g.appendChild(rect);

    const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelG.classList.add('label');

    // Title foreign object
    const foTitle = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foTitle.classList.add('classTitle');
    foTitle.setAttribute('width', '80');
    foTitle.setAttribute('transform', 'translate(0, -20)');
    const spanTitle = document.createElement('span');
    spanTitle.textContent = 'Cat';
    foTitle.appendChild(spanTitle);

    // Member foreign object
    const foMember = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foMember.setAttribute('width', '80');
    foMember.setAttribute('transform', 'translate(0, 5)');
    const spanMember = document.createElement('span');
    spanMember.textContent = '+name: string';
    foMember.appendChild(spanMember);

    labelG.appendChild(foTitle);
    labelG.appendChild(foMember);
    g.appendChild(labelG);
    svgElement.appendChild(g);

    const nodes = parseClassNodes(svgElement, false);

    expect(nodes.length).toBe(1);
    expect(nodes[0].classLines).toBeDefined();
    const lines = nodes[0].classLines!;
    expect(lines.some(l => l.text === 'Cat' && l.bold === true)).toBe(true);
    expect(lines.some(l => l.text === '+name: string')).toBe(true);
  });
});
