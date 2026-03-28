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
    case 'dependency':
    case 'openArrow': {
      // Open V arrow (two lines, no fill).
      // 'dependency' = class diagram -->, 'openArrow' = sequence -> / -->
      const S = 10;
      ctx.beginPath();
      ctx.moveTo(-S * Math.cos(-0.45), -S * Math.sin(-0.45));
      ctx.lineTo(0, 0);
      ctx.lineTo(-S * Math.cos(0.45), -S * Math.sin(0.45));
      ctx.stroke();
      break;
    }
    case 'circle': {
      // Hollow circle endpoint — flowchart --o
      // Centre at (-R, 0) so the rightmost edge touches (0, 0) = node border.
      const R = 5;
      ctx.beginPath();
      ctx.arc(-R, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'cross': {
      // × shape — flowchart --x / sequence -x
      // Two diagonals crossing, centred at (-S, 0).
      const S = 6;
      ctx.beginPath();
      ctx.moveTo(-S * 2, -S); ctx.lineTo(0,  S);
      ctx.moveTo(-S * 2,  S); ctx.lineTo(0, -S);
      ctx.stroke();
      break;
    }
    case 'halfCircle': {
      // ⌒ arc (right half of circle) — sequence -) / --)  fire-and-forget
      // Arc centre at (-R, 0); right edge of arc = (0, 0) = node border.
      const R = 8;
      ctx.beginPath();
      ctx.arc(-R, 0, R, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    }
    case 'erOne': {
      // Exactly-one (||): two clearly spaced ticks away from node (-x)
      const T = 9;
      ctx.beginPath();
      ctx.moveTo(-5,  -T); ctx.lineTo(-5,  T);
      ctx.moveTo(-13, -T); ctx.lineTo(-13, T);
      ctx.stroke();
      break;
    }
    case 'erZeroOrOne': {
      // Zero-or-one (o|): tick nearest node, circle further along line (-x)
      const T = 9, R = 6;
      ctx.beginPath();
      ctx.moveTo(-5, -T); ctx.lineTo(-5, T);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-18, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'erMany': {
      // anchor = border point; tips extend OVER px past the border (node fill clips them)
      const T = 9, CF = 20, gap = 7, OVER = 10;
      ctx.beginPath();
      ctx.moveTo(OVER, -T); ctx.lineTo(-CF, 0);
      ctx.moveTo(OVER,  T); ctx.lineTo(-CF, 0);
      ctx.moveTo(0,     0); ctx.lineTo(-CF, 0);
      ctx.moveTo(-(CF + gap), -T); ctx.lineTo(-(CF + gap), T);
      ctx.stroke();
      break;
    }
    case 'erZeroOrMany': {
      const T = 9, CF = 20, gap = 5, R = 6, OVER = 10;
      ctx.beginPath();
      ctx.moveTo(OVER, -T); ctx.lineTo(-CF, 0);
      ctx.moveTo(OVER,  T); ctx.lineTo(-CF, 0);
      ctx.moveTo(0,     0); ctx.lineTo(-CF, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-(CF + gap + R), 0, R, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
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
    case 'aggregation':  return 20;
    case 'extension':    return 12;
    case 'dependency':
    case 'openArrow':    return 0;   // open arrow tip sits at the border
    case 'circle':       return 10;  // diameter = 2R = 10, line stops at left edge
    case 'cross':        return 0;   // × sits at the border
    case 'halfCircle':   return 0;   // arc right edge sits at the border
    case 'erOne':        return 0;
    case 'erZeroOrOne':  return 0;
    case 'erMany':       return 0;
    case 'erZeroOrMany': return 0;
    default:             return 10;
  }
};
