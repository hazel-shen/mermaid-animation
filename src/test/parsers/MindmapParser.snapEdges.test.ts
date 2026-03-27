import { describe, it, expect } from 'vitest';
import { snapMindmapEdgesToNodes } from '../../services/MindmapParser';
import type { DiagramNode, DiagramEdge } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeNode = (id: string, x: number, y: number): DiagramNode => ({
  id,
  label: id,
  type: 'node',
  shape: 'roundRect',
  x,
  y,
  width: 80,
  height: 40,
  color: '#fff',
  stroke: '#000',
});

const makeEdge = (id: string, pathD: string): DiagramEdge => ({
  id,
  pathD,
  stroke: '#333',
  type: 'link',
  noSnap: true,
});

// ─── snapMindmapEdgesToNodes ──────────────────────────────────────────────────

describe('snapMindmapEdgesToNodes', () => {

  // ── guard: empty inputs ────────────────────────────────────────────────────

  it('returns edges unchanged when nodes is empty', () => {
    const edge = makeEdge('e1', 'M 10 20 L 100 200');
    const result = snapMindmapEdgesToNodes([edge], []);
    expect(result).toEqual([edge]);
  });

  it('returns empty array when edges is empty', () => {
    const node = makeNode('n1', 50, 50);
    expect(snapMindmapEdgesToNodes([], [node])).toEqual([]);
  });

  // ── noSnap is always reset to false ────────────────────────────────────────

  it('sets noSnap=false on all edges regardless of original value', () => {
    const node = makeNode('n1', 100, 100);
    const edge = makeEdge('e1', 'M 100 100 L 100 100');
    const [result] = snapMindmapEdgesToNodes([edge], [node]);
    expect(result.noSnap).toBe(false);
  });

  // ── fromNodeId / toNodeId via M…L path ────────────────────────────────────

  it('snaps fromNodeId to nearest node to the M start point', () => {
    // nodeA at (10,10), nodeB at (200,200)
    // path starts at (15,15) → nearest is nodeA
    const nodeA = makeNode('A', 10, 10);
    const nodeB = makeNode('B', 200, 200);
    const edge = makeEdge('e1', 'M 15 15 L 205 205');

    const [result] = snapMindmapEdgesToNodes([edge], [nodeA, nodeB]);
    expect(result.fromNodeId).toBe('A');
  });

  it('snaps toNodeId to nearest node to the last endpoint', () => {
    const nodeA = makeNode('A', 10, 10);
    const nodeB = makeNode('B', 200, 200);
    const edge = makeEdge('e1', 'M 15 15 L 205 205');

    const [result] = snapMindmapEdgesToNodes([edge], [nodeA, nodeB]);
    expect(result.toNodeId).toBe('B');
  });

  it('fromNodeId and toNodeId can point to the same node when path is within one node', () => {
    const node = makeNode('only', 100, 100);
    const edge = makeEdge('e1', 'M 98 98 L 102 102');

    const [result] = snapMindmapEdgesToNodes([edge], [node]);
    expect(result.fromNodeId).toBe('only');
    expect(result.toNodeId).toBe('only');
  });

  // ── cubic bezier (Mermaid 11 mindmap format) ───────────────────────────────

  it('extracts endpoint from cubic bezier C command', () => {
    // M sx sy C cx1 cy1 cx2 cy2 ex ey
    // endpoint is (ex, ey) = (300, 400)
    const nodeStart = makeNode('start', 0, 0);
    const nodeEnd   = makeNode('end',   300, 400);
    const edge = makeEdge('e1', 'M 0 0 C 100 0 200 400 300 400');

    const [result] = snapMindmapEdgesToNodes([edge], [nodeStart, nodeEnd]);
    expect(result.toNodeId).toBe('end');
  });

  it('handles multi-segment cubic bezier and uses the last endpoint', () => {
    // Two C segments; endpoint is the last x,y of the second C
    const nodeStart = makeNode('start', 0, 0);
    const nodeEnd   = makeNode('end',   500, 0);
    const edge = makeEdge('e1', 'M 0 0 C 100 100 200 100 250 0 C 350 -100 400 -100 500 0');

    const [result] = snapMindmapEdgesToNodes([edge], [nodeStart, nodeEnd]);
    expect(result.toNodeId).toBe('end');
  });

  // ── endPoint: path ending with H (horizontal line) ────────────────────────

  it('returns undefined toNodeId when path ends with H (cannot extract reliable endpoint)', () => {
    // Path: M 0 50 L 100 50 H 200
    // H has only one coordinate, making the endpoint ambiguous.
    // The regex requires the matched segment to extend to the end of string ($),
    // so no M/L/C/S/Q/T/A segment can match past the H. endPoint returns null,
    // which is safer than the old approach that would have produced {x:50, y:200}
    // by blindly taking the last two numbers across command boundaries.
    const nodeNear = makeNode('near', 100, 50);
    const nodeFar  = makeNode('far',  200, 50);
    const edge = makeEdge('e1', 'M 0 50 L 100 50 H 200');

    const [result] = snapMindmapEdgesToNodes([edge], [nodeNear, nodeFar]);
    expect(result.toNodeId).toBeUndefined();
  });

  // ── original edge properties are preserved ─────────────────────────────────

  it('preserves all original edge properties', () => {
    const node = makeNode('n1', 50, 50);
    const edge: DiagramEdge = {
      id: 'edge-x',
      pathD: 'M 50 50 L 50 50',
      stroke: '#abcdef',
      type: 'structural',
      dash: [4, 2],
      hasArrow: true,
    };

    const [result] = snapMindmapEdgesToNodes([edge], [node]);
    expect(result.id).toBe('edge-x');
    expect(result.stroke).toBe('#abcdef');
    expect(result.type).toBe('structural');
    expect(result.dash).toEqual([4, 2]);
    expect(result.hasArrow).toBe(true);
  });

  // ── multiple edges snapped independently ──────────────────────────────────

  it('snaps multiple edges to the correct nodes independently', () => {
    const nodeA = makeNode('A', 0,   0);
    const nodeB = makeNode('B', 100, 0);
    const nodeC = makeNode('C', 200, 0);

    const edgeAB = makeEdge('eAB', 'M 0 0 L 100 0');
    const edgeBC = makeEdge('eBC', 'M 100 0 L 200 0');

    const [resAB, resBC] = snapMindmapEdgesToNodes([edgeAB, edgeBC], [nodeA, nodeB, nodeC]);

    expect(resAB.fromNodeId).toBe('A');
    expect(resAB.toNodeId).toBe('B');
    expect(resBC.fromNodeId).toBe('B');
    expect(resBC.toNodeId).toBe('C');
  });

  // ── unparseable path ──────────────────────────────────────────────────────

  it('sets fromNodeId/toNodeId to undefined when pathD has no parseable coordinates', () => {
    const node = makeNode('n1', 50, 50);
    const edge = makeEdge('e1', 'Z');

    const [result] = snapMindmapEdgesToNodes([edge], [node]);
    expect(result.fromNodeId).toBeUndefined();
    expect(result.toNodeId).toBeUndefined();
  });
});
