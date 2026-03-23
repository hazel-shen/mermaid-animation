// --- 節點類型 ---
export type NodeType = 'node' | 'cluster' | 'actor' | 'note';

/** A single rendered line inside a class-diagram node box. */
export type ClassLine = {
  text: string;
  /** true = draw a horizontal divider rule before this line group */
  divider?: boolean;
  bold?: boolean;
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
  shape: 'rect' | 'circle' | 'diamond' | 'hexagon' | 'cylinder' | 'stadium' | 'subroutine' | 'roundRect' | 'note' | 'pie';
  /** Present only for class-diagram nodes; carries title + member rows */
  classLines?: ClassLine[];
  /** Present only for pie chart wedge nodes */
  pieWedge?: PieWedge;
};

// link=訊息線(有粒子), structural=結構線(無粒子)
export type EdgeType = 'link' | 'structural';

/**
 * Arrow marker shapes used by class diagrams.
 * 'none' = no arrowhead drawn on that end.
 */
export type ArrowMarker =
  | 'none'
  | 'extension'    // hollow triangle (inheritance <|--)
  | 'composition'  // filled diamond (*--)
  | 'aggregation'  // hollow diamond (o--)
  | 'dependency'   // open arrow (-->)
  | 'default';     // generic filled triangle

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
