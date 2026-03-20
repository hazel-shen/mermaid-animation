import type { DiagramNode, DiagramEdge, SeqLabel, EdgeType } from '../types';
import { getCumulativeTransform } from './svgUtils';

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

export const parseSequenceLoopFrames = (svgElement: SVGSVGElement): { nodes: DiagramNode[]; labels: SeqLabel[] } => {
  const nodes: DiagramNode[] = [];
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g').forEach(g => {
    const loopLines = g.querySelectorAll<SVGLineElement>(':scope > line.loopLine');
    if (loopLines.length < 2) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    loopLines.forEach(line => {
      const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
      [parseFloat(line.getAttribute('x1') || '0') + tx, parseFloat(line.getAttribute('x2') || '0') + tx].forEach(v => { minX = Math.min(minX, v); maxX = Math.max(maxX, v); });
      [parseFloat(line.getAttribute('y1') || '0') + ty, parseFloat(line.getAttribute('y2') || '0') + ty].forEach(v => { minY = Math.min(minY, v); maxY = Math.max(maxY, v); });
    });
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return;

    nodes.push({
      id: `loopFrame-${Math.random()}`, label: '', type: 'cluster', shape: 'rect',
      x: minX + w / 2, y: minY + h / 2, width: w, height: h,
      color: 'rgba(236,236,255,0.15)', stroke: '#9370DB',
    });

    const labelTxt = g.querySelector<SVGTextElement>('text.labelText');
    if (labelTxt) {
      const { x: tx, y: ty } = getCumulativeTransform(labelTxt, svgElement);
      const lx = tx + parseFloat(labelTxt.getAttribute('x') || '0');
      const ly = ty + parseFloat(labelTxt.getAttribute('y') || '0');
      const t = labelTxt.textContent?.trim() || '';
      if (t) labels.push({ x: lx, y: ly, text: t, fontSize: 12, bold: true, color: '#5b21b6', align: 'center' });
    }

    const loopTxt = g.querySelector<SVGTextElement>('text.loopText');
    if (loopTxt) {
      const { x: tx, y: ty } = getCumulativeTransform(loopTxt, svgElement);
      const lx = tx + parseFloat(loopTxt.getAttribute('x') || '0');
      const ly = ty + parseFloat(loopTxt.getAttribute('y') || '0');
      const tspan = loopTxt.querySelector('tspan');
      const t = tspan?.textContent?.trim() || loopTxt.textContent?.trim() || '';
      if (t) labels.push({ x: lx, y: ly, text: t, fontSize: 13, bold: false, color: '#374151', align: 'center' });
    }
  });

  return { nodes, labels };
};

export const parseSequenceMessageLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];
  svgElement.querySelectorAll<SVGTextElement>('text.messageText').forEach(el => {
    const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
    const x = tx + parseFloat(el.getAttribute('x') || '0');
    const y = ty + parseFloat(el.getAttribute('y') || '0');
    const dy = parseFloat(el.getAttribute('dy') || '0');
    const text = el.textContent?.trim() || '';
    if (text) labels.push({ x, y: y + dy, text, fontSize: 13, bold: false, color: '#333', align: 'center' });
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
      const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
      d = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
    } else if (tagName === 'path') {
      d = el.getAttribute('d') || "";
    }

    if (d && d.length > 10) {
      const hasArrow = type === 'link' && (
        el.getAttribute('marker-end') != null ||
        el.classList.contains('messageLine0') ||
        el.classList.contains('messageLine1')
      );
      extractedEdges.push({ id: `edge-${Math.random()}`, pathD: d, stroke, type, dash, hasArrow });
    }
  };

  const linkSelector = [
    '.edgePath path', '.flowchart-link',
    'line.messageLine0', 'line.messageLine1',
    'path.messageLine0', 'path.messageLine1',
  ].join(', ');
  const structSelector = '.actor-line, line[class*="actor-line"]';

  svgElement.querySelectorAll(linkSelector).forEach(el => {
    if (el.tagName.toLowerCase() === 'line') {
      const parent = el.parentElement;
      if (parent) {
        const hasSiblingPath = parent.querySelector(':scope > path.messageLine0, :scope > path.messageLine1');
        if (hasSiblingPath) return;
        if (parent.querySelector(':scope > rect.loopLine')) return;
      }
    }
    processEdge(el, 'link');
  });

  svgElement.querySelectorAll(structSelector).forEach(el => processEdge(el, 'structural'));

  svgElement.querySelectorAll('line').forEach(line => {
    if (line.classList.contains('loopLine')) return;
    const lx1 = parseFloat(line.getAttribute('x1') || '0');
    const lx2 = parseFloat(line.getAttribute('x2') || '0');
    const ly1 = parseFloat(line.getAttribute('y1') || '0');
    const ly2 = parseFloat(line.getAttribute('y2') || '0');
    const dx = Math.abs(lx2 - lx1);
    const dy = Math.abs(ly2 - ly1);

    if (dy > dx * 3 && dy > 50) {
      const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
      const potentialPath = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
      if (!extractedEdges.some(e => e.pathD === potentialPath)) {
        processEdge(line, 'structural');
      }
    }
  });

  return extractedEdges;
};
