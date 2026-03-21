import type { DiagramNode, DiagramEdge, SeqLabel, EdgeType } from '../types';
import { getCumulativeTransform } from './svgUtils';

/** Shift all absolute coordinates in an SVG path d-string by (tx, ty). */
const shiftPathCoords = (raw: string, tx: number, ty: number): string => {
  if (!raw || (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5)) return raw;
  return raw.replace(
    /([MLCSQTAZHVmlcsqtazhv])\s*([-\d.,\s]*)/g,
    (match, cmd: string, coords: string) => {
      const upper = cmd.toUpperCase();
      if (upper === 'Z') return cmd;
      // lowercase = relative, skip
      if (cmd !== upper) return match;
      if (upper === 'H') {
        return cmd + coords.trim().split(/[\s,]+/).map(n => (parseFloat(n) + tx).toFixed(2)).join(' ');
      }
      if (upper === 'V') {
        return cmd + coords.trim().split(/[\s,]+/).map(n => (parseFloat(n) + ty).toFixed(2)).join(' ');
      }
      const ns = coords.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      const shifted = ns.map((n, i) => (i % 2 === 0 ? n + tx : n + ty).toFixed(2));
      return cmd + shifted.join(' ');
    }
  );
};

const getRectGeom = (rect: SVGRectElement, svgElement: SVGSVGElement) => {
  const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
  const rx = parseFloat(rect.getAttribute('x') || '0');
  const ry = parseFloat(rect.getAttribute('y') || '0');
  const rw = parseFloat(rect.getAttribute('width') || '0');
  const rh = parseFloat(rect.getAttribute('height') || '0');
  return { cx: tx + rx + rw / 2, cy: ty + ry + rh / 2, w: rw, h: rh };
};

export const parseSequenceNodes = (svgElement: SVGSVGElement): DiagramNode[] => {
  const extractedNodes: DiagramNode[] = [];

  // 1. Participant boxes (actor rects — top and bottom)
  svgElement.querySelectorAll<SVGRectElement>('rect.actor').forEach(rect => {
    const { cx, cy, w, h } = getRectGeom(rect, svgElement);
    if (w <= 0 || h <= 0) return;
    if (extractedNodes.some(n => Math.abs(n.x - cx) < 1 && Math.abs(n.y - cy) < 1)) return;

    let label = rect.getAttribute('name') || '';
    const parentG = rect.parentElement;
    if (parentG) {
      const txt = parentG.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || label;
    }
    const style = window.getComputedStyle(rect);
    const color = (style.fill && style.fill !== 'none') ? style.fill : '#ECECFF';
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : '#9370DB';
    extractedNodes.push({ id: `actor-${Math.random()}`, label, type: 'actor', shape: 'roundRect', x: cx, y: cy, width: w, height: h, color, stroke });
  });

  // 2. Actor-man (人形符號)
  svgElement.querySelectorAll<SVGGElement>('g.actor-man').forEach(g => {
    const name = g.getAttribute('name') || '';
    const circle = g.querySelector<SVGCircleElement>('circle');
    if (!circle) return;
    const circR = parseFloat(circle.getAttribute('r') || '15');
    let bx: number, by: number, bw: number, bh: number;
    try {
      const bb = g.getBBox();
      bx = bb.x; by = bb.y; bw = bb.width; bh = bb.height;
    } catch {
      bx = -circR; by = -circR; bw = circR * 2; bh = circR * 4;
    }
    const { x: gtx, y: gty } = getCumulativeTransform(g, svgElement);
    const cx = gtx + bx + bw / 2;
    const cy = gty + by + bh / 2;
    if (extractedNodes.some(n => Math.abs(n.x - cx) < 1 && Math.abs(n.y - cy) < 1)) return;

    let label = name;
    const txt = g.querySelector<SVGTextElement>('text');
    if (txt) label = txt.textContent?.trim() || label;

    extractedNodes.push({ id: g.id || `actor-man-${Math.random()}`, label, type: 'actor', shape: 'circle', x: cx, y: cy, width: bw, height: bh, color: '#ECECFF', stroke: '#9370DB' });
  });

  // 3. Note boxes
  svgElement.querySelectorAll<SVGRectElement>('rect.note').forEach(rect => {
    const { cx, cy, w, h } = getRectGeom(rect, svgElement);
    if (w <= 0 || h <= 0) return;
    let label = '';
    const parentG = rect.parentElement;
    if (parentG) {
      const txt = parentG.querySelector<SVGTextElement>('text');
      if (txt) label = txt.textContent?.trim() || '';
    }
    extractedNodes.push({ id: `note-${Math.random()}`, label, type: 'note', shape: 'note', x: cx, y: cy, width: w, height: h, color: '#fff5ad', stroke: '#aaaa33' });
  });

  // 4. Background rect blocks (rect rgb(...) sections)
  svgElement.querySelectorAll<SVGRectElement>('rect.rect').forEach(rect => {
    const { cx, cy, w, h } = getRectGeom(rect, svgElement);
    if (w <= 0 || h <= 0) return;
    const style = window.getComputedStyle(rect);
    const fillAttr = rect.getAttribute('fill') || 'rgba(240,240,240,0.5)';
    const color = fillAttr !== 'none' ? fillAttr : 'rgba(240,240,240,0.4)';
    extractedNodes.push({ id: `bgRect-${Math.random()}`, label: '', type: 'cluster', shape: 'rect', x: cx, y: cy, width: w, height: h, color, stroke: style.stroke !== 'none' ? style.stroke : '#aaa' });
  });

  return extractedNodes;
};

