/**
 * StateParser: Parses Mermaid stateDiagram-v2 SVG output.
 *
 * SVG structure (from dagre-wrapper nodes.js + stateRenderer-v2.js):
 *
 * Regular state   → <g class="node default statediagram-state"> <rect>
 * state "X" as S  → same, label from foreignObject/text
 * [*] start       → <g class="node default"> <circle class="state-start">
 * [*] end         → <g class="node default"> <circle class="state-start"> + <circle class="state-end">
 * <<choice>>      → <g class="node default"> <polygon class="state-start"> (diamond)
 * <<fork/join>>   → <g class="node default"> <rect class="fork-join"> (thin bar)
 * note            → <g class="statediagram-note"> <rect class="outer">
 * composite state → <g class="statediagram-state statediagram-cluster"> <rect>
 * Edges           → <path> inside <g class="transition edgePath">
 * Edge labels     → <g class="edgeLabel">
 */
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getCumulativeTransform } from './svgUtils';
import { extractComputedColors, extractEdgeStyle, nextId, applyTranslateToPathD } from '../utils/parser-base';

// ─── helpers ────────────────────────────────────────────────────────────────

const extractLabel = (g: Element): string => {
  const fo = g.querySelector('foreignObject');
  if (fo) return (fo.textContent || '').trim();
  const txt = g.querySelector('text');
  if (!txt) return '';
  const tspans = txt.querySelectorAll('tspan');
  return tspans.length > 0
    ? Array.from(tspans).map(s => s.textContent).join('\n').trim()
    : (txt.textContent || '').trim();
};

const bboxCenter = (el: SVGGraphicsElement, svgElement: SVGSVGElement) => {
  const bbox = el.getBBox();
  if (bbox.width <= 0 && bbox.height <= 0) return null;
  const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
  return {
    cx: tx + bbox.x + bbox.width / 2,
    cy: ty + bbox.y + bbox.height / 2,
    width: bbox.width,
    height: bbox.height,
  };
};

// ─── nodes ──────────────────────────────────────────────────────────────────

export const parseStateNodes = (svgElement: SVGSVGElement, isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];
  const seen = new Set<string>();

  const push = (node: DiagramNode) => {
    if (!seen.has(node.id)) { seen.add(node.id); nodes.push(node); }
  };

  // ── 1. Composite state containers ────────────────────────────────────────
  // Class: "statediagram-state statediagram-cluster" (no standalone "cluster" class)
  svgElement.querySelectorAll<SVGGElement>('g[class*="statediagram-cluster"]').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;
    try {
      const geom = bboxCenter(rect, svgElement);
      if (!geom) return;

      // Label: Mermaid puts it in a child <g id="cluster-label">
      const labelHost = g.querySelector('g[id="cluster-label"]') ?? g;
      const label = extractLabel(labelHost) || g.id || '';

      const { stroke } = extractComputedColors(rect, {
        color: 'rgba(237,233,254,0.2)',
        stroke: isPremium ? '#7c3aed' : '#6d28d9',
      });

      push({
        id: g.id || nextId('state-cluster'),
        label,
        type: 'cluster',
        shape: 'roundRect',
        x: geom.cx, y: geom.cy,
        width: geom.width, height: geom.height,
        color: 'rgba(237,233,254,0.2)',
        stroke,
      });
    } catch { /* skip hidden */ }
  });

  // ── 2. All g.node variants ────────────────────────────────────────────────
  svgElement.querySelectorAll<SVGGElement>('g.node').forEach(g => {
    const nodeId = g.id || nextId('state-node');

    // 2a. Start / End pseudo-states  ─ contain circle.state-start
    const startCircle = g.querySelector<SVGCircleElement>('circle.state-start');
    if (startCircle) {
      const endCircle = g.querySelector<SVGCircleElement>('circle.state-end');
      const r = parseFloat(startCircle.getAttribute('r') || '7');
      const { x: tx, y: ty } = getCumulativeTransform(startCircle, svgElement);
      const cx = tx + parseFloat(startCircle.getAttribute('cx') || '0');
      const cy = ty + parseFloat(startCircle.getAttribute('cy') || '0');
      push({
        id: nodeId, label: '',
        type: 'node',
        shape: endCircle ? 'endCircle' : 'circle',
        x: cx, y: cy,
        width: r * 2, height: r * 2,
        color: '#1e293b', stroke: '#0f172a',
      });
      return;
    }

    // 2b. <<choice>> ─ contains polygon.state-start (diamond)
    const choicePoly = g.querySelector<SVGPolygonElement>('polygon.state-start');
    if (choicePoly) {
      try {
        const geom = bboxCenter(choicePoly, svgElement);
        if (!geom) return;
        push({
          id: nodeId, label: '',
          type: 'node',
          shape: 'diamond',
          x: geom.cx, y: geom.cy,
          width: geom.width, height: geom.height,
          color: '#1e293b', stroke: '#0f172a',
        });
      } catch { /* skip */ }
      return;
    }

    // 2c. <<fork>> / <<join>> ─ contains rect.fork-join (thin bar)
    const forkRect = g.querySelector<SVGRectElement>('rect.fork-join');
    if (forkRect) {
      try {
        const geom = bboxCenter(forkRect, svgElement);
        if (!geom) return;
        push({
          id: nodeId, label: '',
          type: 'node',
          shape: 'forkJoin',
          x: geom.cx, y: geom.cy,
          width: geom.width, height: geom.height,
          color: '#1e293b', stroke: '#0f172a',
        });
      } catch { /* skip */ }
      return;
    }

    // 2d. Regular state box ─ must have statediagram-state in class
    const cls = g.getAttribute('class') || '';
    if (!cls.includes('statediagram')) return;

    const rect = g.querySelector<SVGRectElement>('rect');
    if (!rect) return;
    try {
      const geom = bboxCenter(rect, svgElement);
      if (!geom) return;

      const { color, stroke } = extractComputedColors(rect, {
        color: isPremium ? '#eff6ff' : '#dbeafe',
        stroke: isPremium ? '#3b82f6' : '#2563eb',
      });

      push({
        id: nodeId,
        label: extractLabel(g),
        type: 'node',
        shape: 'roundRect',
        x: geom.cx, y: geom.cy,
        width: geom.width, height: geom.height,
        color, stroke,
      });
    } catch { /* skip */ }
  });

  // ── 3. Notes ──────────────────────────────────────────────────────────────
  // Mermaid renders notes as <g class="statediagram-note"> with <rect class="outer">
  svgElement.querySelectorAll<SVGGElement>('g.statediagram-note, g[class*="statediagram-note"]').forEach(g => {
    const rect = g.querySelector<SVGRectElement>('rect.outer, rect');
    if (!rect) return;
    try {
      const geom = bboxCenter(rect as SVGGraphicsElement, svgElement);
      if (!geom) return;
      push({
        id: g.id || nextId('state-note'),
        label: extractLabel(g),
        type: 'note',
        shape: 'note',
        x: geom.cx, y: geom.cy,
        width: geom.width, height: geom.height,
        color: '#fef3c7', stroke: '#d97706',
      });
    } catch { /* skip */ }
  });

  return nodes;
};

