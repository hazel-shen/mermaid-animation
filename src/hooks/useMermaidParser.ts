import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';
import { parseSequenceNodes, parseSequenceEdges, parseSequenceLoopFrames, parseSequenceMessageLabels } from '../services/SequenceParser';
import { parseFlowchartNodes, parseFlowchartEdges } from '../services/FlowchartParser';

interface UseMermaidParserReturn {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  seqLabels: SeqLabel[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [viewBox, setViewBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Keep isPremium in a ref so renderMermaidToData doesn't need to re-create itself
  const isPremiumRef = useRef(isPremium);
  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);

  // 1. Load Mermaid script
  useEffect(() => {
    if ((window as any).mermaid) {
      initializeMermaid();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
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

  const extractDataFromSVG = useCallback((svgElement: SVGSVGElement) => {
    const vb = svgElement.viewBox.baseVal;
    setViewBox({ x: vb.x, y: vb.y, width: vb.width, height: vb.height });

    const isSequenceDiagram = svgElement.querySelector('rect.actor, line.messageLine0, line.messageLine1') !== null;

    let extractedNodes: DiagramNode[];
    let extractedEdges: DiagramEdge[];
    let extractedLabels: SeqLabel[] = [];

    if (isSequenceDiagram) {
      extractedNodes = parseSequenceNodes(svgElement);
      extractedEdges = parseSequenceEdges(svgElement, isPremiumRef.current);

      const { nodes: loopNodes, labels: loopLabels } = parseSequenceLoopFrames(svgElement);
      extractedNodes.push(...loopNodes);
      extractedLabels.push(...loopLabels);
      extractedLabels.push(...parseSequenceMessageLabels(svgElement));
    } else {
      extractedNodes = parseFlowchartNodes(svgElement, isPremiumRef.current);
      extractedEdges = parseFlowchartEdges(svgElement, isPremiumRef.current);
    }

    setSeqLabels(extractedLabels);
    setNodes(extractedNodes);

    // Filter out horizontal structural edges
    const cleanedEdges = extractedEdges.filter(edge => {
      if (edge.type !== 'structural') return true;
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

    try {
      const id = 'mermaid-hidden-' + Math.round(Math.random() * 10000);
      hiddenContainerRef.current.innerHTML = '';
      const { svg } = await (window as any).mermaid.render(id, code);

      if (hiddenContainerRef.current) {
        hiddenContainerRef.current.innerHTML = svg;
        const svgEl = hiddenContainerRef.current.querySelector('svg');
        if (svgEl) {
          extractDataFromSVG(svgEl as SVGSVGElement);
        } else {
          throw new Error("SVG 生成失敗");
        }
      }
    } catch (err: any) {
      console.warn("Mermaid Render Warning:", err.message);
      let msg = "語法錯誤或無法解析";
      if (err.message) {
        if (err.message.includes('No diagram type detected')) {
          msg = "無法識別圖表類型，請檢查開頭關鍵字 (如 sequenceDiagram, graph TB)";
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

  return { nodes, edges, seqLabels, isLoading, errorMsg, mermaidReady, renderMermaidToData, viewBox };
};
