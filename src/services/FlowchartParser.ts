import type { DiagramNode, DiagramEdge, EdgeType, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { lineToPathD, extractEdgeStyle, nextId, applyTranslateToPathD } from '../utils/parser-base';
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

    // Read text color from classDef (Mermaid applies it to <text> or <span> inside foreignObject).
    let labelColor: string | undefined;
    const textEl = g.querySelector('text, foreignObject span, foreignObject div');
    if (textEl) {
      const textStyle = window.getComputedStyle(textEl);
      const tc = textStyle.color || textStyle.fill;
      if (tc && tc !== 'rgba(0, 0, 0, 0)' && tc !== 'rgb(0, 0, 0)') {
        labelColor = tc;
      }
    }

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
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < nums.length - 1; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const span = maxY - minY;
      const hasMidPoint = span > 0 && ys.some(y => {
        const norm = (y - minY) / span;
        return norm > 0.2 && norm < 0.8;
      });
      if (pointCount <= 4) {
        if (hasMidPoint) {
          shape = 'diamond'; // {text} — rhombus: left/right vertices at mid-Y
        } else {
          // 4 corner points — classify as parallelogram / trapezoid / subroutine
          const tol = span * 0.1;
          const topXs = xs.filter((_, i) => ys[i] - minY < tol);
          const botXs = xs.filter((_, i) => maxY - ys[i] < tol);
          if (topXs.length === 2 && botXs.length === 2) {
            const topLeft = Math.min(...topXs);
            const topRight = Math.max(...topXs);
            const botLeft = Math.min(...botXs);
            const botRight = Math.max(...botXs);
            const shiftLeft  = topLeft  - botLeft;   // >0 → top leans right
            const shiftRight = topRight - botRight;   // >0 → top leans right
            const sk = span * 0.15; // minimum skew to distinguish from rect
            if      (shiftLeft >  sk && shiftRight >  sk) shape = 'parallelogram';    // [/text/]
            else if (shiftLeft < -sk && shiftRight < -sk) shape = 'parallelogramAlt'; // [\text\]
            else if (shiftLeft >  sk && shiftRight < -sk) shape = 'trapezoid';        // [/text\] wider bottom
            else if (shiftLeft < -sk && shiftRight >  sk) shape = 'trapezoidAlt';     // [\text/] wider top
            else shape = 'subroutine'; // rectangular 4-point polygon
          } else {
            shape = 'diamond'; // fallback for unusual point distributions
          }
        }
      } else {
        // > 4 points: distinguish by number of mid-Y vertices
        // hexagon {{text}} has tip on BOTH left and right → 2 mid-Y points
        // asymmetric >text]  has tip on right side only  → 1 mid-Y point
        // subroutine [[text]] all points at top/bottom   → 0 mid-Y points
        const midCount = ys.filter(y => {
          const norm = (y - minY) / span;
          return norm > 0.2 && norm < 0.8;
        }).length;
        if (midCount >= 2)      shape = 'hexagon';
        else if (midCount === 1) shape = 'asymmetric'; // >text]
        else                     shape = 'subroutine';
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
      } else {
        // Asymmetric >text]: Mermaid v11 renders the flat right edge as a degenerate
        // vertical bezier — all three x-coords of one C segment are equal.
        // Two threshold tiers based on whether the path has linear (L/H/V) segments:
        //   - With L (roundRect): corner beziers span ≈8% → threshold 25% safely excludes them
        //   - Pure bezier (stadium ([text])): arc beziers span ≈50% → threshold 60% excludes them;
        //     >text] flat wall spans ≈70-100% → passes both thresholds
        const hasLinear = /[LHVlhv]/.test(d);
        const allPathNums = (d.match(/-?[\d.]+/g) || []).map(Number);
        const pathYs = allPathNums.filter((_, i) => i % 2 === 1);
        const pathYRange = pathYs.length ? Math.max(...pathYs) - Math.min(...pathYs) : 0;
        const ySpanThreshold = hasLinear ? 0.25 : 0.6;
        const isAsymmetric = pathYRange > 0 && d.split(/(?=[Cc])/).some(seg => {
          if (!seg.trimStart().startsWith('C') && !seg.trimStart().startsWith('c')) return false;
          const nums = seg.replace(/^[Cc]\s*/, '').split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
          if (nums.length < 6) return false;
          if (Math.abs(nums[0] - nums[2]) >= 1 || Math.abs(nums[2] - nums[4]) >= 1) return false;
          const segYSpan = Math.max(nums[1], nums[3], nums[5]) - Math.min(nums[1], nums[3], nums[5]);
          return segYSpan / pathYRange >= ySpanThreshold;
        });
        if (isAsymmetric) {
          shape = 'asymmetric';
        } else if (!hasLinear) {
          // Stadium ([text]): fully rounded ends → only M/C/Z, no straight-line segments
          shape = 'stadium';
        } else {
          shape = 'roundRect';
        }
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
        extractedNodes.push({ id: nodeId, label, type, x: finalX, y: finalY, width, height, color, stroke, shape, labelColor });
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
const edgeEndIds = (el: Element, nodeIds: Set<string>): { fromNodeId?: string; toNodeId?: string } => {
  /**
   * Split "inner" (the part between the L- prefix and the trailing -<index>)
   * into fromId and toId using the known node id set for disambiguation.
   *
   * Mermaid short ids (e.g. "pmproxy") and full g.ids (e.g. "flowchart-pmproxy-0")
   * both appear inside the edge id, separated by a single hyphen/underscore.
   * A naive indexOf('-') fails when node ids themselves contain the separator
   * (e.g. "flowchart-JBoss-0-flowchart-pmcd-0").
   *
   * Strategy: try every split position and pick the one where both halves are
   * recognised as known (or resolvable) node ids.  Fall back to first separator.
   */
  const splitInner = (inner: string, sep: string): { fromNodeId: string; toNodeId: string } | null => {
    const parts = inner.split(sep);
    // Try all possible split points (prefix = parts[0..i], suffix = parts[i+1..])
    for (let i = 0; i < parts.length - 1; i++) {
      const from = parts.slice(0, i + 1).join(sep);
      const to   = parts.slice(i + 1).join(sep);
      if (!from || !to) continue;
      const fromKnown = nodeIds.has(from) || [...nodeIds].some(nid => nid.endsWith(`-${from}-0`) || nid.includes(`-${from}-`));
      const toKnown   = nodeIds.has(to)   || [...nodeIds].some(nid => nid.endsWith(`-${to}-0`)   || nid.includes(`-${to}-`));
      if (fromKnown && toKnown) return { fromNodeId: from, toNodeId: to };
    }
    // Fallback: first separator (original behaviour)
    const firstSep = inner.indexOf(sep);
    if (firstSep > 0) return { fromNodeId: inner.slice(0, firstSep), toNodeId: inner.slice(firstSep + 1) };
    return null;
  };

  const tryParse = (id: string): { fromNodeId: string; toNodeId: string } | null => {
    // Format: L-<from>-<to>-<index>  (Mermaid v10, hyphens)
    const m = id.match(/^L-(.+)-(\d+)$/);
    if (m) {
      const result = splitInner(m[1], '-');
      if (result) return result;
    }
    // Format: L_<from>_<to>_<index>  (Mermaid v11, underscores)
    const mu = id.match(/^L_(.+)_(\d+)$/);
    if (mu) {
      const result = splitInner(mu[1], '_');
      if (result) return result;
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

    // Detect thick edges (==>) — Mermaid adds class "edge-thickness-thick"
    // or sets a stroke-width > 2 via computed style.
    const cls = el.getAttribute('class') || '';
    const computedSW = parseFloat(window.getComputedStyle(el).strokeWidth || '0');
    const isThick = cls.includes('edge-thickness-thick') || computedSW > 2;
    const lineWidth = isThick ? 3.5 : undefined;

    let d = "";

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'line') {
      d = lineToPathD(el, svgElement);
    } else if (tagName === 'path') {
      const raw = el.getAttribute('d') || "";
      const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
      d = (tx !== 0 || ty !== 0) ? applyTranslateToPathD(raw, tx, ty) : raw;
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
      const { fromNodeId, toNodeId } = type === 'link' ? edgeEndIds(el, nodeIds) : {};


      extractedEdges.push({
        id: nextId('edge'), pathD: d, stroke, type, dash,
        hasArrow: hasArrow || !!arrowEnd || !!arrowStart,
        arrowEnd,
        arrowStart,
        fromNodeId: resolve(fromNodeId),
        toNodeId:   resolve(toNodeId),
        lineWidth,
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
