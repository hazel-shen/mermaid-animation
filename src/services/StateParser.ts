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

      // Label: v10 uses <g id="cluster-label">, v11 uses <g class="cluster-label">
      const labelHost = g.querySelector('g[id="cluster-label"], g.cluster-label') ?? g;
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

    // 2a. Start / End pseudo-states
    // v10: circle.state-start (+ optional circle.state-end for end state)
    // v11: start still has circle.state-start; end state has NO circle — detect by ID "_end-"
    if (g.id && g.id.includes('_end-')) {
      const { x: cx, y: cy } = getCumulativeTransform(g, svgElement);
      push({
        id: nodeId, label: '',
        type: 'node',
        shape: 'endCircle',
        x: cx, y: cy,
        width: 14, height: 14,
        color: '#1e293b', stroke: '#0f172a',
      });
      return;
    }

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

    // 2b. <<choice>> ─ v10: polygon.state-start; v11: path-based diamond in anonymous <g>
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

    // 2c. <<fork>> / <<join>> ─ v10: rect.fork-join; v11: handled below with path detection
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

    // 2c-v11. <<choice>> / <<fork>> / <<join>> in v11
    // These nodes have class "node statediagram-state" but no g.basic and no rect.
    // The shape is drawn as path elements inside an anonymous child <g>.
    {
      const cls = g.getAttribute('class') || '';
      const hasBasic = !!g.querySelector('g.basic');
      const hasRect = !!g.querySelector('rect');
      const anonG = g.querySelector<SVGGElement>(':scope > g:not([class]):not([id])');
      if (cls.includes('statediagram-state') && !hasBasic && !hasRect && anonG) {
        const firstPath = anonG.querySelector('path');
        const d = firstPath?.getAttribute('d') || '';
        const { x: cx, y: cy } = getCumulativeTransform(g, svgElement);

        // Diamond (<<choice>>): path starts with M0 {halfH} — symmetric diamond
        const diamondMatch = d.match(/^M\s*0\s+([\d.e+]+)/);
        if (diamondMatch) {
          const halfSize = parseFloat(diamondMatch[1]);
          push({
            id: nodeId, label: '', type: 'node', shape: 'diamond',
            x: cx, y: cy, width: halfSize * 1.5, height: halfSize * 1.5,
            color: '#1e293b', stroke: '#0f172a',
          });
          return;
        }

        // Fork/Join: path starts with M{-halfW} {-halfH} and is very wide vs tall (or vice versa)
        const rectMatch = d.match(/^M\s*([-\d.e+]+)\s+([-\d.e+]+)/);
        if (rectMatch) {
          const width = Math.abs(parseFloat(rectMatch[1])) * 2;
          const height = Math.abs(parseFloat(rectMatch[2])) * 2;
          push({
            id: nodeId, label: '', type: 'node', shape: 'forkJoin',
            x: cx, y: cy, width, height,
            color: '#1e293b', stroke: '#0f172a',
          });
          return;
        }
      }
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
  // v10: <g class="statediagram-note"> with <rect class="outer">
  // v11: <g class="node statediagram-note"> with <g class="basic label-container"> > path
  svgElement.querySelectorAll<SVGGElement>('g.statediagram-note, g[class*="statediagram-note"]').forEach(g => {
    try {
      let cx: number, cy: number, width: number, height: number;

      const basicContainer = g.querySelector<SVGGElement>('g.basic');
      if (basicContainer) {
        // v11: path-based geometry, centered at node transform
        const outlinePath = basicContainer.querySelector<SVGPathElement>('path');
        if (!outlinePath) return;
        const mMatch = (outlinePath.getAttribute('d') || '').match(/^M\s*([-\d.e+]+)\s+([-\d.e+]+)/);
        if (!mMatch) return;
        width = Math.abs(parseFloat(mMatch[1])) * 2;
        height = Math.abs(parseFloat(mMatch[2])) * 2;
        if (width <= 0 || height <= 0) return;
        const t = getCumulativeTransform(g, svgElement);
        cx = t.x; cy = t.y;
      } else {
        // v10: rect-based geometry
        const rect = g.querySelector<SVGRectElement>('rect.outer, rect');
        if (!rect) return;
        const geom = bboxCenter(rect as SVGGraphicsElement, svgElement);
        if (!geom) return;
        ({ cx, cy, width, height } = geom);
      }

      push({
        id: g.id || nextId('state-note'),
        label: extractLabel(g),
        type: 'note',
        shape: 'note',
        x: cx, y: cy,
        width, height,
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
