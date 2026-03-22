import type { DiagramNode, DiagramEdge, EdgeType, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { hexToRgba } from '../utils/colorUtils';

export const parseFlowchartNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const extractedNodes: DiagramNode[] = [];

  svgElement.querySelectorAll('g').forEach(g => {
    const isNode = g.classList.contains('node');
    const isCluster = g.classList.contains('cluster');
    const isNote = g.classList.contains('note');

    if (!isNode && !isCluster && !isNote) return;

    const rect = g.querySelector('rect, circle, polygon, path') as SVGGraphicsElement;
    if (!rect) return;

    const { x: totalTx, y: totalTy } = getCumulativeTransform(rect, svgElement);
    const bbox = rect.getBBox();
    const finalX = totalTx + bbox.x + bbox.width / 2;
    const finalY = totalTy + bbox.y + bbox.height / 2;
    const width = bbox.width;
    const height = bbox.height;

    let shape: DiagramNode['shape'] = 'rect';
    let color = isPremium ? '#ffffff' : '#fff';
    let stroke = isPremium ? '#94a3b8' : '#333';
    let type: DiagramNode['type'] = 'node';

    const style = window.getComputedStyle(rect);
    if (style.fill && style.fill !== 'none' && style.fill !== 'rgb(0, 0, 0)') color = style.fill;
    if (style.stroke && style.stroke !== 'none') stroke = style.stroke;

    const tagName = rect.tagName.toLowerCase();
    if (tagName === 'circle') shape = 'circle';
    else if (tagName === 'polygon') shape = 'diamond';
    else if (tagName === 'rect') shape = 'roundRect';
    else if (tagName === 'path') shape = 'roundRect';

    let label = "";
    const textElement = g.querySelector('text');
    const foreignObject = g.querySelector('foreignObject');

    if (foreignObject) {
      const contentDiv = foreignObject.querySelector('div');
      if (contentDiv) {
        let html = contentDiv.innerHTML;
        html = html.replace(/<br\s*\/?>/gi, '\n');
        const temp = document.createElement('div');
        temp.innerHTML = html;
        label = temp.textContent || "";
      } else {
        label = (foreignObject as unknown as HTMLElement).innerText || foreignObject.textContent || "";
      }
    } else if (textElement) {
      const spans = textElement.querySelectorAll('tspan');
      if (spans.length > 0) {
        label = Array.from(spans).map(s => s.textContent).join('\n');
      } else {
        label = textElement.textContent || "";
      }
    }

    if (isCluster) {
      type = 'cluster';
      color = hexToRgba(color, 0.05);
    } else if (isNote) {
      type = 'note';
      shape = 'note';
      color = '#fef3c7';
      stroke = '#d97706';
    }

    if (width > 0 && height > 0) {
      const nodeId = g.id || `node-${Math.random()}`;
      if (!extractedNodes.some(n => n.id === nodeId)) {
        extractedNodes.push({ id: nodeId, label, type, x: finalX, y: finalY, width, height, color, stroke, shape });
      }
    }
  });

  return extractedNodes;
};

export const parseFlowchartEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
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
      const markerAttr = el.getAttribute('marker-end');
      const hasArrow = type === 'link' && (
        markerAttr != null ||
        (window.getComputedStyle(el).markerEnd || '') !== 'none'
      );
      extractedEdges.push({ id: `edge-${Math.random()}`, pathD: d, stroke, type, dash, hasArrow });
    }
  };

  const linkSelector = ['.edgePath path', '.flowchart-link'].join(', ');
  const structSelector = '.actor-line, line[class*="actor-line"]';

  svgElement.querySelectorAll(linkSelector).forEach(el => processEdge(el, 'link'));
  svgElement.querySelectorAll(structSelector).forEach(el => processEdge(el, 'structural'));

  return extractedEdges;
};

export const parseFlowchartEdgeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.edgeLabel').forEach(g => {
    // Text may be in a <text> or inside a <foreignObject> div
    let text = '';
    const fo = g.querySelector('foreignObject');
    if (fo) {
      text = (fo.textContent || '').trim();
    } else {
      const txt = g.querySelector('text');
      if (txt) text = (txt.textContent || '').trim();
    }
    if (!text) return;

    try {
      const bbox = (g as SVGGraphicsElement).getBBox();
      const ctm  = (g as SVGGraphicsElement).getCTM();
      const svgCtm = svgElement.getCTM();
      if (!ctm || !svgCtm) return;
      const m = svgCtm.inverse().multiply(ctm);
      const cx = m.a * (bbox.x + bbox.width  / 2) + m.c * (bbox.y + bbox.height / 2) + m.e;
      const cy = m.b * (bbox.x + bbox.width  / 2) + m.d * (bbox.y + bbox.height / 2) + m.f;
      labels.push({ x: cx, y: cy, text, fontSize: 12, bold: false, color: '#374151', align: 'center', bgColor: '#ffffff' });
    } catch {
      // skip if getBBox fails
    }
  });

  return labels;
};
