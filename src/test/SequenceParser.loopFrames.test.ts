import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSequenceLoopFrames } from '../services/SequenceParser';

describe('parseSequenceLoopFrames', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse loop frames with labels', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200');
    line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10');
    line2.setAttribute('y1', '100');
    line2.setAttribute('x2', '200');
    line2.setAttribute('y2', '100');

    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.classList.add('labelText');
    labelText.setAttribute('x', '15');
    labelText.setAttribute('y', '30');
    labelText.textContent = 'loop';

    const loopText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    loopText.classList.add('loopText');
    loopText.setAttribute('x', '50');
    loopText.setAttribute('y', '35');
    loopText.textContent = '[condition]';

    g.appendChild(line1);
    g.appendChild(line2);
    g.appendChild(labelText);
    g.appendChild(loopText);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0]).toMatchObject({
      type: 'cluster',
      shape: 'rect',
      width: 190,
      height: 80,
      color: 'rgba(236,236,255,0.15)',
      stroke: '#9370DB',
    });

    expect(result.labels.length).toBe(2);
    expect(result.labels[0]).toMatchObject({
      text: 'loop',
      fontSize: 12,
      bold: true,
      color: '#5b21b6',
    });
    expect(result.labels[1]).toMatchObject({
      text: '[condition]',
      fontSize: 13,
      bold: false,
      color: '#374151',
    });
  });

  it('should handle loop frames without labels', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200');
    line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10');
    line2.setAttribute('y1', '100');
    line2.setAttribute('x2', '200');
    line2.setAttribute('y2', '100');

    g.appendChild(line1);
    g.appendChild(line2);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes.length).toBe(1);
    expect(result.labels.length).toBe(0);
  });

  it('should skip frames with less than 2 loop lines', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200');
    line1.setAttribute('y2', '20');

    g.appendChild(line1);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes.length).toBe(0);
    expect(result.labels.length).toBe(0);
  });

  it('should skip frames with invalid dimensions', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '10');
    line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10');
    line2.setAttribute('y1', '20');
    line2.setAttribute('x2', '10');
    line2.setAttribute('y2', '20');

    g.appendChild(line1);
    g.appendChild(line2);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes.length).toBe(0);
  });

  it('should return empty arrays for empty SVG', () => {
    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes).toEqual([]);
    expect(result.labels).toEqual([]);
  });

  it('should use alt frame colors for alt/opt/par frame types', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10'); line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200'); line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10'); line2.setAttribute('y1', '100');
    line2.setAttribute('x2', '200'); line2.setAttribute('y2', '100');

    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.classList.add('labelText');
    labelText.setAttribute('x', '15'); labelText.setAttribute('y', '30');
    labelText.textContent = 'alt';

    g.appendChild(line1);
    g.appendChild(line2);
    g.appendChild(labelText);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.nodes[0].color).toBe('rgba(255,245,200,0.18)');
    expect(result.nodes[0].stroke).toBe('#d97706');
    expect(result.labels[0].color).toBe('#92400e');
  });

  it('should emit dividerEdges for internal horizontal lines', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // top border
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10'); line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200'); line1.setAttribute('y2', '20');

    // internal divider
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10'); line2.setAttribute('y1', '60');
    line2.setAttribute('x2', '200'); line2.setAttribute('y2', '60');

    // bottom border
    const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line3.classList.add('loopLine');
    line3.setAttribute('x1', '10'); line3.setAttribute('y1', '100');
    line3.setAttribute('x2', '200'); line3.setAttribute('y2', '100');

    g.appendChild(line1);
    g.appendChild(line2);
    g.appendChild(line3);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.dividerEdges.length).toBe(1);
    expect(result.dividerEdges[0].type).toBe('structural');
    expect(result.dividerEdges[0].dash).toEqual([6, 3]);
    expect(result.dividerEdges[0].pathD).toBe('M 10 60 L 200 60');
  });

  it('should parse loopText tspan with x and dy attributes', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10'); line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200'); line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10'); line2.setAttribute('y1', '100');
    line2.setAttribute('x2', '200'); line2.setAttribute('y2', '100');

    const loopText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    loopText.classList.add('loopText');
    loopText.setAttribute('x', '50'); loopText.setAttribute('y', '35');

    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', '80');
    tspan.setAttribute('dy', '15');
    tspan.textContent = 'condition text';

    loopText.appendChild(tspan);
    g.appendChild(line1);
    g.appendChild(line2);
    g.appendChild(loopText);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.labels.length).toBe(1);
    // x comes from tspan x (80), y = baseY(35) + dy(15) = 50
    expect(result.labels[0].x).toBe(80);
    expect(result.labels[0].y).toBe(50);
    expect(result.labels[0].text).toBe('condition text');
  });

  it('should handle loopText with tspan elements', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.classList.add('loopLine');
    line1.setAttribute('x1', '10');
    line1.setAttribute('y1', '20');
    line1.setAttribute('x2', '200');
    line1.setAttribute('y2', '20');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.classList.add('loopLine');
    line2.setAttribute('x1', '10');
    line2.setAttribute('y1', '100');
    line2.setAttribute('x2', '200');
    line2.setAttribute('y2', '100');

    const loopText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    loopText.classList.add('loopText');
    loopText.setAttribute('x', '50');
    loopText.setAttribute('y', '35');

    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.textContent = 'tspan text';

    loopText.appendChild(tspan);
    g.appendChild(line1);
    g.appendChild(line2);
    g.appendChild(loopText);
    svgElement.appendChild(g);

    const result = parseSequenceLoopFrames(svgElement);

    expect(result.labels.length).toBe(1);
    expect(result.labels[0].text).toBe('tspan text');
  });
});
