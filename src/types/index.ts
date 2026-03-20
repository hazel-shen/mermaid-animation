// --- 節點類型 ---
export type NodeType = 'node' | 'cluster' | 'actor' | 'note';

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
  shape: 'rect' | 'circle' | 'diamond' | 'cylinder' | 'roundRect' | 'note';
};

// link=訊息線(有粒子), structural=結構線(無粒子)
export type EdgeType = 'link' | 'structural';

export type DiagramEdge = {
  id: string;
  pathD: string;
  stroke: string;
  type: EdgeType;
  dash?: number[];
  hasArrow?: boolean;
};

export type SeqLabel = {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: CanvasTextAlign;
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
