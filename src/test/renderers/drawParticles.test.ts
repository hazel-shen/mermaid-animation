import { describe, it, expect, vi } from 'vitest';
import { drawParticles } from '../../utils/drawParticles';
import type { ParticleShape } from '../../utils/drawParticles';

const makeCtx = () => {
  const ctx = {
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    shadowBlur: 0,
    shadowColor: '',
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    beginPath: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

const makeParticle = (x: number, y: number) => ({
  getPosition: () => ({ x, y }),
});

// ── canvas state ──────────────────────────────────────────────────────────────

describe('drawParticles – canvas state', () => {
  it('sets globalCompositeOperation to multiply while drawing', () => {
    const ctx = makeCtx();
    let opDuringDraw = '';
    (ctx.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      opDuringDraw = ctx.globalCompositeOperation;
    });
    const p = makeParticle(10, 20);
    drawParticles(ctx, [p as never], '#ff0000', 5, 'circle');
    expect(opDuringDraw).toBe('multiply');
  });

  it('resets globalCompositeOperation to source-over after drawing', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(10, 20) as never], '#ff0000', 5, 'circle');
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('resets shadowBlur to 0 after drawing', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(10, 20) as never], '#ff0000', 5, 'circle');
    expect(ctx.shadowBlur).toBe(0);
  });

  it('applies particleColor to fillStyle and shadowColor', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [], '#abc123', 5, 'circle');
    expect(ctx.fillStyle).toBe('#abc123');
    expect(ctx.shadowColor).toBe('#abc123');
  });

});

// ── skip (0,0) particles ──────────────────────────────────────────────────────

describe('drawParticles – skip zero-position particles', () => {
  it('does not call fill() for a particle at (0,0)', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(0, 0) as never], '#ff0000', 5, 'circle');
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('skips (0,0) but still draws other particles', () => {
    const ctx = makeCtx();
    const particles = [makeParticle(0, 0), makeParticle(50, 50)];
    drawParticles(ctx, particles as never[], '#ff0000', 5, 'circle');
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });
});

// ── shape: circle (default) ───────────────────────────────────────────────────

describe('drawParticles – circle', () => {
  it('calls arc() with full 2π sweep', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(10, 20) as never], '#ff0000', 5, 'circle');
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2);
  });

  it('calls fill() once per drawn particle', () => {
    const ctx = makeCtx();
    const particles = [makeParticle(10, 20), makeParticle(30, 40)];
    drawParticles(ctx, particles as never[], '#ff0000', 5, 'circle');
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });
});

// ── shape: square ─────────────────────────────────────────────────────────────

describe('drawParticles – square', () => {
  it('calls rect() centered on particle position', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(50, 60) as never], '#ff0000', 8, 'square');
    expect(ctx.rect).toHaveBeenCalledWith(42, 52, 16, 16);
  });

  it('does not call arc() for square shape', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(10, 10) as never], '#ff0000', 5, 'square');
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

// ── shape: triangle ───────────────────────────────────────────────────────────

describe('drawParticles – triangle', () => {
  it('calls moveTo() and lineTo() to form the triangle', () => {
    const ctx = makeCtx();
    const r = 5;
    drawParticles(ctx, [makeParticle(10, 20) as never], '#ff0000', r, 'triangle');
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20 - r);
    expect(ctx.lineTo).toHaveBeenCalledWith(10 + r * 0.866, 20 + r * 0.5);
    expect(ctx.lineTo).toHaveBeenCalledWith(10 - r * 0.866, 20 + r * 0.5);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

// ── shape: star ───────────────────────────────────────────────────────────────

describe('drawParticles – star', () => {
  it('calls moveTo() once and lineTo() 9 times for a 5-spike star', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(50, 50) as never], '#ff0000', 5, 'star');
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(9);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

// ── shape: diamond ────────────────────────────────────────────────────────────

describe('drawParticles – diamond', () => {
  it('draws four points forming a diamond', () => {
    const ctx = makeCtx();
    const r = 6;
    drawParticles(ctx, [makeParticle(20, 30) as never], '#ff0000', r, 'diamond');
    expect(ctx.moveTo).toHaveBeenCalledWith(20, 30 - r);
    expect(ctx.lineTo).toHaveBeenCalledWith(20 + r * 0.7, 30);
    expect(ctx.lineTo).toHaveBeenCalledWith(20, 30 + r);
    expect(ctx.lineTo).toHaveBeenCalledWith(20 - r * 0.7, 30);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

// ── shape: heart ──────────────────────────────────────────────────────────────

describe('drawParticles – heart', () => {
  it('calls bezierCurveTo() four times for the heart curves', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(40, 40) as never], '#ff0000', 5, 'heart');
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

// ── shape: hat ────────────────────────────────────────────────────────────────

describe('drawParticles – hat', () => {
  it('calls rect() twice (crown + brim)', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(30, 30) as never], '#ff0000', 10, 'hat');
    expect(ctx.rect).toHaveBeenCalledTimes(2);
  });

  it('calls fill() mid-shape for the crown, then again at end', () => {
    const ctx = makeCtx();
    drawParticles(ctx, [makeParticle(30, 30) as never], '#ff0000', 10, 'hat');
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });
});

// ── multiple particles ────────────────────────────────────────────────────────

describe('drawParticles – multiple particles', () => {
  it('calls beginPath() once per non-zero particle', () => {
    const ctx = makeCtx();
    const particles = [
      makeParticle(0, 0),  // skipped
      makeParticle(10, 10),
      makeParticle(20, 20),
    ];
    drawParticles(ctx, particles as never[], '#ff0000', 5, 'circle');
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
  });

  it('draws all shapes using the given particleSize as radius', () => {
    const shapes: ParticleShape[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart', 'hat'];
    for (const shape of shapes) {
      const ctx = makeCtx();
      expect(() =>
        drawParticles(ctx, [makeParticle(50, 50) as never], '#ff0', 7, shape)
      ).not.toThrow();
    }
  });
});
