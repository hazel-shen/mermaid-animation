import type { ArrowMarker } from '../types';

export const drawArrowMarker = (
  ctx: CanvasRenderingContext2D,
  marker: ArrowMarker,
  x: number,
  y: number,
  angle: number,
  color: string,
  bgColor: string,
) => {
  if (marker === 'none') return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  switch (marker) {
    case 'extension': {
      // Hollow equilateral triangle pointing in arrow direction
      const S = 14, H = S * 0.87;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-H, -S / 2);
      ctx.lineTo(-H,  S / 2);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'composition': {
      // Filled diamond
      const L = 10, W = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-L,  W);
      ctx.lineTo(-L * 2, 0);
      ctx.lineTo(-L, -W);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'aggregation': {
      // Hollow diamond
      const L = 10, W = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-L,  W);
      ctx.lineTo(-L * 2, 0);
      ctx.lineTo(-L, -W);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'dependency': {
      // Open arrow (two lines, no fill)
      const S = 10;
      ctx.beginPath();
      ctx.moveTo(-S * Math.cos(-0.45), -S * Math.sin(-0.45));
      ctx.lineTo(0, 0);
      ctx.lineTo(-S * Math.cos(0.45), -S * Math.sin(0.45));
      ctx.stroke();
      break;
    }
    default: {
      // Generic filled triangle
      const size = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size * Math.cos(-0.4), -size * Math.sin(-0.4));
      ctx.lineTo(-size * Math.cos(0.4), -size * Math.sin(0.4));
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
};

/** How far (px) to set back the line end so it doesn't protrude through the marker. */
export const markerSetback = (marker: ArrowMarker | undefined): number => {
  switch (marker) {
    case 'composition':
    case 'aggregation': return 20;  // diamond length = L*2 = 20
    case 'extension':   return 12;  // triangle height ≈ H = 14*0.87
    case 'dependency':  return 0;   // open arrow, no fill needed
    default:            return 10;  // generic triangle
  }
};
