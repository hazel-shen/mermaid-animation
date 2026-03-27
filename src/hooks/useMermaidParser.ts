import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { getDiagramType } from '../services/diagramTypes';
import type { DiagramType } from '../services/diagramTypes';

// Sequence
import { parseSequenceNodes, parseSequenceEdges, parseSequenceLoopFrames, parseSequenceMessageLabels, parseSequenceStepNumbers } from '../services/SequenceParser';
// Flowchart
import { parseFlowchartNodes, parseFlowchartEdges, parseFlowchartEdgeLabels } from '../services/FlowchartParser';
// Class
import { parseClassNodes, parseClassEdges, parseClassEdgeLabels } from '../services/ClassParser';
// State
import { parseStateNodes, parseStateEdges, parseStateEdgeLabels } from '../services/StateParser';
// ER
import { parseErNodes, parseErEdges, parseErEdgeLabels } from '../services/ErParser';
// Gantt / Timeline
import { parseGanttNodes, parseGanttEdges, parseGanttLabels } from '../services/GanttParser';
// Pie
import { parsePieNodes, parsePieEdges, parsePieLabels } from '../services/PieParser';
// Mindmap
import { parseMindmapNodes, parseMindmapEdges, snapMindmapEdgesToNodes } from '../services/MindmapParser';
// Git Graph
import { parseGitGraphNodes, parseGitGraphEdges, parseGitGraphLabels } from '../services/GitGraphParser';
// Generic fallback
import { parseGeneric } from '../services/GenericParser';

interface UseMermaidParserReturn {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  seqLabels: SeqLabel[];
  diagramType: DiagramType;
  isLoading: boolean;
  errorMsg: string | null;
  mermaidReady: boolean;
  renderMermaidToData: () => Promise<void>;
  viewBox: { x: number; y: number; width: number; height: number } | null;
}

