import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFrame } from '../../utils/canvasRenderer';
import type { RenderFrameOptions } from '../../utils/canvasRenderer';

vi.mock('../../utils/drawParticles', () => ({
  drawParticles: vi.fn(),
}));

import { drawParticles } from '../../utils/drawParticles';

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
  roundRect: vi.fn(),
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

const baseOpts = (): RenderFrameOptions => ({
  nodes: [],
  edges: [],
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

beforeEach(() => {
  vi.mocked(drawParticles).mockClear();
});

// ── showParticles: false (static export) ─────────────────────────────

describe('renderFrame – showParticles: false (static export)', () => {
  it('does not call drawParticles when showParticles is false', () => {
    const ctx = makeCtx();
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...baseOpts(),
      showParticles: false,
    });
    expect(drawParticles).not.toHaveBeenCalled();
  });

  it('does not call drawParticles regardless of isPremium when showParticles is false', () => {
    const ctx = makeCtx();
    renderFrame(ctx, 800, 600, tr, offset, false, {
      ...baseOpts(),
      isPremium: false,
      showParticles: false,
    });
    expect(drawParticles).not.toHaveBeenCalled();
  });
});
