/**
 * MindmapParser: Parses Mermaid 11 mindmap SVG output.
 *
 * Mermaid 11 mindmaps use the unified cose-bilkent layout renderer.
 * Each node `g.mindmap-node` has a transform="translate(cx, cy)" — the origin IS the node center.
 *
 * Root node structure:
 *   <g class="node mindmap-node section-root section--1" id="node_0" transform="translate(cx, cy)">
 *     <circle class="basic label-container" r="42" cx="0" cy="0"/>
 *     <g class="label">...</g>
 *
 * Branch/leaf node structure (uses "rounded" Mermaid shape):
 *   <g class="node mindmap-node section-N" id="node_N" transform="translate(cx, cy)">
 *     <path class="node-bkg node-N" d="M-36 12 v-24 q0,-5 5,-5 h62 q5,0 5,5 ..."/>
 *     <line class="node-line-"/>
 *     <g class="label"><rect/><foreignObject width="W" height="H"><span class="nodeLabel">text</span>
 *
 * Edges in <g class="edgePaths"> as <path class="... edge section-edge-N edge-depth-D" d="..."/>
 */
import type { DiagramNode, DiagramEdge } from '../types';
import { extractComputedStroke, rectCenter, nextId } from '../utils/parser-base';
import { getCumulativeTransform } from './svgUtils';
import { applyTranslateToPathD } from '../utils/parser-base';

// Muted palette — replaces Mermaid's neon section colours.
// Each entry: [fill, stroke] where stroke is a ~20% darker shade of fill.
const SECTION_PALETTE: [string, string][] = [
  ['#c4b5fd', '#7c3aed'], // section-0  soft violet
  ['#a5f3fc', '#0e7490'], // section-1  soft cyan
  ['#bbf7d0', '#15803d'], // section-2  soft green
  ['#fde68a', '#b45309'], // section-3  soft amber
  ['#fca5a5', '#b91c1c'], // section-4  soft rose
  ['#bfdbfe', '#1d4ed8'], // section-5  soft blue
  ['#d9f99d', '#4d7c0f'], // section-6  soft lime
  ['#f5d0fe', '#9333ea'], // section-7  soft purple
];
const ROOT_PALETTE: [string, string] = ['#1e3a8a', '#1e40af']; // dark navy

/**
 * Classify a Mermaid mindmap path `d` string into a canvas shape type.
 *
 * Mermaid 11 path signatures (all relative-arc based, starting with "M0 0"):
 * - roundRect: uses q/v/h (no arcs)
 * - cloud:     15 arcs, all with the SAME radius value
 * - bang:      10 arcs, with TWO alternating radius values (large/small)
 */
const classifyMindmapPath = (d: string): DiagramNode['shape'] => {
  if (!d.trimStart().startsWith('M0')) return 'roundRect';

  // Extract all arc rx values from "a rx,ry ..." tokens
  const arcMatches = [...d.matchAll(/a\s*([\d.]+),([\d.]+)/g)];
  if (arcMatches.length === 0) return 'roundRect';

  const radii = arcMatches.map(m => parseFloat(m[1]));
  const uniqueRadii = new Set(radii.map(r => r.toFixed(2)));

  // cloud: many arcs (≥12) sharing at most 2 unique radii (floating-point rounding
  //        may produce 2 values for what is conceptually one radius).
  // bang:  few arcs (≤12) with ≥2 distinct radii (large outer + small inner tips).
  //
  // Overlap case: uniqueRadii.size===2 && radii.length===12 satisfies both conditions.
  // cloud is checked first intentionally — a 12-arc path with 2 radii is much more
  // likely to be cloud rounding noise than a coincidentally even-count bang shape.
  if (uniqueRadii.size <= 2 && radii.length >= 12) return 'cloud';
  if (uniqueRadii.size >= 2 && radii.length <= 12) return 'bang';
  return 'roundRect';
};

// Extract label text from a node group
const extractLabel = (g: Element): string => {
  // Try span.nodeLabel (Mermaid 11 mindmap with htmlLabels)
  const nodeLabel = g.querySelector('.nodeLabel');
  if (nodeLabel) return nodeLabel.textContent?.trim() || '';
  // Try foreignObject inner text
  const fo = g.querySelector('foreignObject');
  if (fo) return fo.textContent?.trim() || '';
  // SVG text fallback
  const txt = g.querySelector('text');
  if (txt) return txt.textContent?.trim() || '';
  return '';
};

