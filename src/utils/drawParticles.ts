import type { Particle } from './particle';

export type ParticleShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'heart' | 'hat';

export const drawParticles = (
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  particleColor: string,
  particleSize: number,
  particleShape: ParticleShape,
  darkMode = false,
) => {
  ctx.globalCompositeOperation = darkMode ? 'screen' : 'multiply';
  ctx.shadowBlur = darkMode ? 12 : 4;
  ctx.shadowColor = particleColor;
  ctx.fillStyle = particleColor;
  const r = particleSize;

  particles.forEach(p => {
    const pos = p.getPosition();
    if (pos.x === 0 && pos.y === 0) return;
    ctx.beginPath();
    switch (particleShape) {
      case 'square':
        ctx.rect(pos.x - r, pos.y - r, r * 2, r * 2);
        break;
      case 'triangle':
        ctx.moveTo(pos.x, pos.y - r);
        ctx.lineTo(pos.x + r * 0.866, pos.y + r * 0.5);
        ctx.lineTo(pos.x - r * 0.866, pos.y + r * 0.5);
        ctx.closePath();
        break;
      case 'star': {
        const spikes = 5;
        const outerR = r;
        const innerR = r * 0.4;
        for (let i = 0; i < spikes * 2; i++) {
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const rad = i % 2 === 0 ? outerR : innerR;
          if (i === 0) ctx.moveTo(pos.x + Math.cos(angle) * rad, pos.y + Math.sin(angle) * rad);
          else ctx.lineTo(pos.x + Math.cos(angle) * rad, pos.y + Math.sin(angle) * rad);
        }
        ctx.closePath();
        break;
      }
      case 'diamond':
        ctx.moveTo(pos.x, pos.y - r);
        ctx.lineTo(pos.x + r * 0.7, pos.y);
        ctx.lineTo(pos.x, pos.y + r);
        ctx.lineTo(pos.x - r * 0.7, pos.y);
        ctx.closePath();
        break;
      case 'heart': {
        const s = r * 0.9;
        ctx.moveTo(pos.x, pos.y + s * 0.3);
        ctx.bezierCurveTo(pos.x, pos.y - s * 0.3, pos.x - s, pos.y - s * 0.3, pos.x - s, pos.y - s * 0.6);
        ctx.bezierCurveTo(pos.x - s, pos.y - s * 1.1, pos.x, pos.y - s * 0.9, pos.x, pos.y - s * 0.5);
        ctx.bezierCurveTo(pos.x, pos.y - s * 0.9, pos.x + s, pos.y - s * 1.1, pos.x + s, pos.y - s * 0.6);
        ctx.bezierCurveTo(pos.x + s, pos.y - s * 0.3, pos.x, pos.y - s * 0.3, pos.x, pos.y + s * 0.3);
        ctx.closePath();
        break;
      }
      case 'hat': {
        const brimW = r * 1.4;
        const brimH = r * 0.28;
        const crownW = r * 0.8;
        const crownH = r * 1.1;
        const top = pos.y - crownH * 0.7;
        ctx.rect(pos.x - crownW / 2, top, crownW, crownH);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(pos.x - brimW / 2, top + crownH - brimH / 2, brimW, brimH);
        break;
      }
      default: // circle
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  });

  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
};
