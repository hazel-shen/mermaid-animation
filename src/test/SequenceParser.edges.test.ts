import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSequenceEdges } from '../services/SequenceParser';

describe('parseSequenceEdges', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should parse line elements as links', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({
      pathD: 'M 10 20 L 100 50',
      stroke: '#333',
      type: 'link',
      hasArrow: true,
    });
  });

  it('should parse path elements as links', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('messageLine0');
    path.setAttribute('d', 'M 10 20 L 100 50');

    svgElement.appendChild(path);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 10 20 L 100 50');
  });

  it('should use premium stroke color when isPremium is true', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, true);

    expect(edges.length).toBe(1);
    expect(edges[0].stroke).toBe('#94a3b8');
  });

  it('should parse dashed lines', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine1');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');
    line.style.strokeDasharray = '5, 3';

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].dash).toEqual([5, 3]);
  });

  it('should detect arrows from marker-end attribute', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('flowchart-link');
    path.setAttribute('d', 'M 10 20 L 100 50');
    path.setAttribute('marker-end', 'url(#arrowhead)');

    svgElement.appendChild(path);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].hasArrow).toBe(true);
  });

  it('should skip loop lines', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('loopLine');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '20');

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(0);
  });

  it('should skip short path strings', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('messageLine0');
    // length <= 4 so it gets filtered out
    path.setAttribute('d', 'M 0');

    svgElement.appendChild(path);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(0);
  });

  it('should detect vertical lines as structural', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '50');
    line.setAttribute('y1', '10');
    line.setAttribute('x2', '50');
    line.setAttribute('y2', '200');

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe('structural');
  });

  it('should not deduplicate identical lines in fallback scan', () => {
    // The fallback scan has no dedup — two identical structural lines produce two edges
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '50');
    line1.setAttribute('y1', '10');
    line1.setAttribute('x2', '50');
    line1.setAttribute('y2', '200');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '50');
    line2.setAttribute('y1', '10');
    line2.setAttribute('x2', '50');
    line2.setAttribute('y2', '200');

    svgElement.appendChild(line1);
    svgElement.appendChild(line2);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(2);
    expect(edges.every(e => e.type === 'structural')).toBe(true);
  });

  it('should skip lines with sibling path elements', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('messageLine0');
    path.setAttribute('d', 'M 10 20 L 100 50');

    g.appendChild(line);
    g.appendChild(path);
    svgElement.appendChild(g);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 10 20 L 100 50');
  });

  it('should set noSnap=true on messageLine0 link edges', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');
    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].noSnap).toBe(true);
  });

  it('should set noSnap=true on path-based message links', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('messageLine0');
    path.setAttribute('d', 'M 10 20 L 100 50');
    svgElement.appendChild(path);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].noSnap).toBe(true);
  });

  it('should NOT set noSnap on structural (actor lifeline) edges', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('actor-line');
    line.setAttribute('x1', '50');
    line.setAttribute('y1', '10');
    line.setAttribute('x2', '50');
    line.setAttribute('y2', '200');
    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe('structural');
    expect(edges[0].noSnap).toBeFalsy();
  });

  it('should return empty array for empty SVG', () => {
    const edges = parseSequenceEdges(svgElement, false);

    expect(edges).toEqual([]);
  });

  it('should parse fallback horizontal line not matched by class selectors', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    // No class — will be caught by the fallback scan
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '50');
    line.setAttribute('x2', '200');
    line.setAttribute('y2', '50');

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe('link');
    expect(edges[0].pathD).toBe('M 10 50 L 200 50');
  });

  it('should handle strokeDasharray none', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '50');
    line.style.strokeDasharray = 'none';

    svgElement.appendChild(line);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].dash).toBeUndefined();
  });

  it('should apply transforms to line elements', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(100, 50)');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('messageLine0');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '90');
    line.setAttribute('y2', '40');

    g.appendChild(line);
    svgElement.appendChild(g);

    const edges = parseSequenceEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 110 70 L 190 90');
  });
});
