import type { DiagramNode, DiagramEdge, EdgeType, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, extractEdgeStyle, nextId } from '../utils/parser-base';
import { hexToRgba } from '../utils/colorUtils';

export const parseFlowchartNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const extractedNodes: DiagramNode[] = [];

  svgElement.querySelectorAll('g').forEach(g => {
    const isNode = g.classList.contains('node');
    const isCluster = g.classList.contains('cluster');
    const isNote = g.classList.contains('note');

    if (!isNode && !isCluster && !isNote) return;

    // Prefer shape-specific elements; polygon/ellipse must take priority over rect.
    const polygon   = g.querySelector<SVGPolygonElement>('polygon');
    const ellipse   = g.querySelector<SVGEllipseElement>('ellipse');
    const svgCircle = g.querySelector<SVGCircleElement>('circle');
    const shapeEl   = (polygon || svgCircle || ellipse || g.querySelector('rect, path')) as SVGGraphicsElement;
    if (!shapeEl) return;

    // For cylinder nodes (ellipse + rect combo), the ellipse is only the top cap —
    // use the rect's bbox for the full height/position instead.
    const cylinderRect = (ellipse && !svgCircle)
      ? g.querySelector<SVGRectElement>('rect')
      : null;
    const bboxEl = (cylinderRect || shapeEl) as SVGGraphicsElement;

    const { x: totalTx, y: totalTy } = getCumulativeTransform(bboxEl, svgElement);
    const bbox = bboxEl.getBBox();
    const finalX = totalTx + bbox.x + bbox.width / 2;
    const finalY = totalTy + bbox.y + bbox.height / 2;
    const width = bbox.width;
    const height = bbox.height;

    let shape: DiagramNode['shape'] = 'rect';
    let color = isPremium ? '#ffffff' : '#fff';
    let stroke = isPremium ? '#94a3b8' : '#333';
    let type: DiagramNode['type'] = 'node';

    // Use the visible shape element for colour (not always shapeEl for cylinder)
    const colorEl = g.querySelector('rect, polygon, circle, ellipse, path') as Element | null;
    const style = window.getComputedStyle(colorEl || shapeEl);
    if (style.fill && style.fill !== 'none' && style.fill !== 'rgb(0, 0, 0)') color = style.fill;
    if (style.stroke && style.stroke !== 'none') stroke = style.stroke;

    const tagName = shapeEl.tagName.toLowerCase();

    // Cylinder [(text)]: Mermaid v10 renders as a single <path> with elliptical arc
    // commands (M...a...a...l...a...l — no separate ellipse element).
    // Detect by checking the path d attribute contains multiple arc ('a') commands.
    const isCylinderPath = tagName === 'path' &&
      ((shapeEl.getAttribute('d') || '').match(/\ba/gi) || []).length >= 2;

    if (isCylinderPath || (ellipse && !svgCircle)) {
      shape = 'cylinder';
    } else if (tagName === 'circle') {
      shape = 'circle';
    } else if (tagName === 'polygon') {
      const nums = (shapeEl.getAttribute('points') || '')
        .replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map(Number);
      const pointCount = Math.floor(nums.length / 2);
      if (pointCount <= 4) {
        shape = 'diamond';        // {text} — rhombus
      } else {
        // Distinguish hexagon {{text}} from subroutine [[text]]:
        // Mermaid hexagon has left/right tip points at the vertical midpoint.
        // Subroutine is rectangular — all points sit at the top or bottom extent.
        const ys: number[] = [];
        for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const span = maxY - minY;
        const hasMidPoint = span > 0 && ys.some(y => {
          const norm = (y - minY) / span;  // 0 = top, 1 = bottom
          return norm > 0.2 && norm < 0.8; // has a point in the middle band
        });
        shape = hasMidPoint ? 'hexagon' : 'subroutine';
      }
    } else if (tagName === 'rect') {
      const rx = parseFloat((shapeEl as SVGRectElement).getAttribute('rx') || '0');
      if (rx >= height * 0.45) {
        shape = 'stadium';          // ([text]) — fully rounded ends
      } else if (rx >= 4) {
        shape = 'roundRect';        // (text) — moderately rounded
      } else {
        // Subroutine [[text]]: Mermaid adds two inner vertical <line> elements
        // alongside the rect to draw the double-border effect.
        shape = g.querySelectorAll('line').length >= 2 ? 'subroutine' : 'rect';
      }
    } else {
      // path fallback (Mermaid v11 bezier-curve shapes)
      const d = shapeEl.getAttribute('d') || '';
      if (g.querySelectorAll('line').length >= 2) {
        // Subroutine [[text]] v11: path with inner <line> elements
        shape = 'subroutine';
      } else if (!/[LHVlhv]/.test(d)) {
        // Stadium ([text]): fully rounded ends → only M/C/Z, no straight-line segments
        shape = 'stadium';
      } else {
        shape = 'roundRect';
      }
    }

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
      const nodeId = g.id || nextId('node');
      if (!extractedNodes.some(n => n.id === nodeId)) {
        extractedNodes.push({ id: nodeId, label, type, x: finalX, y: finalY, width, height, color, stroke, shape });
      }
    }
  });

  return extractedNodes;
};

/**
 * Collect all node ids present in the SVG so we can match against
 * the short ids embedded in edgePath group ids (e.g. "L-W0-W1-0").
 * Returns a Set of the raw g.id values (e.g. "flowchart-W0-0").
 */
