/**
 * ClassParser: Parses Mermaid class diagram SVG output.
 *
 * Mermaid v10 uses two renderers:
 *  - v1 (classDiagram): nodes are g.classGroup with rect inside; edges are path.relation
 *  - v2 (classDiagram via dagre-wrapper): nodes are g.node.default (id="classId-*") with
 *    rect.outer.title-state and transform="translate(cx,cy)"; edges are path.relation
 *    inside g.edgePaths (also with class "edge-pattern-solid|dashed|dotted")
 */
import type { DiagramNode, DiagramEdge, ClassLine, SeqLabel, ArrowMarker } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { extractComputedColors, rectCenter, nextId, applyTranslateToPathD } from '../utils/parser-base';

/**
 * Extracts visible text from the first foreignObject found in `root`.
 * Uses innerHTML → temp div to reliably cross the SVG/HTML namespace boundary.
 */
const extractForeignObjectText = (root: Element): string => {
  const fo = root.querySelector('foreignObject');
  if (!fo) return '';
  const contentDiv = fo.querySelector('div');
  if (contentDiv) {
    const temp = document.createElement('div');
    temp.innerHTML = contentDiv.innerHTML;
    return temp.textContent?.trim() ?? '';
  }
  return (fo as unknown as HTMLElement).innerText?.trim() || fo.textContent?.trim() || '';
};

/** Returns true if the element is a descendant of a <defs> or <marker> element. */
const isInsideDefs = (el: Element): boolean => {
  let cur = el.parentElement;
  while (cur) {
    const tag = cur.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'marker') return true;
    cur = cur.parentElement;
  }
  return false;
};

