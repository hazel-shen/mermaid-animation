import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCumulativeTransform, getCumulativeMatrix } from '../../services/svgUtils';

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

describe('getCumulativeMatrix', () => {
  const NS = 'http://www.w3.org/2000/svg';
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = document.createElementNS(NS, 'svg');
    document.body.appendChild(svg);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const makeG = (transform?: string) => {
    const g = document.createElementNS(NS, 'g');
    if (transform) g.setAttribute('transform', transform);
    return g;
  };

  it('returns identity when no ancestor has a transform', () => {
    const el = document.createElementNS(NS, 'path');
    svg.appendChild(el);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });
  });

  it('extracts translation from a single translate(x, y)', () => {
    const g = makeG('translate(100, 50)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 100, ty: 50, sx: 1, sy: 1 });
  });

  it('defaults Y to 0 for translate(x) with no Y argument', () => {
    const g = makeG('translate(30)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 30, ty: 0, sx: 1, sy: 1 });
  });

  it('extracts uniform scale from a single scale(s)', () => {
    const g = makeG('scale(2)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 0, ty: 0, sx: 2, sy: 2 });
  });

  it('supports non-uniform scale(sx, sy)', () => {
    const g = makeG('scale(2, 3)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 0, ty: 0, sx: 2, sy: 3 });
  });

  it('extracts scale and translation from matrix(a, b, c, d, e, f)', () => {
    const g = makeG('matrix(2, 0, 0, 3, 10, 20)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 10, ty: 20, sx: 2, sy: 3 });
  });

  it('accumulates nested translates from multiple ancestors', () => {
    const outer = makeG('translate(200, 100)');
    const inner = makeG('translate(10, 5)');
    const el = document.createElementNS(NS, 'path');
    inner.appendChild(el);
    outer.appendChild(inner);
    svg.appendChild(outer);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 210, ty: 105, sx: 1, sy: 1 });
  });

  it('multiplies nested scales from multiple ancestors', () => {
    const outer = makeG('scale(2)');
    const inner = makeG('scale(3)');
    const el = document.createElementNS(NS, 'path');
    inner.appendChild(el);
    outer.appendChild(inner);
    svg.appendChild(outer);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 0, ty: 0, sx: 6, sy: 6 });
  });

  it('handles float and negative values', () => {
    const g = makeG('translate(-40.5, 7.25)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    const result = getCumulativeMatrix(el, svg);
    expect(result.tx).toBeCloseTo(-40.5);
    expect(result.ty).toBeCloseTo(7.25);
  });

  it('skips ancestors without a transform attribute', () => {
    const outer = makeG('translate(100, 50)');
    const plain = makeG(); // no transform in between
    const el = document.createElementNS(NS, 'path');
    plain.appendChild(el);
    outer.appendChild(plain);
    svg.appendChild(outer);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 100, ty: 50, sx: 1, sy: 1 });
  });

  it('stops at the stopAt element (its transform not included)', () => {
    const boundary = makeG('translate(999, 999)');
    const inner = makeG('translate(10, 5)');
    const el = document.createElementNS(NS, 'path');
    inner.appendChild(el);
    boundary.appendChild(inner);
    svg.appendChild(boundary);

    expect(getCumulativeMatrix(el, boundary)).toEqual({ tx: 10, ty: 5, sx: 1, sy: 1 });
  });

  it('ignores rotate transforms (only matrix/translate/scale are handled)', () => {
    const g = makeG('rotate(45)');
    const el = document.createElementNS(NS, 'path');
    g.appendChild(el);
    svg.appendChild(g);

    expect(getCumulativeMatrix(el, svg)).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });
  });
});
