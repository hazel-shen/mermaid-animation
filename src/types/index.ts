// --- 節點類型 ---
export type NodeType = 'node' | 'cluster' | 'actor' | 'note';

/** Sequence-diagram-specific sub-roles that need special rendering order. */
export type NodeKind = 'stepNum' | 'activation';

/** A single rendered line inside a class-diagram node box. */
export type ClassLine = {
  text?: string;
  /** true = draw a horizontal divider rule before this line group */
  divider?: boolean;
  bold?: boolean;
  /** ER attribute columns: type, name, key (PK/FK/etc.) rendered in separate columns */
  erAttr?: { type: string; name: string; key: string };
};

/** Geometry for a single pie wedge (angles in radians). */
export type PieWedge = {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
};

export type DiagramNode = {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  stroke: string;
  shape: 'rect' | 'circle' | 'endCircle' | 'diamond' | 'hexagon' | 'cylinder' | 'stadium' | 'subroutine' | 'roundRect' | 'note' | 'pie' | 'forkJoin' | 'mergeCircle' | 'cloud' | 'bang' | 'reverseCircle' | 'highlightRect';
  /** Sequence-diagram sub-role for rendering-order control. Undefined for all other nodes. */
  nodeKind?: NodeKind;
  /** Present only for class-diagram nodes; carries title + member rows */
  classLines?: ClassLine[];
  /** Present only for pie chart wedge nodes */
  pieWedge?: PieWedge;
  /** Git graph: commit ID label text anchored below this node */
  gitCommitLabel?: string;
  /** Git graph: tag label text anchored above this node */
  gitTagLabel?: string;
};

// link=訊息線(有粒子), structural=結構線(無粒子)
export type EdgeType = 'link' | 'structural';

/**
 * Arrow marker shapes used across all diagram types.
 * 'none' = no arrowhead drawn on that end.
 */
export type ArrowMarker =
  | 'none'
  | 'extension'      // hollow triangle        class: inheritance  <|--
  | 'composition'    // filled diamond          class: composition  *--
  | 'aggregation'    // hollow diamond          class: aggregation  o--
  | 'dependency'     // open V arrow (class)    class: dependency   -->
  | 'default'        // generic filled triangle flowchart/sequence/state
  // Flowchart endpoint markers
  | 'circle'         // hollow circle           flowchart: --o
  | 'cross'          // × shape                 flowchart: --x  / sequence: -x
  // Sequence diagram arrow markers
  | 'openArrow'      // open V arrow (sequence) sequence: ->  -->
  | 'halfCircle'     // ⌒ arc (fire-and-forget) sequence: -)  --)
  // ER diagram cardinality markers
  | 'erOne'          // exactly one  ‖          er: ||
  | 'erZeroOrOne'    // zero or one  o|         er: o|
  | 'erMany'         // one or more  }|         er: }|
  | 'erZeroOrMany';  // zero or more }o         er: }o

export type DiagramEdge = {
  id: string;
  pathD: string;
  stroke: string;
  type: EdgeType;
  dash?: number[];
  hasArrow?: boolean;
  /** Arrow marker at the END of the path (marker-end) */
  arrowEnd?: ArrowMarker;
  /** Arrow marker at the START of the path (marker-start) */
  arrowStart?: ArrowMarker;
  /** Node id that this edge originates from (used to snap arrow to box border) */
  fromNodeId?: string;
  /** Node id that this edge points to (used to snap arrow to box border) */
  toNodeId?: string;
  /** Skip node-border snapping for this edge (e.g. sequence message lines) */
  noSnap?: boolean;
  /** Override the default stroke lineWidth for this edge */
  lineWidth?: number;
  /**
   * Set by StateParser: the SVG element id of the composite-state cluster
   * that directly contains this edge's <path>. Undefined for external transitions.
   * Internal transitions (both endpoints inside the same cluster) must NOT receive
   * a cluster toNodeId / fromNodeId — otherwise drawEdge clips them away.
   */
  parentClusterId?: string;
};

export type SeqLabel = {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: CanvasTextAlign;
  /** Optional background fill drawn behind the label text (e.g. for class-diagram edge labels). */
  bgColor?: string;
  /** Rotation in radians around (x, y). Text is drawn along the rotated axis starting from that point. */
  rotation?: number;
};

export type Transform = {
  x: number;
  y: number;
  scale: number;
};

export type DiagramData = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  seqLabels: SeqLabel[];
};
