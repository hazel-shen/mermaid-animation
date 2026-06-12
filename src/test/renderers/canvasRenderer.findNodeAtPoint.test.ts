/**
 * Tests for hitTestNode + findNodeAtPoint.
 *
 * hitTestNode — shape-aware exact hit test (issue #43). Mirrors the geometry
 *   drawNode() paints: pie wedge sweep, diamond L1-norm, capsule stadium,
 *   point-in-polygon for hexagon / parallelogram / trapezoid / asymmetric.
 *   Used by useCanvasTransform.handleMouseMove for hover detection (pad=0).
 *
 * findNodeAtPoint — snapping wrapper built on hitTestNode:
 *   Priority 1 — shape hit with pad=20 tolerance.
 *   Priority 2 (exactOnly=false) — nearest-centre within 120 px.
 *   When exactOnly=true the fallback is skipped entirely.
 */
import { describe, it, expect } from 'vitest';
import { findNodeAtPoint, hitTestNode } from '../../utils/canvasRenderer';
import type { DiagramNode } from '../../types';

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

// All shape nodes below: centre (200,100), width 120, height 60 → hw=60, hh=30
describe('hitTestNode — shape-aware exact tests (issue #43)', () => {
  it('rect-like default: bbox corner still hits', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60 });
    expect(hitTestNode(node, 255, 125)).toBe(true);
  });

  // ── diamond ────────────────────────────────────────────────────────────────
  it('diamond: centre and vertices hit', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'diamond' });
    expect(hitTestNode(node, 200, 100)).toBe(true);
    expect(hitTestNode(node, 260, 100)).toBe(true); // right vertex, on edge
    expect(hitTestNode(node, 200, 70)).toBe(true);  // top vertex
  });

  it('diamond: empty bbox corners no longer hit', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'diamond' });
    // (250,120) is inside the bbox but outside the rhombus: 50/60 + 20/30 = 1.5 > 1
    expect(hitTestNode(node, 250, 120)).toBe(false);
    expect(hitTestNode(node, 150, 80)).toBe(false);
  });

  // ── circle family ──────────────────────────────────────────────────────────
  it('circle: radial test rejects bbox corners', () => {
    const node = makeNode({ x: 200, y: 100, width: 60, height: 60, shape: 'circle' });
    expect(hitTestNode(node, 220, 100)).toBe(true);  // r=20 < 30
    expect(hitTestNode(node, 225, 125)).toBe(false); // corner: r≈35 > 30
  });

  it('endCircle: same radial test', () => {
    const node = makeNode({ x: 200, y: 100, width: 40, height: 40, shape: 'endCircle' });
    expect(hitTestNode(node, 200, 118)).toBe(true);
    expect(hitTestNode(node, 216, 116)).toBe(false); // corner: r≈22.6 > 20
  });

  // ── stadium ────────────────────────────────────────────────────────────────
  it('stadium: capsule test rejects corners but keeps rounded ends', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'stadium' });
    expect(hitTestNode(node, 142, 100)).toBe(true);  // left rounded end
    expect(hitTestNode(node, 145, 75)).toBe(false);  // top-left bbox corner
    expect(hitTestNode(node, 200, 128)).toBe(true);  // flat bottom of core
  });

  // ── hexagon ────────────────────────────────────────────────────────────────
  it('hexagon: side tips hit, cut corners do not', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'hexagon' });
    // vertices: (170,70)(230,70)(260,100)(230,130)(170,130)(140,100)
    expect(hitTestNode(node, 255, 100)).toBe(true);  // near right tip
    expect(hitTestNode(node, 145, 75)).toBe(false);  // cut top-left corner
    expect(hitTestNode(node, 255, 128)).toBe(false); // cut bottom-right corner
  });

  // ── parallelogram / trapezoid ─────────────────────────────────────────────
  it('parallelogram: skewed corners no longer hit', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'parallelogram' });
    // skew=18 → vertices (158,70)(260,70)(242,130)(140,130)
    expect(hitTestNode(node, 200, 100)).toBe(true);
    expect(hitTestNode(node, 145, 72)).toBe(false);  // top-left skew gap
    expect(hitTestNode(node, 255, 128)).toBe(false); // bottom-right skew gap
  });

  it('trapezoid: narrowed top corners no longer hit', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'trapezoid' });
    // skew=18 → vertices (158,70)(242,70)(140,130)(260,130)
    expect(hitTestNode(node, 145, 72)).toBe(false);
    expect(hitTestNode(node, 255, 72)).toBe(false);
    expect(hitTestNode(node, 145, 128)).toBe(true); // wide bottom edge
  });

  // ── asymmetric ────────────────────────────────────────────────────────────
  it('asymmetric: left notch concavity no longer hits', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'asymmetric' });
    // notch=27 → vertices (140,70)(260,70)(260,130)(140,130)(167,100)
    expect(hitTestNode(node, 150, 100)).toBe(false); // inside the notch
    expect(hitTestNode(node, 180, 100)).toBe(true);  // just past the notch tip
    expect(hitTestNode(node, 145, 75)).toBe(true);   // top-left wing is solid
    expect(hitTestNode(node, 255, 100)).toBe(true);  // flat right edge
  });

  // ── pie wedge ─────────────────────────────────────────────────────────────
  it('pie wedge: hits inside the sweep, misses outside angle or radius', () => {
    const node = makeNode({
      x: 200, y: 100, width: 100, height: 100, shape: 'pie',
      pieWedge: { cx: 200, cy: 100, radius: 50, startAngle: 0, endAngle: Math.PI / 2 },
    });
    expect(hitTestNode(node, 230, 130)).toBe(true);  // 45°, r≈42
    expect(hitTestNode(node, 230, 70)).toBe(false);  // -45° outside sweep
    expect(hitTestNode(node, 260, 160)).toBe(false); // r≈85 outside radius
  });

  // ── pad tolerance ─────────────────────────────────────────────────────────
  it('pad inflates the shape outward (diamond)', () => {
    const node = makeNode({ x: 200, y: 100, width: 120, height: 60, shape: 'diamond' });
    expect(hitTestNode(node, 265, 100)).toBe(false);    // beyond right vertex
    expect(hitTestNode(node, 265, 100, 20)).toBe(true); // within pad
  });

  it('pad inflates the shape outward (circle)', () => {
    const node = makeNode({ x: 200, y: 100, width: 60, height: 60, shape: 'circle' });
    expect(hitTestNode(node, 240, 100)).toBe(false);
    expect(hitTestNode(node, 240, 100, 15)).toBe(true);
  });
});
