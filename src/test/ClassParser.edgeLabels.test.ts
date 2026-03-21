import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseClassEdgeLabels } from '../services/ClassParser';

describe('parseClassEdgeLabels', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return empty array for empty SVG', () => {
    expect(parseClassEdgeLabels(svgElement, false)).toEqual([]);
  });

  // ── g.edgeLabel tests ────────────────────────────────────────────────────

  it('should parse g.edgeLabel with foreignObject text', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'extends';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(1);
    expect(labels[0].text).toBe('extends');
    expect(labels[0].x).toBe(100);
    expect(labels[0].y).toBe(44);     // 50 - 6 (nudge)
    expect(labels[0].fontSize).toBe(11);
    expect(labels[0].bold).toBe(false);
    expect(labels[0].align).toBe('center');
  });

  it('should skip g.edgeLabel without transform attribute', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'runs';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeLabel with transform that does not match translate pattern', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'scale(2)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'runs';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeLabel when foreignObject is missing', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeLabel when foreignObject has zero width', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '0');
    fo.textContent = 'runs';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeLabel when foreignObject text is empty', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = '   ';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should use non-premium text color for relationship labels', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'uses';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels[0].color).toBe('#1e293b');
  });

  it('should use premium text color for relationship labels', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'uses';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, true);

    expect(labels[0].color).toBe('#475569');
  });

  // ── g.edgeTerminals tests ────────────────────────────────────────────────

  it('should parse g.edgeTerminals with text content', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.setAttribute('transform', 'translate(80, 120)');
    g.textContent = '1..*';
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(1);
    expect(labels[0].text).toBe('1..*');
    expect(labels[0].x).toBe(80);
    expect(labels[0].y).toBe(120);
    expect(labels[0].fontSize).toBe(10);
    expect(labels[0].bold).toBe(false);
    expect(labels[0].align).toBe('center');
  });

  it('should skip g.edgeTerminals without transform', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.textContent = '1';
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeTerminals with empty text', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.setAttribute('transform', 'translate(80, 120)');
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should use non-premium cardinality color', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.setAttribute('transform', 'translate(80, 120)');
    g.textContent = '1';
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels[0].color).toBe('#334155');
  });

  it('should use premium cardinality color', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.setAttribute('transform', 'translate(80, 120)');
    g.textContent = '1';
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, true);

    expect(labels[0].color).toBe('#64748b');
  });

  it('should skip g.edgeTerminals with non-translate transform', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeTerminals');
    g.setAttribute('transform', 'scale(2)');
    g.textContent = '1';
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should skip g.edgeLabel when foreignObject has no width attribute', () => {
    // querySelector('foreignObject[width]') requires the attribute to exist
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edgeLabel');
    g.setAttribute('transform', 'translate(100, 50)');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    // no 'width' attribute set — selector won't match
    fo.textContent = 'runs';

    g.appendChild(fo);
    svgElement.appendChild(g);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(0);
  });

  it('should return both edgeLabel and edgeTerminals in the same call', () => {
    const gLabel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gLabel.classList.add('edgeLabel');
    gLabel.setAttribute('transform', 'translate(100, 50)');
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '60');
    fo.textContent = 'extends';
    gLabel.appendChild(fo);

    const gTerminals = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gTerminals.classList.add('edgeTerminals');
    gTerminals.setAttribute('transform', 'translate(20, 30)');
    gTerminals.textContent = '1';

    svgElement.appendChild(gLabel);
    svgElement.appendChild(gTerminals);

    const labels = parseClassEdgeLabels(svgElement, false);

    expect(labels.length).toBe(2);
    expect(labels.some(l => l.text === 'extends')).toBe(true);
    expect(labels.some(l => l.text === '1')).toBe(true);
  });
});
