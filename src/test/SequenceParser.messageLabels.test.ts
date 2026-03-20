import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSequenceMessageLabels } from '../services/SequenceParser';

describe('parseSequenceMessageLabels', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse message text labels', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('messageText');
    text.setAttribute('x', '100');
    text.setAttribute('y', '50');
    text.textContent = 'Hello World';

    svgElement.appendChild(text);

    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels.length).toBe(1);
    expect(labels[0]).toMatchObject({
      x: 100,
      y: 50,
      text: 'Hello World',
      fontSize: 13,
      bold: false,
      color: '#333',
      align: 'center',
    });
  });

  it('should apply dy attribute to y position', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('messageText');
    text.setAttribute('x', '100');
    text.setAttribute('y', '50');
    text.setAttribute('dy', '10');
    text.textContent = 'Message';

    svgElement.appendChild(text);

    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels.length).toBe(1);
    expect(labels[0].y).toBe(60); // 50 + 10
  });

  it('should skip labels with empty text', () => {
    const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text1.classList.add('messageText');
    text1.setAttribute('x', '100');
    text1.setAttribute('y', '50');
    text1.textContent = '';

    const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text2.classList.add('messageText');
    text2.setAttribute('x', '200');
    text2.setAttribute('y', '100');
    text2.textContent = '   ';

    svgElement.appendChild(text1);
    svgElement.appendChild(text2);

    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels.length).toBe(0);
  });

  it('should handle missing attributes', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('messageText');
    text.textContent = 'No attributes';

    svgElement.appendChild(text);

    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels.length).toBe(1);
    expect(labels[0].x).toBe(0);
    expect(labels[0].y).toBe(0);
  });

  it('should return empty array for empty SVG', () => {
    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels).toEqual([]);
  });

  it('should apply transforms correctly', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(50, 25)');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('messageText');
    text.setAttribute('x', '100');
    text.setAttribute('y', '50');
    text.textContent = 'Transformed';

    g.appendChild(text);
    svgElement.appendChild(g);

    const labels = parseSequenceMessageLabels(svgElement);

    expect(labels.length).toBe(1);
    expect(labels[0].x).toBe(150); // 50 + 100
    expect(labels[0].y).toBe(75);  // 25 + 50
  });
});