export const parseSequenceLoopFrames = (
  svgElement: SVGSVGElement
): { nodes: DiagramNode[]; labels: SeqLabel[]; dividerEdges: DiagramEdge[] } => {
  const nodes: DiagramNode[] = [];
  const labels: SeqLabel[] = [];
  const dividerEdges: DiagramEdge[] = [];

  svgElement.querySelectorAll<SVGGElement>('g').forEach(g => {
    const loopLines = g.querySelectorAll<SVGLineElement>(':scope > line.loopLine');
    if (loopLines.length < 2) return;

    // Collect all loopLine coords
    const lineCoords: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    loopLines.forEach(line => {
      const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
      lineCoords.push({
        x1: parseFloat(line.getAttribute('x1') || '0') + tx,
        y1: parseFloat(line.getAttribute('y1') || '0') + ty,
        x2: parseFloat(line.getAttribute('x2') || '0') + tx,
        y2: parseFloat(line.getAttribute('y2') || '0') + ty,
      });
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    lineCoords.forEach(c => {
      minX = Math.min(minX, c.x1, c.x2);
      maxX = Math.max(maxX, c.x1, c.x2);
      minY = Math.min(minY, c.y1, c.y2);
      maxY = Math.max(maxY, c.y1, c.y2);
    });

    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return;

    // Detect frame type from labelText
    const labelTxt = g.querySelector<SVGTextElement>('text.labelText');
    const frameType = labelTxt?.textContent?.trim().toLowerCase() || 'loop';
    const isAlt = frameType === 'alt' || frameType === 'opt' || frameType === 'par';

    nodes.push({
      id: `loopFrame-${Math.random()}`, label: '', type: 'cluster', shape: 'rect',
      x: minX + w / 2, y: minY + h / 2, width: w, height: h,
      color: isAlt ? 'rgba(255,245,200,0.18)' : 'rgba(236,236,255,0.15)',
      stroke: isAlt ? '#d97706' : '#9370DB',
    });

    // Frame type label (e.g. "alt", "loop")
    if (labelTxt) {
      const { x: tx, y: ty } = getCumulativeTransform(labelTxt, svgElement);
      const lx = tx + parseFloat(labelTxt.getAttribute('x') || '0');
      const ly = ty + parseFloat(labelTxt.getAttribute('y') || '0');
      const t = labelTxt.textContent?.trim() || '';
      if (t) labels.push({ x: lx, y: ly, text: t, fontSize: 12, bold: true, color: isAlt ? '#92400e' : '#5b21b6', align: 'left' });
    }

    // Condition labels — loopText tspans cover ALL sections (alt condition per tspan)
    g.querySelectorAll<SVGTextElement>('text.loopText').forEach(loopTxt => {
      const { x: tx, y: ty } = getCumulativeTransform(loopTxt, svgElement);
      const baseX = tx + parseFloat(loopTxt.getAttribute('x') || '0');
      const baseY = ty + parseFloat(loopTxt.getAttribute('y') || '0');

      const tspans = loopTxt.querySelectorAll('tspan');
      if (tspans.length > 0) {
        tspans.forEach(tspan => {
          const t = tspan.textContent?.trim() || '';
          if (!t) return;
          const dx = parseFloat(tspan.getAttribute('x') || '0');
          const dy = parseFloat(tspan.getAttribute('dy') || '0');
          const sx = dx !== 0 ? tx + dx : baseX;
          const sy = baseY + dy;
          labels.push({ x: sx, y: sy, text: t, fontSize: 13, bold: false, color: '#374151', align: 'center' });
        });
      } else {
        const t = loopTxt.textContent?.trim() || '';
        if (t) labels.push({ x: baseX, y: baseY, text: t, fontSize: 13, bold: false, color: '#374151', align: 'center' });
      }
    });

    // Internal divider lines — horizontal loopLines between top and bottom borders
    lineCoords.forEach(c => {
      const isHorizontal = Math.abs(c.y1 - c.y2) < 2 && Math.abs(c.x1 - c.x2) > 10;
      if (!isHorizontal) return;
      const lineY = (c.y1 + c.y2) / 2;
      const isTopBorder = Math.abs(lineY - minY) < 2;
      const isBottomBorder = Math.abs(lineY - maxY) < 2;
      if (!isTopBorder && !isBottomBorder) {
        dividerEdges.push({
          id: `divider-${Math.random()}`,
          pathD: `M ${c.x1} ${c.y1} L ${c.x2} ${c.y2}`,
          stroke: isAlt ? '#d97706' : '#9370DB',
          type: 'structural',
          dash: [6, 3],
        });
      }
    });
  });

  return { nodes, labels, dividerEdges };
};

export const parseSequenceStepNumbers = (svgElement: SVGSVGElement): DiagramNode[] => {
  const stepNodes: DiagramNode[] = [];

  // Mermaid renders step numbers as <text> inside <g> elements with class "sequenceNumber"
  // or as circles rendered via background rect+text combos
  svgElement.querySelectorAll<SVGTextElement>('text.sequenceNumber').forEach(el => {
    const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
    const cx = tx + parseFloat(el.getAttribute('x') || '0');
    const cy = ty + parseFloat(el.getAttribute('y') || '0');
    const text = el.textContent?.trim() || '';
    if (!text) return;

    stepNodes.push({
      id: `stepNum-${Math.random()}`,
      label: text,
      type: 'node',
      shape: 'circle',
      x: cx,
      y: cy,
      width: 20,
      height: 20,
      color: '#1e293b',
      stroke: '#1e293b',
    });
  });

  // Also check for circle+text combos (some Mermaid versions render them differently)
  svgElement.querySelectorAll<SVGGElement>('g').forEach(g => {
    const circle = g.querySelector<SVGCircleElement>(':scope > circle');
    const text = g.querySelector<SVGTextElement>(':scope > text');
    if (!circle || !text) return;
    const label = text.textContent?.trim() || '';
    if (!label || isNaN(Number(label))) return;

    const { x: gtx, y: gty } = getCumulativeTransform(g, svgElement);
    const r = parseFloat(circle.getAttribute('r') || '10');
    const cx = gtx + parseFloat(circle.getAttribute('cx') || '0');
    const cy = gty + parseFloat(circle.getAttribute('cy') || '0');

    if (stepNodes.some(n => Math.abs(n.x - cx) < 2 && Math.abs(n.y - cy) < 2)) return;

    stepNodes.push({
      id: `stepNum-${Math.random()}`,
      label,
      type: 'node',
      shape: 'circle',
      x: cx,
      y: cy,
      width: r * 2,
      height: r * 2,
      color: '#1e293b',
      stroke: '#1e293b',
    });
  });

  return stepNodes;
};

export const parseSequenceMessageLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];
  svgElement.querySelectorAll<SVGTextElement>('text.messageText').forEach(el => {
    const text = el.textContent?.trim() || '';
    if (!text) return;

    // Use getBBox() to get the actual rendered bounding box of the text element,
    // then apply the element's CTM to convert to SVG root coordinates.
    // This correctly handles dy='1em', dominant-baseline, and all transforms.
    try {
      const bbox = el.getBBox();
      const ctm = el.getCTM();
      const svgCtm = svgElement.getCTM();
      if (bbox && ctm && svgCtm) {
        const inv = svgCtm.inverse();
        const m = inv.multiply(ctm);
        // bbox is in local coordinates; transform top-left corner via matrix
        const bboxCenterX = bbox.x + bbox.width / 2;
        const bboxCenterY = bbox.y + bbox.height / 2;
        const cx = m.a * bboxCenterX + m.c * bboxCenterY + m.e;
        const cy = m.b * bboxCenterX + m.d * bboxCenterY + m.f;
        const fontSize = 13;
        labels.push({ x: cx, y: cy, text, fontSize, bold: false, color: '#333', align: 'center' });
        return;
      }
    } catch {
      // fall through to attribute-based fallback
    }

    // Fallback: attribute-based positioning
    const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
    const x = tx + parseFloat(el.getAttribute('x') || '0');
    const y = ty + parseFloat(el.getAttribute('y') || '0');
    // dy may be '1em' — use computed style to get actual pixel value
    const dyAttr = el.getAttribute('dy') || '0';
    const dyPx = dyAttr.endsWith('em')
      ? parseFloat(dyAttr) * 13
      : parseFloat(dyAttr);
    const fontSize = 13;
    labels.push({ x, y: y + dyPx - fontSize / 2, text, fontSize, bold: false, color: '#333', align: 'center' });
  });
  return labels;
};