export const parseClassNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];
  const seenIds = new Set<string>();

  // ── v2 renderer: g.node (dagre-wrapper, used by classDiagram-v2) ──────────
  // Each node is <g class="node default" id="classId-Foo-0" transform="translate(cx,cy)">
  //   v10: <rect class="outer title-state" x="-w/2" y="-h/2" width="w" height="h">
  //   v11: <g class="basic label-container"> with <path> elements (no rect)
  svgElement.querySelectorAll<SVGGElement>('g.node').forEach(g => {
    if (isInsideDefs(g)) return;

    // ── v11 renderer detection ───────────────────────────────────────────────
    // v11 dropped rect in favour of path elements inside g.basic.label-container
    const basicContainer = g.querySelector<SVGGElement>('g.basic');
    if (basicContainer) {
      const outlinePath = basicContainer.querySelector<SVGPathElement>('path');
      if (!outlinePath) return;

      // Dimensions: path is drawn from (-w/2, -h/2) to (w/2, h/2) in local coords.
      // First M command gives the top-left corner: M{-halfW} {-halfH} L...
      const mMatch = (outlinePath.getAttribute('d') || '').match(/^M\s*([-\d.e+]+)\s+([-\d.e+]+)/);
      if (!mMatch) return;
      const width = Math.abs(parseFloat(mMatch[1])) * 2;
      const height = Math.abs(parseFloat(mMatch[2])) * 2;
      if (width <= 0 || height <= 0) return;

      // Center: the node's cumulative transform gives absolute SVG coordinates
      const { x: cx, y: cy } = getCumulativeTransform(g, svgElement);
      // Mermaid renders notes with id="note0", "note1", … and class="node undefined"
      const isNoteNode = /^note\d*$/.test(g.id) || (g.getAttribute('class') || '').includes('note');

      const pathStyle = window.getComputedStyle(outlinePath);
      const validFill = pathStyle.fill && pathStyle.fill !== 'none' && pathStyle.fill !== 'rgb(0, 0, 0)';
      const color = validFill ? pathStyle.fill : (isNoteNode ? '#fffde7' : (isPremium ? '#f8fafc' : '#fff4dd'));
      const stroke = (pathStyle.stroke && pathStyle.stroke !== 'none')
        ? pathStyle.stroke : (isNoteNode ? '#e6c84a' : (isPremium ? '#94a3b8' : '#aaa'));

      // classLines from v11 group structure
      const classLines: ClassLine[] = [];
      const getGroupItems = (selector: string): string[] =>
        Array.from(g.querySelectorAll<SVGForeignObjectElement>(`${selector} foreignObject`))
          .map(fo => fo.textContent?.trim() || '')
          .filter(t => t.length > 0);

      const titleItems = getGroupItems('g.label-group');
      const memberItems = getGroupItems('g.members-group');
      const methodItems = getGroupItems('g.methods-group');

      if (isNoteNode && titleItems.length === 0 && memberItems.length === 0 && methodItems.length === 0) {
        // Note nodes keep their text in a foreignObject (not inside group elements).
        // Use innerHTML → temp div to cross the SVG/HTML namespace boundary reliably.
        const noteText = extractForeignObjectText(g);
        if (noteText) classLines.push({ text: noteText, bold: true });
      } else {
        titleItems.forEach((t, i) => classLines.push({ text: t, bold: i === 0 }));
        classLines.push({ text: '', divider: true });
        memberItems.forEach(t => classLines.push({ text: t }));
        classLines.push({ text: '', divider: true });
        methodItems.forEach(t => classLines.push({ text: t }));
      }

      const label = classLines.find(l => l.bold)?.text || titleItems[0] || '';
      const nodeId = g.id || nextId('class-v11');
      if (!seenIds.has(nodeId)) {
        seenIds.add(nodeId);
        nodes.push({
          id: nodeId, label, type: 'node', shape: 'rect',
          x: cx, y: cy, width, height, color, stroke,
          classLines: classLines.length > 0 ? classLines : undefined,
        });
      }
      return;
    }

    // ── v10 renderer ─────────────────────────────────────────────────────────
    const rect = g.querySelector<SVGRectElement>('rect.outer, rect[class*="outer"]') ||
                 g.querySelector<SVGRectElement>('rect');
    if (!rect) return;

    const geom = rectCenter(rect, svgElement);
    if (geom) {
      const { cx, cy } = geom;

      const { color, stroke } = extractComputedColors(rect, {
        color: isPremium ? '#f8fafc' : '#fff',
        stroke: isPremium ? '#94a3b8' : '#333',
      });

      // ── Extract class lines (title + dividers + members) ─────────────────
      // Mermaid v2 class node (g.label) structure:
      //   Each row is a separate <foreignObject transform="translate(tx, ty)">
      //     <div><span class="nodeLabel">text</span></div>
      //   </foreignObject>
      //   The title foreignObject has class="classTitle".
      //   Dividers are <line class="divider" y1="N" y2="N"> siblings of g.label.
      const classLines: ClassLine[] = [];

      // Collect divider Y positions (local coords, relative to node centre)
      const dividerYs = Array.from(g.querySelectorAll<SVGLineElement>('line.divider'))
        .map(l => parseFloat(l.getAttribute('y1') || '0'))
        .sort((a, b) => a - b);

      // Collect all foreignObjects inside g.label, sorted by their transform Y
      const labelG = g.querySelector<SVGGElement>('g.label');
      if (labelG) {
        const foItems = Array.from(
          labelG.querySelectorAll<SVGForeignObjectElement>('foreignObject')
        )
          .map(fo => {
            const text = fo.querySelector('span, div')?.textContent?.trim() || '';
            const w = parseFloat(fo.getAttribute('width') || '0');
            // Parse translate Y from transform="translate( tx, ty)"
            const tfMatch = (fo.getAttribute('transform') || '').match(
              /translate\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/
            );
            const foY = tfMatch ? parseFloat(tfMatch[2]) : 0;
            const isTitle = fo.classList.contains('classTitle');
            return { text, w, foY, isTitle };
          })
          .filter(item => item.w > 0 && item.text.length > 0)
          .sort((a, b) => a.foY - b.foY);

        // Walk foreignObjects in Y order, inserting divider markers at boundaries
        let divIdx = 0;
        for (const item of foItems) {
          // Insert divider markers for every divider line whose Y < item.foY
          while (divIdx < dividerYs.length && dividerYs[divIdx] < item.foY - 1) {
            if (classLines.length > 0) {
              classLines.push({ text: '', divider: true });
            }
            divIdx++;
          }
          classLines.push({ text: item.text, bold: item.isTitle });
        }
      }

      // Fallback label
      let label = classLines.find(l => l.bold)?.text || classLines[0]?.text || '';
      if (!label) {
        const texts = g.querySelectorAll<SVGTextElement>('text');
        if (texts.length > 0) label = texts[0].textContent?.trim() || '';
      }

      const nodeId = g.id || nextId('class-v2');
      if (!seenIds.has(nodeId)) {
        seenIds.add(nodeId);
        nodes.push({
          id: nodeId,
          label,
          type: 'node',
          shape: 'rect',
          x: cx, y: cy,
          width: geom.width,
          height: geom.height,
          color,
          stroke,
          classLines: classLines.length > 0 ? classLines : undefined,
        });
      }
    }
  });

  // ── v1 renderer: g.classGroup (legacy classDiagram renderer) ─────────────
  // Only run if v2 nodes were not found (avoid double-parsing)
  if (nodes.length === 0) {
    svgElement.querySelectorAll<SVGGElement>('g.classGroup, g.cluster').forEach(g => {
      if (isInsideDefs(g)) return;
      const rect = g.querySelector<SVGRectElement>('rect');
      if (!rect) return;

      const geom = rectCenter(rect, svgElement);
      if (geom) {
        const { color, stroke } = extractComputedColors(rect, {
          color: isPremium ? '#f8fafc' : '#fff',
          stroke: isPremium ? '#94a3b8' : '#333',
        });

        let label = '';
        const texts = g.querySelectorAll<SVGTextElement>('text');
        if (texts.length > 0) label = texts[0].textContent?.trim() || '';

        const nodeId = g.id || nextId('class-v1');
        if (!seenIds.has(nodeId)) {
          seenIds.add(nodeId);
          nodes.push({
            id: nodeId,
            label,
            type: 'node',
            shape: 'rect',
            x: geom.cx, y: geom.cy,
            width: geom.width,
            height: geom.height,
            color,
            stroke,
          });
        }
      }
    });
  }

  return nodes;
};

