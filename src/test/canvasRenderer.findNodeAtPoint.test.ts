/**
 * Tests for findNodeAtPoint — the shared snapping helper used by drawEdge
 * for all diagram types.
 *
 * Snapping strategy
 * ─────────────────
 * Priority 1 — bbox hit: if (px,py) is inside the node box ±20 px, return
 *   that node.  Works for all diagram types when the path endpoint is on or
 *   very near the box border.
 *
 * Priority 2 (exactOnly=false) — nearest-centre within 120 px: return the
 *   closest node whose centre is within 120 px.  This catches flowchart paths
 *   that end a few pixels outside the box.  Sequence edges use noSnap=true on
 *   the DiagramEdge so findNodeAtPoint is never called for them.
 *
 * When exactOnly=true the fallback is skipped entirely (bbox only).
 */
import { describe, it, expect } from 'vitest';
import { findNodeAtPoint } from '../utils/canvasRenderer';
import type { DiagramNode } from '../types';

const makeNode = (
  overrides: Partial<DiagramNode> & { x: number; y: number; width: number; height: number }
): DiagramNode => ({
  id: `node-${Math.random()}`,
  label: 'Test',
  type: 'node',
  shape: 'roundRect',
  color: '#fff',
  stroke: '#333',
  ...overrides,
});

describe('findNodeAtPoint', () => {
  // ── Priority 1: bbox hit ─────────────────────────────────────────────────

  it('returns node when point is exactly on the right border', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60 });
    expect(findNodeAtPoint([node], 260, 100)).toBe(node);
  });

  it('returns node when point is exactly on the left border', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60 });
    expect(findNodeAtPoint([node], 140, 100)).toBe(node);
  });

  it('returns node when point is inside the box', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60 });
    expect(findNodeAtPoint([node], 200, 100)).toBe(node);
  });

  it('returns node within the 20 px tolerance outside the border', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60 });
    // right border = 260; 260 + 15 = 275 — within pad
    expect(findNodeAtPoint([node], 275, 100)).toBe(node);
  });

  it('skips cluster nodes even when point is inside them (bbox check)', () => {
    const cluster = makeNode({ x: 200, y: 200, width: 400, height: 300, type: 'cluster' });
    const inner   = makeNode({ x: 200, y: 200, width: 100, height: 60 });
    expect(findNodeAtPoint([cluster, inner], 200, 200)).toBe(inner);
  });

  it('returns null for an empty node list', () => {
    expect(findNodeAtPoint([], 100, 100)).toBeNull();
  });

  // ── Priority 2: nearest-centre fallback (exactOnly=false) ───────────────

  it('flowchart: snaps to destination node when endpoint is just outside the box', () => {
    const node = makeNode({ id: 'B', x: 300, y: 100, width: 120, height: 60 });
    // Left border = 300-60=240; pad=20 → bbox zone starts at 220.
    // Point at x=215 is outside bbox zone. Falls to nearest-centre at distance 85 < 120.
    expect(findNodeAtPoint([node], 215, 100)).toBe(node);
  });

  it('does NOT snap to a node whose centre is more than 120px away', () => {
    const topActor    = makeNode({ x: 150, y: 50,  width: 120, height: 60 });
    const bottomActor = makeNode({ x: 150, y: 500, width: 120, height: 60 });
    // Point at (150,250): distance to top = 200, distance to bottom = 250 — both > 120.
    expect(findNodeAtPoint([topActor, bottomActor], 150, 250)).toBeNull();
  });

  it('snaps to nearest node when two are within 120px', () => {
    const nodeA = makeNode({ id: 'A', x: 100, y: 100, width: 100, height: 60 });
    const nodeB = makeNode({ id: 'B', x: 400, y: 100, width: 100, height: 60 });
    // Point at x=345: bbox hit for B (border=350, pad zone starts at 330)
    expect(findNodeAtPoint([nodeA, nodeB], 345, 100)).toBe(nodeB);
  });

  it('returns null when point is beyond 120px from all nodes', () => {
    const node = makeNode({ x: 0, y: 0, width: 100, height: 60 });
    expect(findNodeAtPoint([node], 500, 500)).toBeNull();
  });

  // ── exactOnly=true ───────────────────────────────────────────────────────

  it('exactOnly=true: returns null when point is outside bbox even within 120px', () => {
    const node = makeNode({ x: 300, y: 100, width: 120, height: 60 });
    // Left border=240, pad=20 → bbox zone starts at 220. Point at x=200 is outside.
    // Distance from (200,100) to centre (300,100) = 100 < 120, but exactOnly rejects fallback.
    expect(findNodeAtPoint([node], 200, 100, true)).toBeNull();
  });

  it('exactOnly=true: returns node when point is inside bbox', () => {
    const node = makeNode({ x: 300, y: 100, width: 120, height: 60 });
    expect(findNodeAtPoint([node], 300, 100, true)).toBe(node);
  });

  it('exactOnly=true: returns node within the 20px tolerance', () => {
    const node = makeNode({ x: 300, y: 100, width: 120, height: 60 });
    // Right border = 360; 360+15=375 is within pad=20
    expect(findNodeAtPoint([node], 375, 100, true)).toBe(node);
  });
});
