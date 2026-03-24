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
      ((shapeEl.getAttribute('d') || '').match(/\ba\b/gi) || []).length >= 2;

    if (isCylinderPath || (ellipse && !svgCircle)) {
      shape = 'cylinder';
    } else if (tagName === 'circle') {
      shape = 'circle';
    } else if (tagName === 'polygon') {
      // Count point pairs: 4 = diamond {}, 6 = hexagon {{}}
      const nums = (shapeEl.getAttribute('points') || '')
        .replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
      shape = Math.floor(nums.length / 2) <= 4 ? 'diamond' : 'hexagon';
    } else if (tagName === 'rect') {
      const rx = parseFloat((shapeEl as SVGRectElement).getAttribute('rx') || '0');
      if (rx >= height * 0.45) {
        shape = 'stadium';          // ([text]) — fully rounded ends
      } else if (rx >= 4) {
        shape = 'roundRect';        // (text) — moderately rounded
      } else {
        shape = 'rect';             // [text] — sharp corners
      }
    } else {
      // path fallback — treat as roundRect
      shape = 'roundRect';
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
    // Format: L-<from>-<to>-<index>
    const m = id.match(/^L-(.+)-(\d+)$/);
    if (!m) return null;
    const inner = m[1]; // "<from>-<to>"
    const sep = inner.indexOf('-');
    if (sep <= 0) return null;
    return { fromNodeId: inner.slice(0, sep), toNodeId: inner.slice(sep + 1) };
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
      const markerAttr = el.getAttribute('marker-end') || window.getComputedStyle(el).markerEnd || '';
      // Only treat as arrow if the marker is a genuine arrowhead (not a circle/cross marker).
      const isNonArrowMarker = /circle|cross/i.test(markerAttr);
      const hasArrow = type === 'link' && markerAttr !== '' && markerAttr !== 'none' && !isNonArrowMarker;

      // Attach node ids so drawEdge can snap the arrowhead to the box border
      const { fromNodeId, toNodeId } = type === 'link' ? edgeEndIds(el) : {};

      // Resolve short id (e.g. "W0") → full node g.id (e.g. "flowchart-W0-0")
      const resolve = (shortId?: string): string | undefined => {
        if (!shortId) return undefined;
        if (nodeIds.has(shortId)) return shortId;
        // Match "flowchart-<shortId>-<digit>" pattern
        const pattern = new RegExp(`^flowchart-${shortId}-\\d+$`);
        for (const nid of nodeIds) {
          if (pattern.test(nid)) return nid;
        }
        // Looser: contains "-<shortId>-"
        for (const nid of nodeIds) {
          if (nid.includes(`-${shortId}-`)) return nid;
        }
        return shortId;
      };

      extractedEdges.push({
        id: nextId('edge'), pathD: d, stroke, type, dash, hasArrow,
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
