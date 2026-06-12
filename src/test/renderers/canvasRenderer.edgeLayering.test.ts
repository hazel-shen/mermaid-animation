import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFrame } from '../../utils/canvasRenderer';
import type { RenderFrameOptions } from '../../utils/canvasRenderer';
import type { DiagramNode, DiagramEdge } from '../../types';

// Record the relative paint order of edges, particles, and nodes.
// Node drawing is detected via ctx.roundRect (roundRect-shaped node);
// drawEdge / drawParticles are mocked to log into the same array.
const paintOrder: string[] = [];

vi.mock('../../utils/drawEdge', () => ({
  drawEdge: vi.fn((_ctx, edge: DiagramEdge) => paintOrder.push(`edge:${edge.id}`)),
}));
vi.mock('../../utils/drawParticles', () => ({
  drawParticles: vi.fn(() => paintOrder.push('particles')),
}));

const makeCtx = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(() => paintOrder.push('node')),
  ellipse: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  setLineDash: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'center' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextBaseline,
  shadowBlur: 0,
  shadowColor: '',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
}) as unknown as CanvasRenderingContext2D;

const node: DiagramNode = {
  id: 'n1', label: '', type: 'node', shape: 'roundRect',
  x: 0, y: 0, width: 100, height: 50, color: '#1168bd', stroke: '#073b6f',
};

const edge = (over: Partial<DiagramEdge>): DiagramEdge => ({
  id: 'e1', pathD: 'M 0 0 L 100 0', stroke: '#333', type: 'link', ...over,
});

const opts = (edges: DiagramEdge[]): RenderFrameOptions => ({
  nodes: [node],
  edges,
  particles: [],
  seqLabels: [],
  isPremium: true,
  particleColor: '#ff0000',
  particleSpeed: 1,
  particleSize: 5,
  particleShape: 'circle',
  isRecording: false,
  hoveredNodeId: null,
  exportBg: 'solid',
});

const tr = { x: 0, y: 0, scale: 1 };
const offset = { x: 0, y: 0 };

beforeEach(() => { paintOrder.length = 0; });

describe('renderFrame – edge/node paint order', () => {
  it('draws regular link edges and particles below the node layer', () => {
    renderFrame(makeCtx(), 800, 600, tr, offset, false, opts([edge({})]));

    expect(paintOrder.indexOf('edge:e1')).toBeLessThan(paintOrder.indexOf('particles'));
    expect(paintOrder.indexOf('particles')).toBeLessThan(paintOrder.indexOf('node'));
  });

  it('draws aboveNodes edges (C4) and particles above the node layer', () => {
    renderFrame(makeCtx(), 800, 600, tr, offset, false, opts([edge({ aboveNodes: true })]));

    expect(paintOrder.indexOf('node')).toBeLessThan(paintOrder.indexOf('edge:e1'));
    expect(paintOrder.indexOf('edge:e1')).toBeLessThan(paintOrder.indexOf('particles'));
  });

  it('splits mixed edges across the node layer', () => {
    renderFrame(makeCtx(), 800, 600, tr, offset, false, opts([
      edge({ id: 'below' }),
      edge({ id: 'above', aboveNodes: true }),
    ]));

    const nodeIdx = paintOrder.indexOf('node');
    expect(paintOrder.indexOf('edge:below')).toBeLessThan(nodeIdx);
    expect(paintOrder.indexOf('edge:above')).toBeGreaterThan(nodeIdx);
  });
});
