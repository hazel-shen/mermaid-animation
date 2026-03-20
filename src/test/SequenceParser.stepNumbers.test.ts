import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSequenceStepNumbers } from '../services/SequenceParser';

describe('parseSequenceStepNumbers', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse text.sequenceNumber elements', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('sequenceNumber');
    text.setAttribute('x', '50');
    text.setAttribute('y', '80');
    text.textContent = '1';

    svgElement.appendChild(text);

    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      label: '1',
      type: 'node',
      shape: 'circle',
      x: 50,
      y: 80,
      width: 20,
      height: 20,
      color: '#1e293b',
      stroke: '#1e293b',
    });
  });

  it('should skip text.sequenceNumber with empty text', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('sequenceNumber');
    text.setAttribute('x', '50');
    text.setAttribute('y', '80');
    text.textContent = '';

    svgElement.appendChild(text);

    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes.length).toBe(0);
  });

  it('should parse circle+text combo inside a g element', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '30');
    circle.setAttribute('cy', '40');
    circle.setAttribute('r', '10');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = '2';

    g.appendChild(circle);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes.length).toBe(1);
    expect(nodes[0]).toMatchObject({
      label: '2',
      type: 'node',
      shape: 'circle',
      x: 30,
      y: 40,
      width: 20,
      height: 20,
    });
  });

  it('should skip circle+text combo when text is not a number', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '30');
    circle.setAttribute('cy', '40');
    circle.setAttribute('r', '10');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Alice';

    g.appendChild(circle);
    g.appendChild(text);
    svgElement.appendChild(g);

    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes.length).toBe(0);
  });

  it('should not duplicate when text.sequenceNumber and circle+text overlap at same position', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('sequenceNumber');
    text.setAttribute('x', '30');
    text.setAttribute('y', '40');
    text.textContent = '3';
    svgElement.appendChild(text);

    // circle+text combo at the same position
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '30');
    circle.setAttribute('cy', '40');
    circle.setAttribute('r', '10');
    const comboText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    comboText.textContent = '3';
    g.appendChild(circle);
    g.appendChild(comboText);
    svgElement.appendChild(g);

    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes.length).toBe(1);
  });

  it('should return empty array for empty SVG', () => {
    const nodes = parseSequenceStepNumbers(svgElement);

    expect(nodes).toEqual([]);
  });
});
