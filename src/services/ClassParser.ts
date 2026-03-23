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
  //   <rect class="outer title-state" x="-w/2" y="-h/2" width="w" height="h">
  svgElement.querySelectorAll<SVGGElement>('g.node').forEach(g => {
    if (isInsideDefs(g)) return;

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
  const m = attr.match(/classDiagram-([\w]+)(Start|End)\)/);
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

    edges.push({
      id: nextId('class-edge'),
      pathD: d,
      stroke,
      type: 'link',
      dash,
      hasArrow,
      arrowEnd: arrowEnd !== 'none' ? arrowEnd : undefined,
      arrowStart: arrowStart !== 'none' ? arrowStart : undefined,
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

  return labels;
};