export const parseSequenceEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const extractedEdges: DiagramEdge[] = [];

  const processEdge = (el: Element, type: EdgeType) => {
    let d = "";
    let stroke = isPremium ? '#94a3b8' : '#333';
    let dash: number[] | undefined = undefined;

    const style = window.getComputedStyle(el);
    if (style.stroke && style.stroke !== 'none') stroke = style.stroke;

    if (style.strokeDasharray && style.strokeDasharray !== 'none') {
      const dashValues = style.strokeDasharray.split(',').map(n => parseFloat(n));
      if (dashValues.some(v => v > 0)) dash = dashValues;
    }

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'line') {
      const lx1 = parseFloat(el.getAttribute('x1') || '0');
      const ly1 = parseFloat(el.getAttribute('y1') || '0');
      const lx2 = parseFloat(el.getAttribute('x2') || '0');
      const ly2 = parseFloat(el.getAttribute('y2') || '0');
      // Try CTM-based transform first, fall back to manual cumulative
      try {
        const ctm = (el as SVGGraphicsElement).getCTM();
        const svgCtm = svgElement.getCTM();
        if (ctm && svgCtm) {
          const inv = svgCtm.inverse();
          const m = inv.multiply(ctm);
          d = `M ${lx1 * m.a + m.e} ${ly1 * m.d + m.f} L ${lx2 * m.a + m.e} ${ly2 * m.d + m.f}`;
        } else {
          const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
          d = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
        }
      } catch {
        const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
        d = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
      }
    } else if (tagName === 'path') {
      // Use CTM to handle path coordinate transforms properly
      try {
        const ctm = (el as SVGGraphicsElement).getCTM();
        const svgCtm = svgElement.getCTM();
        if (ctm && svgCtm) {
          const inv = svgCtm.inverse();
          const m = inv.multiply(ctm);
          // Only apply if there's a non-identity transform (translation)
          if (Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5) {
            const raw = el.getAttribute('d') || "";
            d = shiftPathCoords(raw, m.e, m.f);
          } else {
            d = el.getAttribute('d') || "";
          }
        } else {
          d = el.getAttribute('d') || "";
        }
      } catch {
        d = el.getAttribute('d') || "";
      }
    }

    if (d && d.length > 4) {
      const markerAttr = el.getAttribute('marker-end');
      const hasArrow = type === 'link' && (
        markerAttr != null ||
        el.classList.contains('messageLine0') ||
        el.classList.contains('messageLine1')
      );
      extractedEdges.push({ id: `edge-${Math.random()}`, pathD: d, stroke, type, dash, hasArrow, noSnap: type === 'link' });
    }
  };

  const linkSelector = [
    '.edgePath path', '.flowchart-link',
    'line.messageLine0', 'line.messageLine1',
    'path.messageLine0', 'path.messageLine1',
  ].join(', ');
  const structSelector = '.actor-line, line[class*="actor-line"]';

  const processedElements = new Set<Element>();

  svgElement.querySelectorAll(linkSelector).forEach(el => {
    if (el.tagName.toLowerCase() === 'line') {
      const parent = el.parentElement;
      if (parent) {
        // Only skip line if a valid sibling path exists (non-empty d attribute)
        const sibPath = parent.querySelector<SVGPathElement>(':scope > path.messageLine0, :scope > path.messageLine1');
        const sibPathValid = sibPath && (sibPath.getAttribute('d') || '').length > 4;
        if (sibPathValid) return;
        if (parent.querySelector(':scope > rect.loopLine')) return;
      }
    }
    processedElements.add(el);
    processEdge(el, 'link');
  });

  svgElement.querySelectorAll(structSelector).forEach(el => {
    processedElements.add(el);
    processEdge(el, 'structural');
  });

  // Fallback: scan all <line> elements not already processed
  svgElement.querySelectorAll('line').forEach(line => {
    if (processedElements.has(line)) return;
    if (line.classList.contains('loopLine')) return;
    const lx1 = parseFloat(line.getAttribute('x1') || '0');
    const lx2 = parseFloat(line.getAttribute('x2') || '0');
    const ly1 = parseFloat(line.getAttribute('y1') || '0');
    const ly2 = parseFloat(line.getAttribute('y2') || '0');
    const dx = Math.abs(lx2 - lx1);
    const dy = Math.abs(ly2 - ly1);

    if (dy > dx * 3 && dy > 50) {
      // Vertical line — structural (lifeline)
      processEdge(line, 'structural');
    } else if (dx > 10 && dy < dx * 0.3) {
      // Horizontal line — message line missed by class selectors
      const hasArrow = line.getAttribute('marker-end') != null ||
        line.classList.contains('messageLine0') ||
        line.classList.contains('messageLine1');
      const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
      extractedEdges.push({
        id: `edge-${Math.random()}`,
        pathD: `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`,
        stroke: isPremium ? '#64748b' : '#333',
        type: 'link',
        dash: line.classList.contains('messageLine1') ? [3, 3] : undefined,
        hasArrow,
        noSnap: true,
      });
    }
  });

  return extractedEdges;
};
