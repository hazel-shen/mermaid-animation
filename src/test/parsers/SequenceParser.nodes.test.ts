import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSequenceNodes } from '../../services/SequenceParser';
import { resetIdCounter } from '../../utils/parser-base';

describe('parseSequenceNodes', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse actor rectangles with labels', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('actor');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '20');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '50');
    rect.setAttribute('name', 'Alice');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Alice';

    g.appendChild(rect);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      label: 'Alice',
      type: 'actor',
      shape: 'roundRect',
      x: 60, // 10 + 100/2
      y: 45, // 20 + 50/2
      width: 100,
      height: 50,
    });
  });

  it('should parse actor-man elements', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('actor-man');
    g.setAttribute('name', 'Bob');
    g.id = 'actor-bob';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '15');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Bob';

    g.appendChild(circle);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      id: 'actor-bob',
      label: 'Bob',
      type: 'actor',
      shape: 'circle',
      color: '#ECECFF',
      stroke: '#9370DB',
    });
  });

  it('should parse note boxes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('note');
    rect.setAttribute('x', '50');
    rect.setAttribute('y', '100');
    rect.setAttribute('width', '150');
    rect.setAttribute('height', '80');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Important note';

    g.appendChild(rect);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      label: 'Important note',
      type: 'note',
      shape: 'note',
      x: 125, // 50 + 150/2
      y: 140, // 100 + 80/2
      width: 150,
      height: 80,
      color: '#fff5ad',
      stroke: '#aaaa33',
    });
  });

  it('should parse background rect blocks', () => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '200');
    rect.setAttribute('height', '300');
    rect.setAttribute('fill', 'rgba(240,240,240,0.5)');

    svgElement.appendChild(rect);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      type: 'cluster',
      shape: 'rect',
      x: 100,
      y: 150,
      width: 200,
      height: 300,
      color: 'rgba(240,240,240,0.5)',
    });
  });

  it('should skip duplicate nodes at the same position', () => {
    const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect1.classList.add('actor');
    rect1.setAttribute('x', '10');
    rect1.setAttribute('y', '20');
    rect1.setAttribute('width', '100');
    rect1.setAttribute('height', '50');

    const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect2.classList.add('actor');
    rect2.setAttribute('x', '10');
    rect2.setAttribute('y', '20');
    rect2.setAttribute('width', '100');
    rect2.setAttribute('height', '50');

    svgElement.appendChild(rect1);
    svgElement.appendChild(rect2);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
  });

  it('should skip elements with invalid dimensions', () => {
    const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect1.classList.add('actor');
    rect1.setAttribute('x', '10');
    rect1.setAttribute('y', '20');
    rect1.setAttribute('width', '0');
    rect1.setAttribute('height', '50');

    const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect2.classList.add('note');
    rect2.setAttribute('x', '10');
    rect2.setAttribute('y', '20');
    rect2.setAttribute('width', '100');
    rect2.setAttribute('height', '-10');

    svgElement.appendChild(rect1);
    svgElement.appendChild(rect2);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(0);
  });

  it('should fall back to name attribute when parent has no <text>', () => {
    // parentLabel(rect) returns '' → falls back to rect.getAttribute('name')
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('actor');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '50');
    rect.setAttribute('name', 'Charlie');
    svgElement.appendChild(rect); // no parent <g> with <text>

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0].label).toBe('Charlie');
  });

  it('should parse activation bars', () => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'activation0');
    rect.setAttribute('x', '50');
    rect.setAttribute('y', '100');
    rect.setAttribute('width', '20');
    rect.setAttribute('height', '60');
    svgElement.appendChild(rect);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      type: 'node',
      shape: 'rect',
      x: 60,
      y: 130,
      width: 20,
      height: 60,
      color: 'rgba(167, 139, 250, 0.25)',
      stroke: '#7c3aed',
    });
  });

  it('should return empty array for empty SVG', () => {
    const nodes = parseSequenceNodes(svgElement);

    expect(nodes).toEqual([]);
  });

  it('should handle missing attributes gracefully', () => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('actor');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '50');

    svgElement.appendChild(rect);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0].x).toBe(50);
    expect(nodes[0].y).toBe(25);
  });

  it('should apply transforms correctly', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(100, 50)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('actor');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '20');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '50');

    g.appendChild(rect);
    svgElement.appendChild(g);

    const nodes = parseSequenceNodes(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0].x).toBe(160); // 100 + 10 + 100/2
    expect(nodes[0].y).toBe(95);  // 50 + 20 + 50/2
  });
});