/** Extract ArrowMarker type from a marker-start/marker-end URL attribute. */
const markerAttrToType = (attr: string | null): ArrowMarker => {
  if (!attr) return 'none';
  // v10: url(#classDiagram-extensionEnd)
  // v11: url(#mermaid-hidden-N_class-extensionEnd)
  const m = attr.match(/(?:classDiagram-|_class-)([\w]+?)(?:Start|End)\)/);
  if (!m) return attr.includes('marker') ? 'default' : 'none';
  switch (m[1]) {
    case 'extension':   return 'extension';
    case 'composition': return 'composition';
    case 'aggregation': return 'aggregation';
    case 'dependency':  return 'dependency';
    default:            return 'default';
  }
};

export const parseClassEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];
  const seenPaths = new Set<string>();

  // ── Node id collection (for fromNodeId/toNodeId border-snapping) ──────────
  // Collect all node ids so edge endpoints can be snapped to exact borders
  // via borderPoint() instead of the fragile fixed MARKER_OVERHANG heuristic.
  const classNodeIds = new Set<string>();
  svgElement.querySelectorAll('g.node, g.classGroup, g.cluster').forEach(g => {
    if (g.id) classNodeIds.add(g.id);
  });

  // Resolve a short class name (e.g. "Duck") to its full node g.id
  // (e.g. "classId-Duck-0") using the dagre-wrapper naming convention.
  const resolveNodeId = (shortId?: string): string | undefined => {
    if (!shortId) return undefined;
    if (classNodeIds.has(shortId)) return shortId;
    const pattern = new RegExp(`^classId-${shortId}-\\d+$`);
    for (const nid of classNodeIds) {
      if (pattern.test(nid)) return nid;
    }
    // Looser fallback: any id ending with "-<shortId>-N"
    for (const nid of classNodeIds) {
      if (nid.includes(`-${shortId}-`)) return nid;
    }
    return undefined;
  };

  // Extract source/target short ids from an edge element:
  //   1. LS-<from> / LE-<to> class names (Mermaid v11 dagre-wrapper)
  //   2. Ancestor <g id="L-<from>-<to>-N"> (same format as flowchart)
  const edgeEndIds = (el: Element): { fromNodeId?: string; toNodeId?: string } => {
    // 1. LS-/LE- class names (some Mermaid versions)
    const cls = el.getAttribute('class') || '';
    const lsMatch = cls.match(/\bLS-(\S+)\b/);
    const leMatch = cls.match(/\bLE-(\S+)\b/);
    if (lsMatch && leMatch) {
      return { fromNodeId: resolveNodeId(lsMatch[1]), toNodeId: resolveNodeId(leMatch[1]) };
    }

    // 2. Element's own id: Mermaid v11 class diagram uses id_<from>_<to>_N
    if (el.id) {
      const mu = el.id.match(/^id_(.+)_(\d+)$/);
      if (mu) {
        const inner = mu[1];
        const sep = inner.indexOf('_');
        if (sep > 0) {
          return {
            fromNodeId: resolveNodeId(inner.slice(0, sep)),
            toNodeId:   resolveNodeId(inner.slice(sep + 1)),
          };
        }
      }
    }

    // 3. Walk ancestors: L-<from>-<to>-N (v10) or L_<from>_<to>_N (v11)
    let g: Element | null = el.parentElement;
    while (g && g.tagName.toLowerCase() !== 'svg') {
      if (g.id) {
        const m = g.id.match(/^L-(.+)-(\d+)$/);
        if (m) {
          const inner = m[1];
          const sep = inner.indexOf('-');
          if (sep > 0) {
            return {
              fromNodeId: resolveNodeId(inner.slice(0, sep)),
              toNodeId:   resolveNodeId(inner.slice(sep + 1)),
            };
          }
        }
        const mu = g.id.match(/^L_(.+)_(\d+)$/);
        if (mu) {
          const inner = mu[1];
          const sep = inner.indexOf('_');
          if (sep > 0) {
            return {
              fromNodeId: resolveNodeId(inner.slice(0, sep)),
              toNodeId:   resolveNodeId(inner.slice(sep + 1)),
            };
          }
        }
      }
      g = g.parentElement;
    }
    return {};
  };

  const addEdge = (el: Element, d: string) => {
    if (!d || d.length <= 10 || seenPaths.has(d) || isInsideDefs(el)) return;
    seenPaths.add(d);

    const style = window.getComputedStyle(el);
    const stroke = (style.stroke && style.stroke !== 'none') ? style.stroke : (isPremium ? '#94a3b8' : '#333');

    // Detect dash pattern from computed style or element class
    const dashArr = style.strokeDasharray;
    let dash: number[] | undefined;
    if (dashArr && dashArr !== 'none' && dashArr !== '0px') {
      const parsed = dashArr.split(',').map(n => parseFloat(n)).filter(v => v > 0);
      if (parsed.length) dash = parsed;
    }
    const cls = el.getAttribute('class') || '';
    if (!dash && (cls.includes('dashed') || cls.includes('dotted') || cls.includes('dashed-line') || cls.includes('dotted-line'))) {
      dash = cls.includes('dotted') ? [2, 2] : [6, 4];
    }

    const arrowEnd = markerAttrToType(el.getAttribute('marker-end'));
    const arrowStart = markerAttrToType(el.getAttribute('marker-start'));
    const hasArrow = arrowEnd !== 'none' || arrowStart !== 'none';

    const { fromNodeId, toNodeId } = edgeEndIds(el);

    edges.push({
      id: nextId('class-edge'),
      pathD: d,
      stroke,
      type: 'link',
      dash,
      hasArrow,
      arrowEnd: arrowEnd !== 'none' ? arrowEnd : undefined,
      arrowStart: arrowStart !== 'none' ? arrowStart : undefined,
      fromNodeId,
      toNodeId,
    });
  };

  svgElement.querySelectorAll<SVGPathElement>('path.relation, line.relation').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'path') {
      const rawD = el.getAttribute('d') || '';
      if (!rawD) return;
      // Apply cumulative transform for el itself (includes its own + all ancestors).
      const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
      addEdge(el, applyTranslateToPathD(rawD, tx, ty));
    } else if (tag === 'line') {
      const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
      const x1 = parseFloat(el.getAttribute('x1') || '0') + tx;
      const y1 = parseFloat(el.getAttribute('y1') || '0') + ty;
      const x2 = parseFloat(el.getAttribute('x2') || '0') + tx;
      const y2 = parseFloat(el.getAttribute('y2') || '0') + ty;
      addEdge(el, `M ${x1} ${y1} L ${x2} ${y2}`);
    }
  });

  return edges;
};

