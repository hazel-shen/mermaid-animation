import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractComputedColors,
  extractComputedStroke,
  lineToPathD,
  computedFill,
  computedStroke,
  rectCenter,
  parentLabel,
  extractEdgeStyle,
  nextId,
  resetIdCounter,
} from '../utils/parser-base';

const NS = 'http://www.w3.org/2000/svg';
const el = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T;
const mockBBox = (x = 0, y = 0, w = 100, h = 50): DOMRect =>
  ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect);

// ─────────────────────────────────────────────────────────────────────────────

describe('extractComputedColors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns defaults when computed fill and stroke are empty (jsdom behaviour)', () => {
    const rect = el<SVGRectElement>('rect');
    const result = extractComputedColors(rect, { color: '#default-fill', stroke: '#default-stroke' });
    expect(result.color).toBe('#default-fill');
    expect(result.stroke).toBe('#default-stroke');
  });

  it('returns defaults when computed fill and stroke are "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none',
      stroke: 'none',
    } as unknown as CSSStyleDeclaration);
    const rect = el<SVGRectElement>('rect');
    const result = extractComputedColors(rect, { color: '#fc', stroke: '#sc' });
    expect(result.color).toBe('#fc');
    expect(result.stroke).toBe('#sc');
  });

  it('returns computed fill when it is a valid colour', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'rgb(255, 0, 0)',
      stroke: 'none',
    } as unknown as CSSStyleDeclaration);
    const rect = el<SVGRectElement>('rect');
    const { color } = extractComputedColors(rect, { color: '#fallback', stroke: '#fs' });
    expect(color).toBe('rgb(255, 0, 0)');
  });

  it('returns computed stroke when it is a valid colour', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: 'none',
      stroke: 'rgb(0, 0, 255)',
    } as unknown as CSSStyleDeclaration);
    const rect = el<SVGRectElement>('rect');
    const { stroke } = extractComputedColors(rect, { color: '#fc', stroke: '#fallback' });
    expect(stroke).toBe('rgb(0, 0, 255)');
  });

  it('returns both computed values when both are valid', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fill: '#aabbcc',
      stroke: '#112233',
    } as unknown as CSSStyleDeclaration);
    const rect = el<SVGRectElement>('rect');
    const result = extractComputedColors(rect, { color: '#fc', stroke: '#sc' });
    expect(result.color).toBe('#aabbcc');
    expect(result.stroke).toBe('#112233');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extractComputedStroke', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns fallback when computed stroke is empty (jsdom behaviour)', () => {
    const path = el<SVGPathElement>('path');
    expect(extractComputedStroke(path, '#fallback')).toBe('#fallback');
  });

  it('returns fallback when computed stroke is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'none',
    } as unknown as CSSStyleDeclaration);
    const path = el<SVGPathElement>('path');
    expect(extractComputedStroke(path, '#fallback')).toBe('#fallback');
  });

  it('returns computed stroke when it is a valid colour', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'rgb(100, 200, 50)',
    } as unknown as CSSStyleDeclaration);
    const path = el<SVGPathElement>('path');
    expect(extractComputedStroke(path, '#fallback')).toBe('rgb(100, 200, 50)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('lineToPathD', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS(NS, 'svg') as SVGSVGElement;
    document.body.appendChild(svgElement);
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('builds M/L path from line attributes with no transform', () => {
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '10'); line.setAttribute('y1', '20');
    line.setAttribute('x2', '90'); line.setAttribute('y2', '80');
    svgElement.appendChild(line);
    expect(lineToPathD(line, svgElement)).toBe('M 10 20 L 90 80');
  });

  it('defaults missing attributes to 0', () => {
    const line = el<SVGLineElement>('line');
    svgElement.appendChild(line);
    expect(lineToPathD(line, svgElement)).toBe('M 0 0 L 0 0');
  });

  it('applies cumulative translate transform from parent', () => {
    const g = el('g'); g.setAttribute('transform', 'translate(100, 50)');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '40'); line.setAttribute('y2', '0');
    g.appendChild(line); svgElement.appendChild(g);
    expect(lineToPathD(line, svgElement)).toBe('M 100 50 L 140 50');
  });

  it('accumulates nested translate transforms', () => {
    const outer = el('g'); outer.setAttribute('transform', 'translate(10, 20)');
    const inner = el('g'); inner.setAttribute('transform', 'translate(5, 5)');
    const line = el<SVGLineElement>('line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '30');
    inner.appendChild(line); outer.appendChild(inner); svgElement.appendChild(outer);
    expect(lineToPathD(line, svgElement)).toBe('M 15 25 L 15 55');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('computedFill', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns null when computed style is empty (jsdom default)', () => {
    expect(computedFill(el('rect'))).toBeNull();
  });

  it('returns null when computed fill is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'none' } as unknown as CSSStyleDeclaration);
    expect(computedFill(el('rect'))).toBeNull();
  });

  it('returns null when computed fill is rgba(0,0,0,0)', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'rgba(0, 0, 0, 0)' } as unknown as CSSStyleDeclaration);
    expect(computedFill(el('rect'))).toBeNull();
  });

  it('returns computed fill when it is a real colour', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fill: 'rgb(10, 20, 30)' } as unknown as CSSStyleDeclaration);
    expect(computedFill(el('rect'))).toBe('rgb(10, 20, 30)');
  });

  it('falls back to fill attribute when computed is empty', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('fill', '#abc');
    expect(computedFill(rect)).toBe('#abc');
  });

  it('returns null when attribute is also "none"', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('fill', 'none');
    expect(computedFill(rect)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('computedStroke', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns null when computed style is empty (jsdom default)', () => {
    expect(computedStroke(el('rect'))).toBeNull();
  });

  it('returns null when computed stroke is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: 'none' } as unknown as CSSStyleDeclaration);
    expect(computedStroke(el('rect'))).toBeNull();
  });

  it('returns null when computed stroke is rgba(0,0,0,0)', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: 'rgba(0, 0, 0, 0)' } as unknown as CSSStyleDeclaration);
    expect(computedStroke(el('rect'))).toBeNull();
  });

  it('returns computed stroke when it is a real colour', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ stroke: 'rgb(1, 2, 3)' } as unknown as CSSStyleDeclaration);
    expect(computedStroke(el('rect'))).toBe('rgb(1, 2, 3)');
  });

  it('falls back to stroke attribute when computed is empty', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('stroke', '#ff0000');
    expect(computedStroke(rect)).toBe('#ff0000');
  });

  it('returns null when attribute is also "none"', () => {
    const rect = el<SVGRectElement>('rect');
    rect.setAttribute('stroke', 'none');
    expect(computedStroke(rect)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('rectCenter', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS(NS, 'svg') as SVGSVGElement;
    document.body.appendChild(svgElement);
  });

  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('returns correct centre and dimensions with no transform', () => {
    const rect = el<SVGRectElement>('rect');
    svgElement.appendChild(rect);
    rect.getBBox = () => mockBBox(10, 20, 80, 40);
    const result = rectCenter(rect as unknown as SVGGraphicsElement, svgElement);
    expect(result).toEqual({ cx: 50, cy: 40, width: 80, height: 40 });
  });

  it('applies cumulative translate transform', () => {
    const g = el('g'); g.setAttribute('transform', 'translate(100, 50)');
    const rect = el<SVGRectElement>('rect');
    g.appendChild(rect); svgElement.appendChild(g);
    rect.getBBox = () => mockBBox(0, 0, 60, 30);
    const result = rectCenter(rect as unknown as SVGGraphicsElement, svgElement);
    expect(result).toEqual({ cx: 130, cy: 65, width: 60, height: 30 });
  });

  it('returns null when getBBox throws', () => {
    const rect = el<SVGRectElement>('rect');
    svgElement.appendChild(rect);
    rect.getBBox = () => { throw new Error('not rendered'); };
    expect(rectCenter(rect as unknown as SVGGraphicsElement, svgElement)).toBeNull();
  });

  it('returns null when width is 0', () => {
    const rect = el<SVGRectElement>('rect');
    svgElement.appendChild(rect);
    rect.getBBox = () => mockBBox(0, 0, 0, 50);
    expect(rectCenter(rect as unknown as SVGGraphicsElement, svgElement)).toBeNull();
  });

  it('returns null when height is 0', () => {
    const rect = el<SVGRectElement>('rect');
    svgElement.appendChild(rect);
    rect.getBBox = () => mockBBox(0, 0, 50, 0);
    expect(rectCenter(rect as unknown as SVGGraphicsElement, svgElement)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parentLabel', () => {
  it('returns trimmed text from parent element', () => {
    const g = el('g');
    const rect = el('rect');
    const txt = el('text'); txt.textContent = '  Hello  ';
    g.appendChild(rect); g.appendChild(txt);
    expect(parentLabel(rect)).toBe('Hello');
  });

  it('returns empty string when parent has no <text>', () => {
    const g = el('g');
    const rect = el('rect');
    g.appendChild(rect);
    expect(parentLabel(rect)).toBe('');
  });

  it('returns empty string when element has no parent', () => {
    expect(parentLabel(el('rect'))).toBe('');
  });

  it('returns empty string when text content is empty', () => {
    const g = el('g');
    const rect = el('rect');
    const txt = el('text'); txt.textContent = '   ';
    g.appendChild(rect); g.appendChild(txt);
    expect(parentLabel(rect)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extractEdgeStyle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns computed stroke when present', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'rgb(50, 100, 150)',
      strokeDasharray: 'none',
    } as unknown as CSSStyleDeclaration);
    const { stroke, dash } = extractEdgeStyle(el('path'), false);
    expect(stroke).toBe('rgb(50, 100, 150)');
    expect(dash).toBeUndefined();
  });

  it('uses non-premium fallback when stroke is absent', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'none',
      strokeDasharray: 'none',
    } as unknown as CSSStyleDeclaration);
    expect(extractEdgeStyle(el('path'), false).stroke).toBe('#333');
  });

  it('uses premium fallback when stroke is absent and isPremium=true', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: 'none',
      strokeDasharray: 'none',
    } as unknown as CSSStyleDeclaration);
    expect(extractEdgeStyle(el('path'), true).stroke).toBe('#94a3b8');
  });

  it('parses dash pattern from strokeDasharray', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: '#000',
      strokeDasharray: '6, 3',
    } as unknown as CSSStyleDeclaration);
    expect(extractEdgeStyle(el('path'), false).dash).toEqual([6, 3]);
  });

  it('returns undefined dash when strokeDasharray is "none"', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: '#000',
      strokeDasharray: 'none',
    } as unknown as CSSStyleDeclaration);
    expect(extractEdgeStyle(el('path'), false).dash).toBeUndefined();
  });

  it('returns undefined dash when all dash values are 0', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      stroke: '#000',
      strokeDasharray: '0, 0',
    } as unknown as CSSStyleDeclaration);
    expect(extractEdgeStyle(el('path'), false).dash).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('nextId / resetIdCounter', () => {
  beforeEach(() => resetIdCounter());

  it('generates sequential IDs with the given prefix', () => {
    expect(nextId('node')).toBe('node-1');
    expect(nextId('node')).toBe('node-2');
    expect(nextId('node')).toBe('node-3');
  });

  it('different prefixes share the same counter', () => {
    expect(nextId('edge')).toBe('edge-1');
    expect(nextId('node')).toBe('node-2');
  });

  it('resetIdCounter resets to 1 on next call', () => {
    nextId('x'); nextId('x');
    resetIdCounter();
    expect(nextId('x')).toBe('x-1');
  });
});