export const parseMindmapNodes = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramNode[] => {
  const nodes: DiagramNode[] = [];

  // Mermaid 11: all mindmap nodes carry the class "mindmap-node"
  const nodeGroups = Array.from(svgElement.querySelectorAll<SVGGElement>('g.mindmap-node'));

  nodeGroups.forEach(g => {
    const isRoot = g.classList.contains('section-root') || g.classList.contains('section--1');

    let geomEl: SVGGraphicsElement | null = null;
    let isCircle = false;
    let shape: DiagramNode['shape'] = 'roundRect';

    if (isRoot) {
      // Root: circle.basic.label-container
      const circleEl = g.querySelector<SVGGraphicsElement>('circle, ellipse');
      if (circleEl) {
        geomEl = circleEl;
        isCircle = true;
        shape = 'circle';
      } else {
        geomEl = g.querySelector<SVGGraphicsElement>('rect, path.node-bkg');
      }
    } else {
      // Primary: use Mermaid's node-<shape> class on the <g> to determine shape.
      // Mermaid 11 emits classes like: node-cloud, node-bang, node-rect,
      // node-rounded-rect, node-circle, node-hexagon on each mindmap-node <g>.
      const classList = Array.from(g.classList);
      const hasNodeClass = (c: string) => classList.includes(c);

      if (hasNodeClass('node-cloud')) {
        shape = 'cloud';
        geomEl = g.querySelector<SVGGraphicsElement>('path, ellipse, rect, circle') ?? g;
      } else if (hasNodeClass('node-bang')) {
        shape = 'bang';
        geomEl = g.querySelector<SVGGraphicsElement>('path, ellipse, rect, circle') ?? g;
      } else if (hasNodeClass('node-hexagon')) {
        shape = 'hexagon';
        geomEl = g.querySelector<SVGGraphicsElement>('polygon, path') ?? g;
      } else if (hasNodeClass('node-rect')) {
        shape = 'rect';
        geomEl = g.querySelector<SVGGraphicsElement>('rect, path') ?? g;
      } else if (hasNodeClass('node-circle')) {
        shape = 'circle';
        isCircle = true;
        geomEl = g.querySelector<SVGGraphicsElement>('circle, ellipse') ?? g;
      } else {
        // No node-<shape> class — fall back to SVG element inspection.
        const circleEl = g.querySelector<SVGGraphicsElement>('circle.label-container, ellipse.label-container');
        if (circleEl) {
          geomEl = circleEl; isCircle = true; shape = 'circle';
        } else {
          const rectEl = g.querySelector<SVGGraphicsElement>('rect.label-container');
          if (rectEl) {
            geomEl = rectEl; shape = 'rect';
          } else {
            const polygonEl = g.querySelector<SVGGraphicsElement>('polygon.label-container');
            if (polygonEl) {
              geomEl = polygonEl; shape = 'hexagon';
            } else {
              const pathEl = g.querySelector<SVGGraphicsElement>('path.node-bkg, path[class*="node-bkg"]')
                ?? g.querySelector<SVGGraphicsElement>('path');
              geomEl = pathEl ?? g.querySelector<SVGGraphicsElement>('circle, ellipse, rect, polygon') ?? g;
              if (pathEl) {
                const d = pathEl.getAttribute('d') || '';
                shape = classifyMindmapPath(d);
              } else {
                shape = 'roundRect';
              }
            }
          }
        }
      }
    }

    if (!geomEl) return;

    // Cloud/bang: the path starts at M0 0 (local coords) and the <g> translate is
    // the node's anchor. The path BBox is asymmetric, so we derive size from the
    // <g>'s full BBox (includes label) and centre from the <g> translate.
    let geom = rectCenter(geomEl as SVGGraphicsElement, svgElement);
    if (shape === 'cloud' || shape === 'bang') {
      try {
        const { x: gx, y: gy } = getCumulativeTransform(g, svgElement);
        const pathEl = geomEl.tagName.toLowerCase() === 'path' ? geomEl : g.querySelector('path');
        const pathBBox = pathEl ? (pathEl as SVGGraphicsElement).getBBox() : g.getBBox();
        // gBBox is symmetric around the g's translate origin (gBBox.x ≈ -width/2),
        // so gx + gBBox.x + width/2 = gx. Centre = (gx, gy).
        // pathBBox.width/height already scales with label length — use directly.
        geom = {
          cx: gx,
          cy: gy,
          width:  pathBBox.width,
          height: pathBBox.height,
        };
      } catch { /* hidden element — keep existing geom */ }
    }
    if (!geom) {
      try {
        const bbox = g.getBBox();
        const { x: tx, y: ty } = getCumulativeTransform(g, svgElement);
        geom = {
          cx: tx + bbox.x + bbox.width / 2,
          cy: ty + bbox.y + bbox.height / 2,
          width: Math.max(bbox.width, 60),
          height: Math.max(bbox.height, 40),
        };
      } catch { /* hidden element — skip */ }
    }
    if (!geom) return;

    // Determine section index from class list (section-0, section-1, …)
    // Ignore isPremium — mindmap always uses the muted palette.
    let color: string;
    let stroke: string;
    if (isRoot) {
      [color, stroke] = ROOT_PALETTE;
    } else {
      const match = Array.from(g.classList).find(c => /^section-\d+$/.test(c));
      const idx = match ? parseInt(match.replace('section-', ''), 10) : 0;
      [color, stroke] = SECTION_PALETTE[idx % SECTION_PALETTE.length];
    }

    const label = extractLabel(g);
    const finalShape = isRoot ? (isCircle ? 'circle' : shape) : shape;

    nodes.push({
      id: g.id || nextId('mindmap'),
      label,
      type: 'node',
      shape: finalShape,
      x: geom.cx,
      y: geom.cy,
      width: geom.width,
      height: geom.height,
      color,
      stroke,
      preserveColor: true,
    });
  });

  return nodes;
};