// ─── edges ──────────────────────────────────────────────────────────────────

export const parseStateEdges = (svgElement: SVGSVGElement, isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];
  const seen = new Set<string>();

  svgElement.querySelectorAll('.transition path, .edgePath path, path.transition').forEach(el => {
    const rawD = el.getAttribute('d') || '';
    if (!rawD || rawD.length <= 10) return;

    // Apply cumulative transform so coordinates land in SVG root space
    const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
    const pathD = applyTranslateToPathD(rawD, tx, ty);

    if (seen.has(pathD)) return;
    seen.add(pathD);

    const { stroke, dash } = extractEdgeStyle(el, isPremium);

    edges.push({
      id: nextId('state-edge'),
      pathD,
      stroke,
      type: 'link',
      dash,
      hasArrow: el.getAttribute('marker-end') != null,
      noSnap: true,
    });
  });

  return edges;
};

// ─── edge labels ────────────────────────────────────────────────────────────

export const parseStateEdgeLabels = (svgElement: SVGSVGElement): SeqLabel[] => {
  const labels: SeqLabel[] = [];

  svgElement.querySelectorAll<SVGGElement>('g.edgeLabel').forEach(g => {
    const text = extractLabel(g);
    if (!text) return;

    try {
      const bbox = (g as SVGGraphicsElement).getBBox();
      const ctm = (g as SVGGraphicsElement).getCTM();
      const svgCtm = svgElement.getCTM();
      if (!ctm || !svgCtm) return;
      const m = svgCtm.inverse().multiply(ctm);
      const cx = m.a * (bbox.x + bbox.width / 2) + m.c * (bbox.y + bbox.height / 2) + m.e;
      const cy = m.b * (bbox.x + bbox.width / 2) + m.d * (bbox.y + bbox.height / 2) + m.f;
      labels.push({
        x: cx, y: cy,
        text,
        fontSize: 12,
        bold: false,
        color: '#374151',
        align: 'center',
        bgColor: '#ffffff',
      });
    } catch { /* skip hidden */ }
  });

  return labels;
};
