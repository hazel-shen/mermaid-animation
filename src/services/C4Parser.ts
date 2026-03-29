import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import {
  lineToPathD,
  extractEdgeStyle,
  extractComputedColors,
  rectCenter,
  applyTranslateToPathD,
  nextId,
} from '../utils/parser-base';

// ── helpers ───────────────────────────────────────────────────────────────────

/** True if el is a descendant of any g.person-man (C4 element node) */
const insidePersonMan = (el: Element): boolean => !!el.closest('g.person-man');

/** True if el is a direct child of a boundary group (rect with stroke-dasharray sibling) */
const insideBoundaryGroup = (el: Element): boolean => {
  const parentG = el.parentElement;
  if (!parentG) return false;
  return !!parentG.querySelector(':scope > rect[stroke-dasharray]');
};

// ── Nodes ─────────────────────────────────────────────────────────────────────

/**
 * Parses C4 diagram nodes from Mermaid-rendered SVG.
 *
 * Mermaid C4 SVG structure:
 * - All C4 elements (Person, System, Container, etc.) → <g class="person-man">
 *   - Person/Person_Ext: contains <image> + <rect>
 *   - SystemDb / ContainerDb: contains 2+ <path> elements (cylinder)
 *   - Others (System, Container, Component): contains <rect>
 * - Boundaries (Enterprise_Boundary, System_Boundary, etc.): unnamed <g>
 *   containing <rect stroke-dasharray="...">
 *
 * Returns boundaries first (rendered as cluster background layer), then elements.
 */
export const parseC4Nodes = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // --- 1. Boundaries → cluster nodes (background layer) --------------------
  const seenBoundary = new Set<Element>();

  svgElement.querySelectorAll<SVGRectElement>('rect[stroke-dasharray]').forEach(rect => {
    if (insidePersonMan(rect)) return;

    const parentG = rect.parentElement;
    if (!parentG || seenBoundary.has(parentG)) return;
    seenBoundary.add(parentG);

    // Read dimensions from SVG attributes directly
    const bw = parseFloat(rect.getAttribute('width') || '0');
    const bh = parseFloat(rect.getAttribute('height') || '0');
    const bx = parseFloat(rect.getAttribute('x') || '0');
    const by = parseFloat(rect.getAttribute('y') || '0');
    if (bw <= 0 || bh <= 0) return;
    const { x: btx, y: bty } = getCumulativeTransform(rect, svgElement);

    // Boundary title: first direct-child text element
    const label = Array.from(parentG.querySelectorAll<SVGTextElement>(':scope > text'))
      .map(t => t.textContent?.trim() ?? '')
      .find(Boolean) ?? '';

    const fill = rect.getAttribute('fill') ?? 'none';
    const strokeColor = rect.getAttribute('stroke') ?? '#888888';

    nodes.push({
      id: parentG.id || nextId('c4-boundary'),
      label,
      type: 'cluster',
      shape: 'rect',
      x: btx + bx + bw / 2,
      y: bty + by + bh / 2,
      width: bw,
      height: bh,
      color: fill === 'none' ? 'rgba(128,128,128,0.04)' : fill,
      stroke: strokeColor,
    });
  });

  // --- 2. C4 elements → regular nodes --------------------------------------
  svgElement.querySelectorAll<SVGGElement>('g.person-man').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    const hasImage = !!g.querySelector('image');
    // Direct-child paths only (avoids nested group path conflicts)
    const directPaths = Array.from(g.querySelectorAll<SVGPathElement>(':scope > path'));

    // Shape detection:
    //   Person / Person_Ext → c4Person (box + person silhouette icon)
    //   SystemDb / ContainerDb → cylinder (2+ direct paths, no rect)
    //   Everything else (System, Container, Component) → roundRect
    let shape: DiagramNode['shape'];
    if (hasImage) {
      shape = 'c4Person';
    } else if (directPaths.length >= 2 && !rect) {
      shape = 'cylinder';
    } else {
      shape = 'roundRect';
    }

    // Read rect dimensions directly from SVG attributes to avoid getBBox()
    // returning unexpected values (e.g. when the rect is inside a transformed group).
    // Fall back to the first path element for cylinder shapes.
    let cx: number, cy: number, width: number, height: number;

    if (rect) {
      const rw = parseFloat(rect.getAttribute('width') || '0');
      const rh = parseFloat(rect.getAttribute('height') || '0');
      const rx = parseFloat(rect.getAttribute('x') || '0');
      const ry = parseFloat(rect.getAttribute('y') || '0');
      if (rw <= 0 || rh <= 0) return;
      const { x: tx, y: ty } = getCumulativeTransform(rect, svgElement);
      cx = tx + rx + rw / 2;
      cy = ty + ry + rh / 2;
      width = rw;
      height = rh;
    } else if (directPaths.length > 0) {
      const geom = rectCenter(directPaths[0] as SVGGraphicsElement, svgElement);
      if (!geom) return;
      ({ cx, cy, width, height } = geom);
    } else {
      return;
    }

    // Colors from the rect or first path
    const colorEl = (rect ?? directPaths[0]) as Element;
    const defaultFill = '#1168bd';
    const { color, stroke } = extractComputedColors(colorEl, { color: defaultFill, stroke: '#073b6f' });

    // Label: prefer bold text (the element name), fall back to first text
    const allTexts = Array.from(g.querySelectorAll<SVGTextElement>('text'));
    let label = '';
    for (const t of allTexts) {
      const fw = parseFloat(window.getComputedStyle(t).fontWeight) || 400;
      if (fw >= 600) { label = t.textContent?.trim() ?? ''; break; }
    }
    if (!label) label = allTexts[0]?.textContent?.trim() ?? '';

    nodes.push({
      id: g.id || nextId('c4'),
      label,
      type: 'node',
      shape,
      x: cx,
      y: cy,
      width,
      height,
      color,
      stroke,
    });
  });

  console.log('[C4Parser] nodes parsed:', nodes.length, nodes.map(n => ({ id: n.id, label: n.label, shape: n.shape, x: n.x, y: n.y, w: n.width, h: n.height })));
  return nodes;
};