/**
 * Parse class diagram edge labels (relationship names like "runs", "extends")
 * and cardinality terminals ("1", "many", "1..*") as floating SeqLabel objects.
 */
export const parseClassEdgeLabels = (svgElement: SVGSVGElement, isPremium: boolean): SeqLabel[] => {
  const labels: SeqLabel[] = [];
  const textColor = isPremium ? '#475569' : '#1e293b';
  const cardColor = isPremium ? '#64748b' : '#334155';
  const bgColor = isPremium ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.92)';

  // ── Relationship name labels (g.edgeLabel with a transform) ──────────────
  // Each positioned label is a g.edgeLabel with transform="translate(x,y)"
  // It contains a foreignObject > div > span.edgeLabel with the text.
  svgElement.querySelectorAll<SVGGElement>('g.edgeLabel').forEach(g => {
    const tf = g.getAttribute('transform');
    if (!tf) return;
    const m = tf.match(/translate\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (!m) return;
    const lx = parseFloat(m[1]);
    const ly = parseFloat(m[2]);

    // Get text from the first non-empty foreignObject inside this label
    const fo = g.querySelector<SVGForeignObjectElement>('foreignObject[width]');
    if (!fo) return;
    const w = parseFloat(fo.getAttribute('width') || '0');
    if (w <= 0) return;
    const text = fo.textContent?.trim() || '';
    if (!text) return;

    // The foreignObject has its own transform="translate(-w/2, -h/2)" to centre it
    labels.push({
      text,
      x: lx,
      y: ly - 6,   // nudge slightly above the midpoint
      fontSize: 11,
      bold: false,
      color: textColor,
      align: 'center',
      bgColor,
    });
  });

  // ── Cardinality / multiplicity labels (g.edgeTerminals) ──────────────────
  // Each is positioned by its own transform="translate(x,y)"
  svgElement.querySelectorAll<SVGGElement>('g.edgeTerminals').forEach(g => {
    const tf = g.getAttribute('transform');
    if (!tf) return;
    const m = tf.match(/translate\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (!m) return;
    const lx = parseFloat(m[1]);
    const ly = parseFloat(m[2]);
    const text = g.textContent?.trim() || '';
    if (!text) return;

    labels.push({
      text,
      x: lx,
      y: ly,
      fontSize: 10,
      bold: false,
      color: cardColor,
      align: 'center',
      bgColor,
    });
  });

  // ── v1 renderer notes: <g class="note"> with rect + text ─────────────────
  svgElement.querySelectorAll<SVGGElement>('g.note').forEach(g => {
    if (g.classList.contains('node')) return; // v11 notes handled above
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;
    const geom = rectCenter(rect, svgElement);
    if (!geom) return;
    const text = Array.from(g.querySelectorAll<SVGTextElement>('text'))
      .map(t => t.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ');
    if (!text) return;
    labels.push({
      text,
      x: geom.cx,
      y: geom.cy,
      fontSize: 12,
      bold: false,
      color: textColor,
      align: 'center',
    });
  });

  return labels;
};
