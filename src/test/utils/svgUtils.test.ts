import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCumulativeTransform } from '../../services/svgUtils';

describe('getCumulativeTransform', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return {x:0, y:0} when element has no ancestors with transform', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    svg.appendChild(el);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 0, y: 0 });
  });

  it('should accumulate a single translate(x, y)', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(100, 50)');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 100, y: 50 });
  });

  it('should accumulate nested translates from multiple ancestors', () => {
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outer.setAttribute('transform', 'translate(200, 100)');

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.setAttribute('transform', 'translate(10, 5)');

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    inner.appendChild(el);
    outer.appendChild(inner);
    svg.appendChild(outer);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 210, y: 105 });
  });

  it('should default Y to 0 for translate(x) with no Y argument', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(30)');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 30, y: 0 });
  });

  it('should handle negative translate values', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(-40, -20)');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: -40, y: -20 });
  });

  it('should ignore non-translate transforms (scale, rotate)', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'scale(2)');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 0, y: 0 });
  });

  it('should stop accumulating at the stopAt element (not include its transform)', () => {
    const boundary = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    // transform on boundary should NOT be counted — we stop before reading it
    boundary.setAttribute('transform', 'translate(999, 999)');

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.setAttribute('transform', 'translate(10, 5)');

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    inner.appendChild(el);
    boundary.appendChild(inner);
    svg.appendChild(boundary);

    // Stop at boundary, not at svg — only inner's transform should be summed
    expect(getCumulativeTransform(el, boundary)).toEqual({ x: 10, y: 5 });
  });

  it('should handle whitespace in translate arguments', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate( 8 , 12 )');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeTransform(el, svg)).toEqual({ x: 8, y: 12 });
  });

  it('should handle float translate values', () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(3.5, 7.25)');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    g.appendChild(el);
    svg.appendChild(g);

    const result = getCumulativeTransform(el, svg);
    expect(result.x).toBeCloseTo(3.5);
    expect(result.y).toBeCloseTo(7.25);
  });

  // Mermaid v11 composite-state sub-graphs use nested <svg x y> for positioning
  it('accumulates x/y attributes on nested <svg> elements', () => {
    const NS = 'http://www.w3.org/2000/svg';
    const outerG = document.createElementNS(NS, 'g');
    outerG.setAttribute('transform', 'translate(50, 30)');

    const innerSvg = document.createElementNS(NS, 'svg');
    innerSvg.setAttribute('x', '20');
    innerSvg.setAttribute('y', '10');

    const el = document.createElementNS(NS, 'path');
    innerSvg.appendChild(el);
    outerG.appendChild(innerSvg);
    svg.appendChild(outerG);

    // Expected: outerG translate (50,30) + innerSvg x/y (20,10) = (70, 40)
    expect(getCumulativeTransform(el, svg)).toEqual({ x: 70, y: 40 });
  });
});