// ── Edges ─────────────────────────────────────────────────────────────────────

/**
 * Parses C4 relationship lines from Mermaid-rendered SVG.
 *
 * Mermaid renders relationships as:
 * - <line marker-end="..."> for the first Rel()
 * - <path marker-end="..."> for subsequent Rel() / BiRel() (quadratic Bézier)
 *
 * BiRel() additionally sets marker-start for the reverse arrowhead.
 */
export const parseC4Edges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  const pushEdge = (pathD: string, el: Element, hasStart: boolean) => {
    const { stroke, dash } = extractEdgeStyle(el, isPremium);
    edges.push({
      id: nextId('c4-edge'),
      pathD,
      stroke,
      type: 'link',
      dash,
      hasArrow: true,
      arrowEnd: 'default',
      arrowStart: hasStart ? 'default' : undefined,
      // Mermaid already ends paths at node borders; skip border-snap so
      // arrowheads stay at the SVG endpoint (not pushed inside the node box).
      noSnap: true,
    });
  };

  // Debug: log all lines and paths with their marker attributes
  const allLines = Array.from(svgElement.querySelectorAll<SVGLineElement>('line'));
  const allPaths = Array.from(svgElement.querySelectorAll<SVGPathElement>('path'));
  console.log('[C4Parser] lines found:', allLines.length);
  allLines.forEach((l, i) => {
    console.log(`  line[${i}] marker-end="${l.getAttribute('marker-end')}" marker-start="${l.getAttribute('marker-start')}" insidePersonMan=${insidePersonMan(l)} x1=${l.getAttribute('x1')} y1=${l.getAttribute('y1')} x2=${l.getAttribute('x2')} y2=${l.getAttribute('y2')}`);
  });
  console.log('[C4Parser] paths found:', allPaths.length);
  allPaths.forEach((p, i) => {
    console.log(`  path[${i}] marker-end="${p.getAttribute('marker-end')}" marker-start="${p.getAttribute('marker-start')}" insidePersonMan=${insidePersonMan(p)} d="${p.getAttribute('d')?.slice(0, 40)}"`);
  });

  // <line> elements with marker — first Rel() in the diagram
  svgElement.querySelectorAll<SVGLineElement>('line').forEach(line => {
    if (insidePersonMan(line)) return;
    const hasEnd   = !!line.getAttribute('marker-end');
    const hasStart = !!line.getAttribute('marker-start');
    if (!hasEnd && !hasStart) return;
    pushEdge(lineToPathD(line, svgElement), line, hasStart);
  });

  // <path> elements with marker — subsequent / curved relationships
  svgElement.querySelectorAll<SVGPathElement>('path').forEach(path => {
    if (insidePersonMan(path)) return;
    const hasEnd   = !!path.getAttribute('marker-end');
    const hasStart = !!path.getAttribute('marker-start');
    if (!hasEnd && !hasStart) return;
    const d = path.getAttribute('d') ?? '';
    if (d.length <= 5) return;
    const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
    pushEdge(applyTranslateToPathD(d, tx, ty), path, hasStart);
  });

  console.log('[C4Parser] edges parsed:', edges.length, edges);
  return edges;
};

// ── Snap edges to node borders ────────────────────────────────────────────────

/**
 * Attach fromNodeId / toNodeId to each C4 edge by matching path endpoints
 * to the nearest node. This lets drawEdge snap arrowheads to the exact node
 * border instead of drawing them at the raw SVG coordinates (which would be
 * covered by the node box drawn on top).
 */