export const useMermaidParser = (
  code: string,
  isPremium: boolean,
  hiddenContainerRef: React.RefObject<HTMLDivElement>
): UseMermaidParserReturn => {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [seqLabels, setSeqLabels] = useState<SeqLabel[]>([]);
  const [diagramType, setDiagramType] = useState<DiagramType>('flowchart');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [viewBox, setViewBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const isPremiumRef = useRef(isPremium);
  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);

  // 1. Load Mermaid script
  useEffect(() => {
    if ((window as any).mermaid) {
      initializeMermaid();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.13.0/dist/mermaid.min.js';
    script.onload = initializeMermaid;
    script.onerror = () => setErrorMsg("無法載入 Mermaid 庫，請檢查網路連線。");
    document.body.appendChild(script);

    function initializeMermaid() {
      try {
        (window as any).mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          flowchart: { htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: false },
        });
        setMermaidReady(true);
        setIsLoading(false);
      } catch (e) {
        console.warn("Mermaid Init Error", e);
      }
    }
  }, []);

  const extractDataFromSVG = useCallback((svgElement: SVGSVGElement, type: DiagramType) => {
    const vb = svgElement.viewBox.baseVal;
    setViewBox({ x: vb.x, y: vb.y, width: vb.width, height: vb.height });

    let extractedNodes: DiagramNode[];
    let extractedEdges: DiagramEdge[];
    let extractedLabels: SeqLabel[] = [];
    const premium = isPremiumRef.current;

    switch (type) {
      case 'sequence': {
        extractedNodes = parseSequenceNodes(svgElement);
        extractedEdges = parseSequenceEdges(svgElement, premium);
        const { nodes: loopNodes, labels: loopLabels, dividerEdges } = parseSequenceLoopFrames(svgElement);
        extractedNodes.push(...loopNodes);
        extractedLabels.push(...loopLabels);
        extractedLabels.push(...parseSequenceMessageLabels(svgElement));
        extractedEdges.push(...dividerEdges);
        // Step number circles
        const stepNodes = parseSequenceStepNumbers(svgElement);
        extractedNodes.push(...stepNodes);
        break;
      }

      case 'flowchart': {
        extractedNodes = parseFlowchartNodes(svgElement, premium);
        extractedEdges = parseFlowchartEdges(svgElement, premium);
        extractedLabels = parseFlowchartEdgeLabels(svgElement);
        break;
      }

      case 'class': {
        extractedNodes = parseClassNodes(svgElement, premium);
        extractedEdges = parseClassEdges(svgElement, premium);
        extractedLabels = parseClassEdgeLabels(svgElement, premium);
        // Fallback: if we got no edges, use generic
        if (extractedEdges.length === 0) {
          const gen = parseGeneric(svgElement, premium);
          if (extractedNodes.length === 0) extractedNodes = gen.nodes;
          extractedEdges = gen.edges;
        }
        break;
      }

      case 'state': {
        extractedNodes = parseStateNodes(svgElement, premium);
        extractedEdges = parseStateEdges(svgElement, premium);
        extractedLabels = parseStateEdgeLabels(svgElement);
        if (extractedEdges.length === 0) {
          const gen = parseGeneric(svgElement, premium);
          if (extractedNodes.length === 0) extractedNodes = gen.nodes;
          extractedEdges = gen.edges;
        }
        break;
      }

      case 'er': {
        extractedNodes = parseErNodes(svgElement, premium);
        extractedEdges = parseErEdges(svgElement, premium, extractedNodes);
        extractedLabels = parseErEdgeLabels(svgElement);
        if (extractedEdges.length === 0) {
          const gen = parseGeneric(svgElement, premium);
          if (extractedNodes.length === 0) extractedNodes = gen.nodes;
          extractedEdges = gen.edges;
        }
        break;
      }

      case 'gantt':
      case 'timeline': {
        extractedNodes = parseGanttNodes(svgElement);
        extractedEdges = parseGanttEdges(svgElement, premium);
        extractedLabels = parseGanttLabels(svgElement);
        break;
      }

      case 'pie': {
        extractedNodes = parsePieNodes(svgElement);
        extractedEdges = parsePieEdges(svgElement);
        extractedLabels = parsePieLabels(svgElement);
        break;
      }

      case 'mindmap': {
        extractedNodes = parseMindmapNodes(svgElement, premium);
        extractedEdges = parseMindmapEdges(svgElement, premium);
        if (extractedNodes.length === 0 && extractedEdges.length === 0) {
          const gen = parseGeneric(svgElement, premium);
          extractedNodes = gen.nodes;
          extractedEdges = gen.edges;
        }
        extractedEdges = snapMindmapEdgesToNodes(extractedEdges, extractedNodes);
        break;
      }

      case 'gitgraph': {
        extractedNodes = parseGitGraphNodes(svgElement, premium);
        extractedEdges = parseGitGraphEdges(svgElement, premium);
        extractedLabels = parseGitGraphLabels(svgElement);
        if (extractedEdges.length === 0) {
          const gen = parseGeneric(svgElement, premium);
          if (extractedNodes.length === 0) extractedNodes = gen.nodes;
          extractedEdges = gen.edges;
        }
        break;
      }

      default: {
        // Generic DFS fallback for sankey, unknown types, etc.
        const gen = parseGeneric(svgElement, premium);
        extractedNodes = gen.nodes;
        extractedEdges = gen.edges;
        break;
      }
    }

    setSeqLabels(extractedLabels);
    setNodes(extractedNodes);

    // Filter out mostly-horizontal structural edges (lifelines noise reduction)
    // but keep explicitly added divider lines
    const cleanedEdges = extractedEdges.filter(edge => {
      if (edge.type !== 'structural') return true;
      if (edge.id.startsWith('divider-')) return true;
      const m = edge.pathD.match(/M\s*([\d.e+\-]+)\s+([\d.e+\-]+)\s+L\s*([\d.e+\-]+)\s+([\d.e+\-]+)/i);
      if (m) {
        const dx = Math.abs(parseFloat(m[3]) - parseFloat(m[1]));
        const dy = Math.abs(parseFloat(m[4]) - parseFloat(m[2]));
        return dy > dx * 0.8;
      }
      return true;
    });
    setEdges(cleanedEdges);
  }, []);

  const renderMermaidToData = useCallback(async () => {
    if (!mermaidReady || !hiddenContainerRef.current) return;
    if (!code || !code.trim()) {
      setErrorMsg("請輸入 Mermaid 代碼");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const type = getDiagramType(code);
    setDiagramType(type);

    // classDiagram: classDef color definitions are not supported by this renderer.
    if (type === 'class' && /^\s*classDef\s+/m.test(code)) {
      setErrorMsg("classDiagram 不支援顏色樣式定義（classDef）。\n請移除所有 classDef 行及 class ... style 套用行後再試。");
      setIsLoading(false);
      return;
    }

    try {
      const id = 'mermaid-hidden-' + Math.round(Math.random() * 10000);
      hiddenContainerRef.current.innerHTML = '';
      const { svg } = await (window as any).mermaid.render(id, code);

      if (hiddenContainerRef.current) {
        hiddenContainerRef.current.innerHTML = svg;
        const svgEl = hiddenContainerRef.current.querySelector('svg');
        if (svgEl) {
          extractDataFromSVG(svgEl as SVGSVGElement, type);
        } else {
          throw new Error("SVG 生成失敗");
        }
      }
    } catch (err: any) {
      console.warn("Mermaid Render Warning:", err.message);
      let msg = "語法錯誤或無法解析";
      if (err.message) {
        if (err.message.includes('No diagram type detected')) {
          msg = "無法識別圖表類型，請檢查開頭關鍵字 (如 sequenceDiagram, graph TB, classDiagram)";
        } else {
          msg = err.message.split('\n')[0];
        }
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [code, mermaidReady, hiddenContainerRef, extractDataFromSVG]);

  // Auto re-render on code change
  useEffect(() => {
    if (mermaidReady) {
      const timer = setTimeout(renderMermaidToData, 800);
      return () => clearTimeout(timer);
    }
  }, [code, mermaidReady, renderMermaidToData]);

  return { nodes, edges, seqLabels, diagramType, isLoading, errorMsg, mermaidReady, renderMermaidToData, viewBox };
};
