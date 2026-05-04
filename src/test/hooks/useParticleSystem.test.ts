import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import type { DiagramEdge } from '../../types';

const linkEdge = (overrides: Partial<DiagramEdge> = {}): DiagramEdge => ({
  id: 'e1',
  pathD: 'M 0 0 L 100 100',
  stroke: '#333',
  type: 'link',
  ...overrides,
});

// ── initial state ─────────────────────────────────────────────────────────────

describe('useParticleSystem – initial state', () => {
  it('returns empty array when no edges', () => {
    const edges: DiagramEdge[] = [];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current).toHaveLength(0);
  });

  it('skips structural edges', () => {
    const edges = [linkEdge({ type: 'structural' })];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current).toHaveLength(0);
  });

  it('creates at least 2 particles per link edge', () => {
    const edges = [linkEdge()];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current.length).toBeGreaterThanOrEqual(2);
  });
});

// ── particle count ────────────────────────────────────────────────────────────

describe('useParticleSystem – particle count', () => {
  it('creates more particles for longer pathD', () => {
    // short: 11 chars → floor(11/150)=0 → max(1,0)+1=2
    const shortEdges = [linkEdge({ pathD: 'M 0 0 L 1 0' })];
    // long: 326 chars → floor(326/150)=2 → max(1,2)+1=3
    const longEdges = [linkEdge({ pathD: 'M 0 0 ' + 'L 100 0 '.repeat(40) })];
    const { result: short } = renderHook(() => useParticleSystem(shortEdges));
    const { result: long } = renderHook(() => useParticleSystem(longEdges));
    expect(long.current.length).toBeGreaterThan(short.current.length);
  });

  it('accumulates particles across multiple link edges', () => {
    const single = [linkEdge()];
    const double = [linkEdge({ id: 'e1' }), linkEdge({ id: 'e2' })];
    const { result: singleResult } = renderHook(() => useParticleSystem(single));
    const { result: doubleResult } = renderHook(() => useParticleSystem(double));
    expect(doubleResult.current.length).toBeGreaterThan(singleResult.current.length);
  });

  it('ignores structural edges when mixed with link edges', () => {
    const linkOnly = [linkEdge({ id: 'e1' })];
    const mixed = [linkEdge({ id: 'e1' }), linkEdge({ id: 'e2', type: 'structural' })];
    const { result: linkResult } = renderHook(() => useParticleSystem(linkOnly));
    const { result: mixedResult } = renderHook(() => useParticleSystem(mixed));
    expect(mixedResult.current.length).toBe(linkResult.current.length);
  });
});

// ── sankey edges ──────────────────────────────────────────────────────────────

describe('useParticleSystem – Sankey particle count', () => {
  it('uses lineWidth formula for sankey edges', () => {
    // lineWidth=100: floor(100/20)=5, min(5,12)=5, max(2,5)=5
    const edges = [linkEdge({ sankeyFillPath: 'M 0 0 L 100 0', lineWidth: 100 })];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current.length).toBe(5);
  });

  it('caps sankey particles at 12', () => {
    // lineWidth=400: floor(400/20)=20, min(20,12)=12, max(2,12)=12
    const edges = [linkEdge({ sankeyFillPath: 'M 0 0 L 100 0', lineWidth: 400 })];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current.length).toBe(12);
  });

  it('sankey with small lineWidth produces minimum 2 particles', () => {
    // lineWidth=4: floor(4/20)=0, min(0,12)=0, max(2,0)=2
    const edges = [linkEdge({ sankeyFillPath: 'M 0 0 L 100 0', lineWidth: 4 })];
    const { result } = renderHook(() => useParticleSystem(edges));
    expect(result.current.length).toBe(2);
  });
});

// ── reactivity ────────────────────────────────────────────────────────────────

describe('useParticleSystem – reactivity', () => {
  it('replaces particles when edges are removed', () => {
    const initial = [linkEdge()];
    const { result, rerender } = renderHook(
      ({ edges }) => useParticleSystem(edges),
      { initialProps: { edges: initial } }
    );
    expect(result.current.length).toBeGreaterThan(0);
    const empty: DiagramEdge[] = [];
    rerender({ edges: empty });
    expect(result.current.length).toBe(0);
  });

  it('creates new particles when edges are added', () => {
    const empty: DiagramEdge[] = [];
    const { result, rerender } = renderHook(
      ({ edges }) => useParticleSystem(edges),
      { initialProps: { edges: empty } }
    );
    expect(result.current.length).toBe(0);
    const withEdge = [linkEdge()];
    rerender({ edges: withEdge });
    expect(result.current.length).toBeGreaterThan(0);
  });
});