export const snapC4EdgesToNodes = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  const nonCluster = nodes.filter(n => n.type !== 'cluster');
  if (nonCluster.length === 0) return edges;

  const nearest = (x: number, y: number): DiagramNode =>
    nonCluster.reduce((best, n) =>
      Math.hypot(n.x - x, n.y - y) < Math.hypot(best.x - x, best.y - y) ? n : best
    );

  const startPt = (d: string) => {
    const m = d.match(/M\s*([-+]?[\d.e]+)[,\s]+([-+]?[\d.e]+)/i);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  };
  const endPt = (d: string) => {
    const m = d.match(/[MLCSQTA][^MLCSQTAZHV]*$/i);
    if (!m) return null;
    const nums = [...m[0].matchAll(/[-+]?[\d.]+(?:e[-+]?\d+)?/g)].map(n => parseFloat(n[0]));
    return nums.length >= 2 ? { x: nums[nums.length - 2], y: nums[nums.length - 1] } : null;
  };

  return edges.map(edge => {
    const sp = startPt(edge.pathD);
    const ep = endPt(edge.pathD);
    return {
      ...edge,
      fromNodeId: sp ? nearest(sp.x, sp.y).id : undefined,
      toNodeId:   ep ? nearest(ep.x, ep.y).id : undefined,
    };
  });
};

// ── Node type / description labels ───────────────────────────────────────────

/**
 * Extracts the type label (e.g. <<person>>, <<system>>) and description text
 * from each C4 element, using their actual SVG positions for accurate placement.
 *
 * The bold name text is already rendered as the node label by drawNode, so
 * only non-bold text elements are emitted here.
 */
export const parseC4NodeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.person-man').forEach(g => {
    // Person nodes (have <image>): render non-bold text (<<person>>, description)
    // at SVG positions. Bold name is drawn directly in the c4Person canvas block
    // so it stays anchored below the icon figure.
    // Non-person nodes: skip bold name (drawNodeLabel handles it).
    Array.from(g.querySelectorAll<SVGTextElement>('text')).forEach(t => {
      const text = t.textContent?.trim() ?? '';
      if (!text) return;

      const style = window.getComputedStyle(t);
      const fw = parseFloat(style.fontWeight) || 400;
      const isBold = fw >= 600;

      // Skip bold name for all nodes: non-person nodes use drawNodeLabel,
      // person nodes draw the name in the canvas c4Person block.
      if (isBold) return;

      try {
        const bbox = (t as SVGGraphicsElement).getBBox();
        if (bbox.width <= 0) return;
        const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
        const cx = tx + bbox.x + bbox.width  / 2;
        const cy = ty + bbox.y + bbox.height / 2;

        const isItalic = style.fontStyle === 'italic';
        const fontSize = Math.min(parseFloat(style.fontSize) || 11, 14);
        const color = isBold
          ? 'rgba(255,255,255,1)'
          : isItalic
            ? 'rgba(255,255,255,0.65)'
            : 'rgba(255,255,255,0.9)';

        labels.push({
          x: cx,
          y: cy,
          text,
          fontSize,
          bold: isBold,
          color,
          align: 'center',
        });
      } catch {
        // skip unmeasurable elements
      }
    });
  });

  return labels;
};

// ── Edge labels ───────────────────────────────────────────────────────────────

/**
 * Parses text labels attached to C4 relationship lines.
 *
 * Excludes:
 * - Text inside g.person-man (element titles / descriptions)
 * - Text inside boundary groups (boundary titles already shown on cluster nodes)
 */
export const parseC4EdgeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGTextElement>('text').forEach(t => {
    if (insidePersonMan(t)) return;
    if (insideBoundaryGroup(t)) return;

    const text = t.textContent?.trim() ?? '';
    if (!text) return;

    try {
      const bbox = (t as SVGGraphicsElement).getBBox();
      if (bbox.width <= 0) return;
      const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
      const cx = tx + bbox.x + bbox.width  / 2;
      const cy = ty + bbox.y + bbox.height / 2;
      const tStyle = window.getComputedStyle(t);
      const isItalic = tStyle.fontStyle === 'italic';
      const isBold = parseFloat(tStyle.fontWeight) >= 600;
      const fontSize = Math.min(parseFloat(tStyle.fontSize) || 11, 20);
      labels.push({
        x: cx,
        y: cy,
        text,
        fontSize,
        bold: isBold,
        color: isItalic ? '#888888' : '#333333',
        align: 'center',
        bgColor: 'rgba(255,255,255,0.85)',
      });
    } catch {
      // skip elements that can't be measured (e.g. hidden)
    }
  });

  return labels;
};
