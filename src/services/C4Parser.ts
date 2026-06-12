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

    const fill = rect.getAttribute('fill') ?? 'none';
    const strokeColor = rect.getAttribute('stroke') ?? '#888888';

    nodes.push({
      id: parentG.id || nextId('c4-boundary'),
      // Boundary title is rendered as a positioned label (parseC4NodeLabels)
      // at its original SVG spot, matching Mermaid's own layout.
      label: '',
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

    // Person icon: capture the 48×48 <image> box so the canvas silhouette is
    // drawn exactly where Mermaid placed the PNG (between <<type>> and name).
    let c4IconBox: DiagramNode['c4IconBox'];
    const image = g.querySelector<SVGImageElement>('image');
    if (image) {
      const iw = parseFloat(image.getAttribute('width') || '0');
      const ih = parseFloat(image.getAttribute('height') || '0');
      if (iw > 0 && ih > 0) {
        const { x: itx, y: ity } = getCumulativeTransform(image, svgElement);
        c4IconBox = {
          x: itx + parseFloat(image.getAttribute('x') || '0'),
          y: ity + parseFloat(image.getAttribute('y') || '0'),
          width: iw,
          height: ih,
        };
      }
    }

    nodes.push({
      id: g.id || nextId('c4'),
      // All element text (name / <<type>> / description) is rendered as
      // positioned labels (parseC4NodeLabels) at the original SVG spots,
      // matching Mermaid's top-down text stacking inside the shape.
      label: '',
      type: 'node',
      shape,
      x: cx,
      y: cy,
      width,
      height,
      color,
      stroke,
      // C4 colors are semantic (person / system / external) and always pair a
      // saturated or dark fill with white text — keep them on dark canvases
      // instead of letting the luminance-based dark theme rewrite some of them.
      preserveColor: true,
      ...(c4IconBox ? { c4IconBox } : {}),
    });
  });

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
      // Mermaid paints C4 rels AFTER the shapes (svgDraw.drawRels runs last),
      // so lines that cross other boxes stay visible — mirror that paint order.
      aboveNodes: true,
    });
  };

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

  return edges;
};

// ── Node / boundary text labels ──────────────────────────────────────────────

/**
 * Custom text color set by UpdateRelStyle($textColor) / UpdateElementStyle($fontColor).
 * Mermaid writes it as a fill attribute on the <text>; returns '' for the
 * defaults (#444444 rel text, #FFFFFF element text) so callers can apply
 * their own default treatment.
 */
const customFill = (t: SVGTextElement, defaults: string[]): string => {
  const fill = (t.getAttribute('fill') ?? '').trim().toLowerCase();
  if (!fill || fill === 'none' || defaults.includes(fill)) return '';
  return fill;
};

/** Measures a text element and pushes a positioned SeqLabel; no-op if unmeasurable. */
const pushTextLabel = (
  labels: SeqLabel[],
  t: SVGTextElement,
  svgElement: SVGSVGElement,
  styleOf: (s: CSSStyleDeclaration) => { color: string; bold: boolean },
) => {
  const text = t.textContent?.trim() ?? '';
  if (!text) return;
  try {
    const bbox = (t as SVGGraphicsElement).getBBox();
    if (bbox.width <= 0) return;
    const { x: tx, y: ty } = getCumulativeTransform(t, svgElement);
    const style = window.getComputedStyle(t);
    const { color, bold } = styleOf(style);
    labels.push({
      x: tx + bbox.x + bbox.width  / 2,
      y: ty + bbox.y + bbox.height / 2,
      text,
      fontSize: Math.min(parseFloat(style.fontSize) || 11, 14),
      bold,
      color,
      align: 'center',
    });
  } catch {
    // skip unmeasurable elements
  }
};

/**
 * Extracts all element texts (bold name, <<type>>, description) and boundary
 * titles at their actual SVG positions.
 *
 * Mermaid stacks element text top-down inside each shape (name is NOT
 * vertically centred), so every text — including the bold name — is emitted
 * as a positioned label rather than drawn by drawNodeLabel at the node centre.
 */
export const parseC4NodeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  // Element texts: white on the colored shape, like Mermaid's default fontColor.
  // UpdateElementStyle($fontColor) overrides are picked up from the fill attr.
  svgElement.querySelectorAll<SVGGElement>('g.person-man').forEach(g => {
    Array.from(g.querySelectorAll<SVGTextElement>('text')).forEach(t => {
      const custom = customFill(t, ['#ffffff', '#fff', 'white', 'rgb(255,255,255)']);
      pushTextLabel(labels, t, svgElement, style => {
        const bold = (parseFloat(style.fontWeight) || 400) >= 600;
        const italic = style.fontStyle === 'italic';
        return {
          bold,
          color: custom || (bold
            ? 'rgba(255,255,255,1)'
            : italic
              ? 'rgba(255,255,255,0.65)'
              : 'rgba(255,255,255,0.9)'),
        };
      });
    });
  });

  // Boundary titles: bold dark text near the top of the dashed box
  const seenBoundary = new Set<Element>();
  svgElement.querySelectorAll<SVGRectElement>('rect[stroke-dasharray]').forEach(rect => {
    if (insidePersonMan(rect)) return;
    const parentG = rect.parentElement;
    if (!parentG || seenBoundary.has(parentG)) return;
    seenBoundary.add(parentG);
    Array.from(parentG.querySelectorAll<SVGTextElement>(':scope > text')).forEach(t => {
      pushTextLabel(labels, t, svgElement, () => ({ bold: true, color: '#444444' }));
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
      // UpdateRelStyle($textColor) — Mermaid writes it as the fill attr;
      // the default #444444 falls through to our standard greys.
      const custom = customFill(t, ['#444444', 'rgb(68,68,68)']);
      labels.push({
        x: cx,
        y: cy,
        text,
        fontSize,
        bold: isBold,
        color: custom || (isItalic ? '#888888' : '#333333'),
        align: 'center',
        // Subtle halo just strong enough to lift the text off the line —
        // dark mode swaps this centrally (luminance-based) in drawFrame.
        bgColor: 'rgba(255,255,255,0.5)',
      });
    } catch {
      // skip elements that can't be measured (e.g. hidden)
    }
  });

  return labels;
};