/**
 * After both nodes and edges are parsed, snap each edge endpoint to the nearest
 * node by filling in fromNodeId / toNodeId. This lets drawEdge do proper border
 * snapping for cloud/bang/circle shapes instead of drawing into the node centre.
 */
export const snapMindmapEdgesToNodes = (
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): DiagramEdge[] => {
  if (nodes.length === 0) return edges;

  // Extract the endpoint from a path d string.
  // Strategy: find the last path command that carries an absolute x,y endpoint
  // (M L C S Q T A), then take the last two numbers within that command segment.
  // This avoids mis-reading single-coordinate commands (H/V) or arc parameters
  // (rx ry x-rotation large-arc sweep) as x,y pairs.
  const endPoint = (d: string): { x: number; y: number } | null => {
    const m = d.match(/[MLCSQTA][^MLCSQTAZHV]*$/i);
    if (!m) return null;
    const nums = [...m[0].matchAll(/[-+]?[\d.]+(?:e[-+]?\d+)?/g)].map(n => parseFloat(n[0]));
    if (nums.length < 2) return null;
    return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
  };
  const startPoint = (d: string): { x: number; y: number } | null => {
    const m = d.match(/M\s*([-+]?[\d.e]+)\s+([-+]?[\d.e]+)/i);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  };
  const nearest = (pt: { x: number; y: number }): DiagramNode =>
    nodes.reduce((best, n) => {
      const d = Math.hypot(n.x - pt.x, n.y - pt.y);
      const bd = Math.hypot(best.x - pt.x, best.y - pt.y);
      return d < bd ? n : best;
    });

  return edges.map(edge => {
    const sp = startPoint(edge.pathD);
    const ep = endPoint(edge.pathD);
    const fromNode = sp ? nearest(sp) : null;
    const toNode   = ep ? nearest(ep) : null;
    return {
      ...edge,
      fromNodeId: fromNode?.id,
      toNodeId:   toNode?.id,
      noSnap: false,
    };
  });
};

export const parseMindmapEdges = (svgElement: SVGSVGElement, _isPremium: boolean): DiagramEdge[] => {
  const edges: DiagramEdge[] = [];

  // Mermaid 11: edges are paths with class "edge" inside g.edgePaths
  const edgePathsContainer = svgElement.querySelector('g.edgePaths');

  if (edgePathsContainer) {
    edgePathsContainer.querySelectorAll<SVGPathElement>('path').forEach(path => {
      const d = path.getAttribute('d') || '';
      if (!d || d.length <= 5) return;

      // Apply any ancestor transforms
      const { x: tx, y: ty } = getCumulativeTransform(path, svgElement);
      const pathD = applyTranslateToPathD(d, tx, ty);

      // Derive stroke from section class on the path (section-edge-N)
      const sectionMatch = Array.from(path.classList).find(c => /^section-edge-\d+$/.test(c));
      const sectionIdx = sectionMatch ? parseInt(sectionMatch.replace('section-edge-', ''), 10) : 0;
      const stroke = SECTION_PALETTE[sectionIdx % SECTION_PALETTE.length][1];

      edges.push({
        id: path.id || nextId('mindmap-edge'),
        pathD,
        stroke,
        type: 'link',
        hasArrow: false,
        noSnap: true,
      });
    });
  }

  // Legacy / fallback selectors
  if (edges.length === 0) {
    svgElement.querySelectorAll<SVGPathElement>('path.edge, path[class*="mindmap"], path.mindmap-edge').forEach(path => {
      const d = path.getAttribute('d') || '';
      if (!d || d.length <= 5) return;
      const stroke = extractComputedStroke(path, SECTION_PALETTE[0][1]);
      edges.push({
        id: nextId('mindmap-edge'),
        pathD: d,
        stroke,
        type: 'link',
        hasArrow: false,
        noSnap: true,
      });
    });

    svgElement.querySelectorAll<SVGLineElement>('line').forEach(line => {
      const rawX1 = parseFloat(line.getAttribute('x1') || '0');
      const rawY1 = parseFloat(line.getAttribute('y1') || '0');
      const rawX2 = parseFloat(line.getAttribute('x2') || '0');
      const rawY2 = parseFloat(line.getAttribute('y2') || '0');
      if (Math.hypot(rawX2 - rawX1, rawY2 - rawY1) < 10) return;
      const stroke = extractComputedStroke(line, SECTION_PALETTE[0][1]);
      const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
      edges.push({
        id: nextId('mindmap-line'),
        pathD: `M ${rawX1 + tx} ${rawY1 + ty} L ${rawX2 + tx} ${rawY2 + ty}`,
        stroke,
        type: 'link',
        noSnap: true,
      });
    });
  }

  return edges;
};
