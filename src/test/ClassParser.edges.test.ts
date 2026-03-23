import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseClassEdges } from '../services/ClassParser';
import { resetIdCounter } from '../utils/parser-base';

describe('parseClassEdges', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    resetIdCounter();
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return empty array for empty SVG', () => {
    expect(parseClassEdges(svgElement, false)).toEqual([]);
  });

  it('should parse path.relation into an edge', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 10 20 L 200 200');
    expect(edges[0].type).toBe('link');
  });

  it('should parse line.relation and convert to M/L path', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('relation');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '20');
    line.setAttribute('x2', '100');
    line.setAttribute('y2', '80');
    svgElement.appendChild(line);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 10 20 L 100 80');
  });

  it('should apply cumulative transform when converting line.relation', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(50, 30)');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('relation');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', '10');
    line.setAttribute('x2', '90');
    line.setAttribute('y2', '50');

    g.appendChild(line);
    svgElement.appendChild(g);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 60 40 L 140 80');
  });

  it('should use non-premium stroke color by default', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].stroke).toBe('#333');
  });

  it('should use premium stroke color when isPremium is true', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, true);

    expect(edges[0].stroke).toBe('#94a3b8');
  });

  it('should detect extension arrow from marker-end', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#classDiagram-extensionEnd)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('extension');
    expect(edges[0].hasArrow).toBe(true);
  });

  it('should detect composition arrow from marker-start', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-start', 'url(#classDiagram-compositionStart)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowStart).toBe('composition');
    expect(edges[0].hasArrow).toBe(true);
  });

  it('should detect aggregation arrow from marker-end', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#classDiagram-aggregationEnd)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('aggregation');
  });

  it('should detect dependency arrow from marker-end', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#classDiagram-dependencyEnd)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('dependency');
  });

  it('should fall back to default marker for unknown classDiagram marker name', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#classDiagram-unknownEnd)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('default');
  });

  it('should use default marker when marker URL contains "marker" but no classDiagram pattern', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#arrowmarker-1)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('default');
    expect(edges[0].hasArrow).toBe(true);
  });

  it('should set hasArrow false when no marker attributes', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].hasArrow).toBe(false);
    expect(edges[0].arrowEnd).toBeUndefined();
    expect(edges[0].arrowStart).toBeUndefined();
  });

  it('should detect dashed line from class name "dashed"', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.classList.add('dashed');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].dash).toEqual([6, 4]);
  });

  it('should detect dotted line from class name "dotted"', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.classList.add('dotted');
    path.setAttribute('d', 'M 10 20 L 200 200');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].dash).toEqual([2, 2]);
  });

  it('should skip path with d attribute length <= 10', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 1 2 L');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(0);
  });

  it('should skip duplicate paths (same d value)', () => {
    const d = 'M 10 20 L 200 200';
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.classList.add('relation');
    path1.setAttribute('d', d);

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.classList.add('relation');
    path2.setAttribute('d', d);

    svgElement.appendChild(path1);
    svgElement.appendChild(path2);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(1);
  });

  it('should skip paths inside <defs>', () => {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    defs.appendChild(path);
    svgElement.appendChild(defs);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(0);
  });

  it('should skip paths inside <marker>', () => {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    marker.appendChild(path);
    defs.appendChild(marker);
    svgElement.appendChild(defs);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(0);
  });

  it('should not include arrowEnd in result when arrowEnd is none', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    // no marker-end set → arrowEnd should not be present on the object
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBeUndefined();
  });

  it('should detect dash pattern from strokeDasharray inline style', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    // inline style is picked up by getComputedStyle in jsdom
    path.style.strokeDasharray = '8, 4';
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].dash).toEqual([8, 4]);
  });

  it('should set both arrowEnd and arrowStart when both markers are present', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    path.setAttribute('d', 'M 10 20 L 200 200');
    path.setAttribute('marker-end', 'url(#classDiagram-extensionEnd)');
    path.setAttribute('marker-start', 'url(#classDiagram-compositionStart)');
    svgElement.appendChild(path);

    const edges = parseClassEdges(svgElement, false);

    expect(edges[0].arrowEnd).toBe('extension');
    expect(edges[0].arrowStart).toBe('composition');
    expect(edges[0].hasArrow).toBe(true);
  });

  it('should apply parent translate transform to path.relation coordinates', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(100, 50)');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('relation');
    // raw "10,20" and "200,80" should become "110,70" and "300,130"
    path.setAttribute('d', 'M 10,20 L 200,80');

    g.appendChild(path);
    svgElement.appendChild(g);

    const edges = parseClassEdges(svgElement, false);

    expect(edges.length).toBe(1);
    expect(edges[0].pathD).toBe('M 110,70 L 300,130');
  });
});