const collectNodeIds = (svgElement: SVGSVGElement): Set<string> => {
  const ids = new Set<string>();
  svgElement.querySelectorAll('g.node, g.cluster').forEach(g => {
    if (g.id) ids.add(g.id);
  });
  return ids;
};

/**
 * Extract from/to node ids from a Mermaid flowchart edge element.
 *
 * New Mermaid (v11+): the id is on the <path> itself, e.g. id="L-W0-W1-0"
 * and the class contains "LS-W0 LE-W1".
 * Older Mermaid: the id is on a parent <g>, same format.
 *
 * Strategy: check el.id first, then walk ancestors.
 */
const edgeEndIds = (el: Element): { fromNodeId?: string; toNodeId?: string } => {
  const tryParse = (id: string): { fromNodeId: string; toNodeId: string } | null => {
    // Format: L-<from>-<to>-<index>  (Mermaid v10, hyphens)
    const m = id.match(/^L-(.+)-(\d+)$/);
    if (m) {
      const inner = m[1];
      const sep = inner.indexOf('-');
      if (sep > 0) return { fromNodeId: inner.slice(0, sep), toNodeId: inner.slice(sep + 1) };
    }
    // Format: L_<from>_<to>_<index>  (Mermaid v11, underscores)
    const mu = id.match(/^L_(.+)_(\d+)$/);
    if (mu) {
      const inner = mu[1];
      const sep = inner.indexOf('_');
      if (sep > 0) return { fromNodeId: inner.slice(0, sep), toNodeId: inner.slice(sep + 1) };
    }
    return null;
  };

  // 1. Try the element's own id (new Mermaid)
  if (el.id) {
    const r = tryParse(el.id);
    if (r) return r;
  }

  // 2. Try class-based LS-<from> LE-<to> (also on the element itself)
  const cls = el.getAttribute('class') || '';
  const lsMatch = cls.match(/\bLS-(\S+)\b/);
  const leMatch = cls.match(/\bLE-(\S+)\b/);
  if (lsMatch && leMatch) {
    return { fromNodeId: lsMatch[1], toNodeId: leMatch[1] };
  }

  // 3. Walk ancestors (older Mermaid — id on parent <g>)
  let g: Element | null = el.parentElement;
  while (g && g.tagName.toLowerCase() !== 'svg') {
    if (g.id) {
      const r = tryParse(g.id);
      if (r) return r;
    }
    g = g.parentElement;
  }

  return {};
};

export const parseFlowchartEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const extractedEdges: DiagramEdge[] = [];
  const nodeIds = collectNodeIds(svgElement);


  // Resolve short id (e.g. "W0") → full node g.id (e.g. "flowchart-W0-0")
  const resolve = (shortId?: string): string | undefined => {
    if (!shortId) return undefined;
    if (nodeIds.has(shortId)) return shortId;
    const pattern = new RegExp(`^flowchart-${shortId}-\\d+$`);
    for (const nid of nodeIds) {
      if (pattern.test(nid)) return nid;
    }
    for (const nid of nodeIds) {
      if (nid.includes(`-${shortId}-`)) return nid;
    }
    return shortId;
  };

  const processEdge = (el: Element, type: EdgeType) => {
    const { stroke, dash } = extractEdgeStyle(el, isPremium);
    let d = "";

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'line') {
      d = lineToPathD(el, svgElement);
    } else if (tagName === 'path') {
      d = el.getAttribute('d') || "";
    }

    if (d && d.length > 10) {
      const markerEnd   = el.getAttribute('marker-end')   || window.getComputedStyle(el).markerEnd   || '';
      const markerStart = el.getAttribute('marker-start') || window.getComputedStyle(el).markerStart || '';

      const hasEnd   = markerEnd   !== '' && markerEnd   !== 'none';
      const hasStart = markerStart !== '' && markerStart !== 'none';
      const isCircle = (m: string) => /circle/i.test(m);
      const isCross  = (m: string) => /cross/i.test(m);

      // Resolve each marker end to a concrete ArrowMarker type.
      // circle/cross are endpoint shapes, not arrowheads — set arrowEnd/arrowStart explicitly.
      // For standard bidirectional <--> both ends must be explicit so drawEdge's
      // `!edge.arrowStart` guard doesn't suppress the end arrow.
      let arrowEnd:   import('../types').ArrowMarker | undefined;
      let arrowStart: import('../types').ArrowMarker | undefined;
      let hasArrow = false;

      if (type === 'link') {
        if (hasEnd) {
          if      (isCircle(markerEnd)) arrowEnd = 'circle';
          else if (isCross(markerEnd))  arrowEnd = 'cross';
          else if (hasStart)            arrowEnd = 'default'; // bidirectional: must be explicit
          else                          hasArrow  = true;      // unidirectional: legacy path
        }
        if (hasStart) {
          if      (isCircle(markerStart)) arrowStart = 'circle';
          else if (isCross(markerStart))  arrowStart = 'cross';
          else                            arrowStart = 'default';
        }
      }

      // Attach node ids so drawEdge can snap the arrowhead to the box border
      const { fromNodeId, toNodeId } = type === 'link' ? edgeEndIds(el) : {};


      extractedEdges.push({
        id: nextId('edge'), pathD: d, stroke, type, dash,
        hasArrow: hasArrow || !!arrowEnd || !!arrowStart,
        arrowEnd,
        arrowStart,
        fromNodeId: resolve(fromNodeId),
        toNodeId:   resolve(toNodeId),
      });
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
