import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Zap, Video, Loader2, Code, RefreshCw, FileText, Activity, Palette, Server, Gauge, SlidersHorizontal, X, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

// --- 類型定義 ---
type NodeType = 'node' | 'cluster' | 'actor' | 'note';

type DiagramNode = {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;      // Fill color
  stroke: string;     // Stroke color
  shape: 'rect' | 'circle' | 'diamond' | 'cylinder' | 'roundRect' | 'note';
};

type EdgeType = 'link' | 'structural'; // link=訊息線(有粒子), structural=結構線(無粒子)

type DiagramEdge = {
  id: string;
  pathD: string;
  stroke: string;
  type: EdgeType;
  dash?: number[]; // 虛線樣式
};

// --- 預設代碼 (Sequence Diagram) ---
const SEQUENCE_CODE = `sequenceDiagram
    participant App
    participant API
    
    rect rgb(240, 240, 240)
        Note right of App: 初始化連線
        App->>API: 建立連線 (Sync)
        API-->>App: 連線已確認
    end
    
    loop 每 30 秒執行一次
        App->>API: 獲取最新數據
        API-->>App: 回傳數據內容
    end`;

// --- 預設代碼 (Flowchart) ---
const FLOWCHART_CODE = `graph LR
    W0[Week 0<br/>GCP: 100%<br/>AWS: 0%]
    W1[Week 1<br/>GCP: 60%<br/>AWS: 40%]
    W2[Week 2<br/>GCP: 25%<br/>AWS: 75%]
    W3[Week 3<br/>GCP: 5%<br/>AWS: 95%]
    W4[Week 4<br/>GCP: 0.8%<br/>AWS: 99.2%]
    
    W0 --> W1 --> W2 --> W3 --> W4
    
    style W0 fill:#4285f4,color:#fff
    style W4 fill:#ff9900`;

// --- 預設代碼 (Architecture) ---
const ARCH_CODE = `flowchart TB
    subgraph Devices[" "]
        D1[設備 A<br/>已切到 AWS]
        D2[設備 B<br/>還在 GCP]
    end
    
    subgraph DNS_Layer[" "]
        DNS_SVC[DNS Server<br/>指向 AWS]
    end
    
    subgraph AWS_Stack["AWS - 主要服務"]
        AWS_LB[ALB]
        AWS_APP[EKS Pods]
        AWS_DB[(RDS)]
    end
    
    subgraph Sync_Layer["同步層"]
        MQ[Message Queue]
        SW[Sync Workers]
    end
    
    subgraph GCP_Stack["GCP - 備份服務"]
        GCP_LB[GCP LB]
        GCP_APP[GKE Pods]
        GCP_DB[(Cloud SQL)]
    end
    
    subgraph Monitor_Layer["監控"]
        MON[Prometheus + Grafana]
    end
    
    D1 --> DNS_SVC
    DNS_SVC --> AWS_LB
    AWS_LB --> AWS_APP
    AWS_APP --> AWS_DB
    
    D2 --> GCP_LB
    GCP_LB --> GCP_APP
    GCP_APP --> GCP_DB
    
    AWS_APP -.-> MQ
    MQ -.-> SW
    SW -.-> GCP_APP
    
    AWS_DB -.-> MON
    GCP_DB -.-> MON
    
    style AWS_DB fill:#ff9900
    style GCP_DB fill:#4285f4,opacity:0.6`;

// --- 粒子系統 ---
class Particle {
  progress: number;
  speed: number;
  pathElement: SVGPathElement | null;
  // color 屬性不再需要硬性儲存，改由渲染迴圈動態決定

  constructor(pathD: string) {
    this.progress = Math.random();
    this.speed = 0.002 + Math.random() * 0.004; // 稍微調整速度差異
    try {
      this.pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
      this.pathElement.setAttribute("d", pathD);
    } catch (e) {
      this.pathElement = null;
    }
  }

  // 接收倍率參數來控制速度
  update(multiplier: number = 1) {
    this.progress += this.speed * multiplier;
    if (this.progress >= 1) this.progress = 0;
  }

  getPosition() {
    if (!this.pathElement) return { x: 0, y: 0 };
    try {
      const len = this.pathElement.getTotalLength();
      if (len === 0 || isNaN(len)) return { x: 0, y: 0 };
      const point = this.pathElement.getPointAtLength(this.progress * len);
      return { x: point.x, y: point.y };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }
}

// --- 主元件 ---
const CanvasDiagram = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  
  // 使用 Ref 來追蹤懸停狀態，避免頻繁的 State 更新導致重繪閃爍
  const hoveredNodeIdRef = useRef<string | null>(null);
  
  const [code, setCode] = useState(ARCH_CODE); // 預設改為 Architecture 方便展示
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Pan + Zoom transform (所有互動都透過這組值驅動，不用 CSS scale)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [transformState, setTransformState] = useState({ x: 0, y: 0, scale: 1 });
  // 紀錄 diagram 的自然尺寸，供 fit 計算使用
  const diagramSizeRef = useRef({ w: 0, h: 0 });

  // Pan drag state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [isPremium, setIsPremium] = useState(true);
  const [particleColor, setParticleColor] = useState('#6366f1');
  const [particleSpeed, setParticleSpeed] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isControlBarOpen, setIsControlBarOpen] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(320); // 桌面版側欄寬度 (px)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(0);

  // isDesktop 監聽
  useEffect(() => {
      const handler = () => setIsDesktop(window.innerWidth >= 1024);
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
  }, []);

  // 0. 讓 canvas buffer 尺寸跟隨容器尺寸
  useEffect(() => {
      const container = canvasContainerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const resizeCanvas = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w === 0 || h === 0) return;
          // 只在尺寸真的改變時才重設，避免清除 buffer
          if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
          }
      };

      resizeCanvas();
      const ro = new ResizeObserver(resizeCanvas);
      ro.observe(container);
      return () => ro.disconnect();
  }, []);

  // 1. 初始化
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
                sequence: { useMaxWidth: false }
            });
            setMermaidReady(true);
            setIsLoading(false);
        } catch (e) {
            console.warn("Mermaid Init Error", e);
        }
    }
  }, []);

  // 2. 渲染邏輯
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
                extractDataFromSVG(svgEl);
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
  }, [code, mermaidReady, isPremium]);

  useEffect(() => {
      if (mermaidReady) {
          const timer = setTimeout(renderMermaidToData, 800);
          return () => clearTimeout(timer);
      }
  }, [code, mermaidReady, renderMermaidToData]);

  // 顏色轉換工具
  const hexToRgba = (color: string, alpha: number) => {
    color = color.trim();
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (color.startsWith('rgba(')) {
        return color.replace(/[^,]+(?=\))/, ` ${alpha}`);
    }
    return color;
  };

  // 輔助函數：遞迴計算累積的 Transform 位移 (從 SVG 根節點到目標元素)
  const getCumulativeTransform = (element: Element, stopAt: Element) => {
    let x = 0, y = 0;
    let current = element;
    
    // 向上遍歷直到 SVG 根節點
    while (current && current !== stopAt) {
      // 檢查是否有 transform 屬性 (針對 g, rect, path 等所有元素)
      const transform = current.getAttribute('transform');
      if (transform) {
        // 解析 translate(x, y) 或 translate(x y)
        // 支援逗號或空格分隔，並支援小數點與負數
        // Support both translate(x, y) and translate(x) forms
        const match = transform.match(/translate\s*\(\s*([-\d.]+)(?:[ ,]+([-\d.]+))?\s*\)/);
        if (match) {
          x += parseFloat(match[1]);
          y += parseFloat(match[2] || '0');
        }
      }
      current = current.parentElement as Element;
    }
    return { x, y };
  };

  // 3. 解析 SVG (修正版：回歸手動遞迴解析，棄用不穩定的 getCTM)
  const extractDataFromSVG = (svgElement: SVGSVGElement) => {
      const extractedNodes: DiagramNode[] = [];
      const extractedEdges: DiagramEdge[] = [];
      const viewBox = svgElement.viewBox.baseVal;

      // --- A. 解析節點 ---
      const allGroups = svgElement.querySelectorAll('g');
      
      allGroups.forEach(g => {
          const isNode = g.classList.contains('node');
          const isCluster = g.classList.contains('cluster');
          const isActor = g.classList.contains('actor') || g.querySelector('rect.actor');
          const isNote = g.classList.contains('note') || g.querySelector('rect.note');
          
          if (!isNode && !isCluster && !isActor && !isNote) return;

          // 尋找視覺形狀元素 (取第一個匹配的圖形)
          const rect = g.querySelector('rect, circle, polygon, path') as SVGGraphicsElement;
          if (!rect) return;

          // 1. 取得累積位移 (包含自身與所有父層，確保 Subgraph 和複雜形狀位置正確)
          const { x: totalTx, y: totalTy } = getCumulativeTransform(rect, svgElement);
          
          // 2. 取得形狀自身的 Bounding Box (Local Coordinates)
          // 這會包含 x, y, width, height (相對於自身的座標，無論是 x/y 屬性還是 d 路徑)
          const bbox = rect.getBBox();
          
          // 3. 計算最終中心點
          // Global Center = Cumulative Transform + Local BBox Origin + Half Size
          // 這樣的算法對於 rect(x,y), circle(cx,cy -> bbox), path(d -> bbox) 都通用
          const finalX = totalTx + bbox.x + bbox.width / 2;
          const finalY = totalTy + bbox.y + bbox.height / 2;
          const width = bbox.width;
          const height = bbox.height;

          // 4. 處理樣式與形狀類型
          let shape: DiagramNode['shape'] = 'rect';
          let color = isPremium ? '#ffffff' : '#fff'; 
          let stroke = isPremium ? '#94a3b8' : '#333'; 
          let type: NodeType = 'node';

          const style = window.getComputedStyle(rect);
          if (style.fill && style.fill !== 'none' && style.fill !== 'rgb(0, 0, 0)') color = style.fill;
          if (style.stroke && style.stroke !== 'none') stroke = style.stroke;

          const tagName = rect.tagName.toLowerCase();
          
          if (tagName === 'circle') shape = 'circle';
          else if (tagName === 'polygon') shape = 'diamond';
          else if (tagName === 'rect') shape = 'roundRect';
          else if (tagName === 'path') shape = 'roundRect'; // DB (Cylinder) 或其他複雜形狀

          // Extract label text
          let label = "";
          const textElement = g.querySelector('text');
          const foreignObject = g.querySelector('foreignObject');
          
          if (foreignObject) {
              const contentDiv = foreignObject.querySelector('div');
              if (contentDiv) {
                  let html = contentDiv.innerHTML;
                  html = html.replace(/<br\s*\/?>/gi, '\n');
                  const temp = document.createElement('div');
                  temp.innerHTML = html;
                  label = temp.textContent || "";
              } else {
                label = (foreignObject as unknown as HTMLElement).innerText || foreignObject.textContent || "";
              }
          } else if (textElement) {
              const spans = textElement.querySelectorAll('tspan');
              if (spans.length > 0) {
                  label = Array.from(spans).map(s => s.textContent).join('\n');
              } else {
                  label = textElement.textContent || "";
              }
          }

          if (isCluster) { 
              type = 'cluster'; 
              color = hexToRgba(color, 0.05); 
          }
          else if (isActor) { type = 'actor'; shape = 'rect'; }
          else if (isNote) { type = 'note'; shape = 'note'; color = '#fef3c7'; stroke='#d97706'; }

          if (width > 0 && height > 0) {
              extractedNodes.push({ id: g.id || `node-${Math.random()}`, label, type, x: finalX, y: finalY, width, height, color, stroke, shape });
          }
      });

      // --- B. 解析連線 ---
      const linkSelector = '.edgePath path, .flowchart-link, line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1';
      const structSelector = '.actor-line, line[class*="actor-line"]';

      const processEdge = (el: Element, type: EdgeType) => {
          let d = "";
          let stroke = isPremium ? '#94a3b8' : '#333';
          let dash: number[] | undefined = undefined;

          const style = window.getComputedStyle(el);
          if (style.stroke && style.stroke !== 'none') stroke = style.stroke;
          
          if (style.strokeDasharray && style.strokeDasharray !== 'none') {
              const dashValues = style.strokeDasharray.split(',').map(n => parseFloat(n));
              // Only apply dash if at least one value is actually > 0
              if (dashValues.some(v => v > 0)) {
                  dash = dashValues;
              }
          }

          const tagName = el.tagName.toLowerCase();

          if (tagName === 'line') {
              const lx1 = parseFloat(el.getAttribute('x1') || '0');
              const ly1 = parseFloat(el.getAttribute('y1') || '0');
              const lx2 = parseFloat(el.getAttribute('x2') || '0');
              const ly2 = parseFloat(el.getAttribute('y2') || '0');
              // Apply accumulated parent transforms so coords map to SVG root space
              const { x: tx, y: ty } = getCumulativeTransform(el, svgElement);
              d = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
          } else if (tagName === 'path') {
              d = el.getAttribute('d') || "";
          }

          if (d && d.length > 10) {
              extractedEdges.push({
                  id: `edge-${Math.random()}`,
                  pathD: d,
                  stroke,
                  type,
                  dash
              });
          }
      };

      svgElement.querySelectorAll(linkSelector).forEach(el => {
          // For <line> elements, filter out those that are part of a self-loop or control-flow decoration.
          // Mermaid renders self-loops (e.g. John->>John) as both:
          //   • <line class="messageLine0"> segments (top/bottom of the rectangular loop shape)
          //   • <path class="messageLine0"> (the arc that's already captured separately)
          // We skip the redundant line segments to avoid spurious horizontal lines on the canvas.
          if (el.tagName.toLowerCase() === 'line') {
              const parent = el.parentElement;
              if (parent) {
                  // If the parent group also has a path.messageLine* sibling, the path handles this
                  // edge — skip the raw line segments to prevent duplicate/ghost lines.
                  if (parent.querySelector('path.messageLine0, path.messageLine1')) return;
                  // Skip lines inside loop/alt/opt control-flow boxes
                  if (parent.querySelector('rect.loopLine, rect.labelBox')) return;
              }
          }
          processEdge(el, 'link');
      });
      svgElement.querySelectorAll(structSelector).forEach(el => processEdge(el, 'structural'));

      svgElement.querySelectorAll('line').forEach(line => {
          const lx1 = parseFloat(line.getAttribute('x1') || '0');
          const lx2 = parseFloat(line.getAttribute('x2') || '0');
          const ly1 = parseFloat(line.getAttribute('y1') || '0');
          const ly2 = parseFloat(line.getAttribute('y2') || '0');
          
          const dx = Math.abs(lx2 - lx1);
          const dy = Math.abs(ly2 - ly1);
          
          if (dy > dx * 3 && dy > 50) {
              // Build the same transformed path that processEdge will produce
              const { x: tx, y: ty } = getCumulativeTransform(line, svgElement);
              const potentialPath = `M ${lx1 + tx} ${ly1 + ty} L ${lx2 + tx} ${ly2 + ty}`;
              const alreadyProcessed = extractedEdges.some(e => e.pathD === potentialPath);
              if (!alreadyProcessed) {
                  processEdge(line, 'structural');
              }
          }
      });

      setNodes(extractedNodes);
      // Filter out horizontal structural edges: actor lifelines are vertical; any horizontal
      // "structural" line is likely an actor-box border already rendered as a node rectangle.
      const cleanedEdges = extractedEdges.filter(edge => {
          if (edge.type !== 'structural') return true;
          const m = edge.pathD.match(/M\s*([\d.e+\-]+)\s+([\d.e+\-]+)\s+L\s*([\d.e+\-]+)\s+([\d.e+\-]+)/i);
          if (m) {
              const dx = Math.abs(parseFloat(m[3]) - parseFloat(m[1]));
              const dy = Math.abs(parseFloat(m[4]) - parseFloat(m[2]));
              return dy > dx * 0.8; // keep only near-vertical structural lines
          }
          return true;
      });
      setEdges(cleanedEdges);
      
      if (canvasRef.current && canvasContainerRef.current) {
          // canvas 固定填滿容器，diagram 透過 transform 縮放
          const containerW = canvasContainerRef.current.clientWidth;
          const containerH = canvasContainerRef.current.clientHeight;
          canvasRef.current.width = containerW;
          canvasRef.current.height = containerH;
          (canvasRef.current as any).viewBoxOffset = { x: -viewBox.x, y: -viewBox.y };

          // 記下 diagram 原始尺寸
          const dw = viewBox.width;
          const dh = viewBox.height;
          diagramSizeRef.current = { w: dw, h: dh };

          // 初始 fit：縮放讓整張圖以 padding 16px 填滿容器
          const padding = 32;
          const scaleX = (containerW - padding) / dw;
          const scaleY = (containerH - padding) / dh;
          const fitScale = Math.min(scaleX, scaleY, 2); // 最大不超過 2x
          const fitX = (containerW - dw * fitScale) / 2;
          const fitY = (containerH - dh * fitScale) / 2;
          transformRef.current = { x: fitX, y: fitY, scale: fitScale };
          setTransformState({ x: fitX, y: fitY, scale: fitScale });
      }
  };

  // 4. 粒子系統
  useEffect(() => {
      const newParticles: Particle[] = [];
      edges.forEach(edge => {
          if (edge.type === 'link') {
              const count = Math.max(1, Math.floor(edge.pathD.length / 150)) + 1;
              for(let i=0; i<count; i++) {
                  newParticles.push(new Particle(edge.pathD));
              }
          }
      });
      setParticles(newParticles);
  }, [edges]);

  // 把 canvas 像素座標轉為 diagram 世界座標（考慮 pan + zoom + viewBoxOffset）
  const canvasToWorld = useCallback((cx: number, cy: number) => {
      const tr = transformRef.current;
      const offset = (canvasRef.current as any)?.viewBoxOffset || { x: 0, y: 0 };
      // 逆變換：先減 pan，再除以 scale，再減 viewBoxOffset
      const wx = (cx - tr.x) / tr.scale - offset.x;
      const wy = (cy - tr.y) / tr.scale - offset.y;
      return { x: wx, y: wy };
  }, []);

  // 互動處理: 滑鼠按下（開始拖曳）
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      canvasRef.current!.style.cursor = 'grabbing';
  };

  // 互動處理: 滑鼠移動
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // --- 拖曳平移 ---
      if (isPanningRef.current) {
          const newX = e.clientX - panStartRef.current.x;
          const newY = e.clientY - panStartRef.current.y;
          transformRef.current = { ...transformRef.current, x: newX, y: newY };
          setTransformState(t => ({ ...t, x: newX, y: newY }));
          canvas.style.cursor = 'grabbing';
          return;
      }

      // --- Hover 碰撞偵測 ---
      const rect = canvas.getBoundingClientRect();
      const { x: mouseX, y: mouseY } = canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);

      let foundId = null;
      for (const node of nodes) {
          if (
              mouseX >= node.x - node.width / 2 &&
              mouseX <= node.x + node.width / 2 &&
              mouseY >= node.y - node.height / 2 &&
              mouseY <= node.y + node.height / 2
          ) {
              foundId = node.id;
              break;
          }
      }

      hoveredNodeIdRef.current = foundId;
      canvas.style.cursor = foundId ? 'pointer' : 'grab';
  };

  const handleMouseUp = () => {
      isPanningRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };

  const handleMouseLeave = () => {
      isPanningRef.current = false;
      hoveredNodeIdRef.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };

  // 互動處理: 滾輪縮放（以滑鼠為中心）
  const handleWheel = useCallback((e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const tr = transformRef.current;
      const newScale = Math.min(Math.max(tr.scale * delta, 0.1), 8);

      // 縮放時保持滑鼠指向的世界座標不變
      const newX = mouseX - (mouseX - tr.x) * (newScale / tr.scale);
      const newY = mouseY - (mouseY - tr.y) * (newScale / tr.scale);

      transformRef.current = { x: newX, y: newY, scale: newScale };
      setTransformState({ x: newX, y: newY, scale: newScale });
  }, []);

  // 綁定 wheel 事件（需要 passive: false 才能 preventDefault）
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel, nodes]); // nodes 更新後重新綁定

  // Fit to screen
  const handleFit = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { w: dw, h: dh } = diagramSizeRef.current;
      if (!dw || !dh) return;
      const padding = 48;
      const scaleX = (canvas.width - padding) / dw;
      const scaleY = (canvas.height - padding) / dh;
      const fitScale = Math.min(scaleX, scaleY, 2);
      const fitX = (canvas.width - dw * fitScale) / 2;
      const fitY = (canvas.height - dh * fitScale) / 2;
      transformRef.current = { x: fitX, y: fitY, scale: fitScale };
      setTransformState({ x: fitX, y: fitY, scale: fitScale });
  }, []);

  const handleZoomIn = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const tr = transformRef.current;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const newScale = Math.min(tr.scale * 1.25, 8);
      const newX = cx - (cx - tr.x) * (newScale / tr.scale);
      const newY = cy - (cy - tr.y) * (newScale / tr.scale);
      transformRef.current = { x: newX, y: newY, scale: newScale };
      setTransformState({ x: newX, y: newY, scale: newScale });
  }, []);

  const handleZoomOut = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const tr = transformRef.current;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const newScale = Math.max(tr.scale * 0.8, 0.1);
      const newX = cx - (cx - tr.x) * (newScale / tr.scale);
      const newY = cy - (cy - tr.y) * (newScale / tr.scale);
      transformRef.current = { x: newX, y: newY, scale: newScale };
      setTransformState({ x: newX, y: newY, scale: newScale });
  }, []);

  const handleResetZoom = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      handleFit();
  }, [handleFit]);

  // Resize handle handlers (桌面版側欄拖曳調整寬度)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWRef.current = editorWidth;

      const onMove = (ev: MouseEvent) => {
          if (!isResizingRef.current) return;
          const delta = ev.clientX - resizeStartXRef.current;
          const newW = Math.min(Math.max(resizeStartWRef.current + delta, 180), 600);
          setEditorWidth(newW);
      };
      const onUp = () => {
          isResizingRef.current = false;
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
  }, [editorWidth]);

  // 5. 繪圖
  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      let rafId: number;

      const render = () => {
          const w = canvas.width; const h = canvas.height;
          const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
          const tr = transformRef.current;

          ctx.fillStyle = isPremium ? '#f8fafc' : '#fff'; 
          ctx.fillRect(0, 0, w, h);
          
          ctx.save();
          // 套用 pan + zoom，再加上 viewBox 偏移
          ctx.translate(tr.x, tr.y);
          ctx.scale(tr.scale, tr.scale);
          ctx.translate(offset.x, offset.y);

          if (isPremium) drawGrid(ctx, w, h);

          // --- 渲染層級調整 (Z-Index Logic) ---
          
          // 層級 1: 繪製 Cluster (底層區塊)，確保它們在最下面
          const clusterNodes = nodes.filter(n => n.type === 'cluster');
          clusterNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeIdRef.current));

          // 層級 2: 畫連線 (Edges)，現在會疊在 Cluster 上
          edges.sort((a, _b) => (a.type === 'structural' ? -1 : 1));
          edges.forEach(edge => {
              const p = new Path2D(edge.pathD);
              ctx.strokeStyle = edge.stroke;
              
              if (isPremium) {
                  ctx.strokeStyle = edge.type === 'structural' ? '#cbd5e1' : '#64748b';
              } else {
                  if(edge.type === 'structural' && (!edge.stroke || edge.stroke === 'none')) {
                      ctx.strokeStyle = '#333';
                  }
              }
              
              ctx.lineWidth = 2;
              
              if (edge.dash) ctx.setLineDash(edge.dash);
              else if (edge.type === 'structural') ctx.setLineDash([5, 5]); 
              else ctx.setLineDash([]);

              ctx.stroke(p);
          });
          
          ctx.setLineDash([]); // Reset

          // 層級 3: 粒子 (Particles)
          if (isPremium) {
              ctx.globalCompositeOperation = 'multiply';
              particles.forEach(p => {
                  p.update(particleSpeed); // 傳入速度倍率
                  const pos = p.getPosition();
                  if (pos.x === 0 && pos.y === 0) return;
                  ctx.shadowBlur = 4; 
                  ctx.shadowColor = particleColor; 
                  ctx.fillStyle = particleColor;
                  ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2); ctx.fill();
              });
              ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
          }

          // 層級 4: 繪製一般節點 (Nodes)，確保它們在線和 Cluster 之上
          // Note 節點通常要最上層，所以排最後
          const normalNodes = nodes.filter(n => n.type !== 'cluster').sort((a, _b) => {
              if (a.type === 'note') return 1;
              return 0;
          });
          normalNodes.forEach(node => drawNode(ctx, node, isPremium, hoveredNodeIdRef.current));

          ctx.restore();

          if (isRecording) {
              ctx.fillStyle = 'red'; ctx.font = 'bold 16px Inter'; ctx.fillText("● REC", 20, 30);
          }
          rafId = requestAnimationFrame(render);
      };
      render();
      return () => cancelAnimationFrame(rafId);
  }, [nodes, edges, particles, isPremium, isRecording, particleColor, particleSpeed, transformState]);

  const drawNode = (ctx: CanvasRenderingContext2D, node: DiagramNode, premium: boolean, hoveredId: string | null) => {
      const { x, y, width, height, color, stroke, shape, label } = node;
      const isHovered = node.id === hoveredId;
      
      // 陰影/發光效果
      if (isHovered) {
          // 懸停時的強烈發光
          ctx.shadowColor = particleColor;
          ctx.shadowBlur = 25;
          ctx.shadowOffsetY = 0;
      } else if (premium && node.type !== 'cluster') {
          // 一般狀態的柔和陰影
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      } else {
          ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }

      ctx.fillStyle = color; ctx.strokeStyle = stroke;
      ctx.lineWidth = node.type === 'cluster' ? 2 : 2;
      
      if (node.type === 'cluster') ctx.setLineDash([5, 5]); else ctx.setLineDash([]);

      ctx.beginPath();
      if (shape === 'circle') ctx.arc(x, y, width/2, 0, Math.PI * 2);
      else if (shape === 'diamond') { ctx.moveTo(x, y-height/2); ctx.lineTo(x+width/2, y); ctx.lineTo(x, y+height/2); ctx.lineTo(x-width/2, y); ctx.closePath(); }
      else if (shape === 'note') {
          const fold = 10;
          ctx.moveTo(x-width/2, y-height/2);
          ctx.lineTo(x+width/2-fold, y-height/2);
          ctx.lineTo(x+width/2, y-height/2+fold);
          ctx.lineTo(x+width/2, y+height/2);
          ctx.lineTo(x-width/2, y+height/2);
          ctx.closePath();
      } else {
          const r = node.type === 'cluster' ? 16 : 4; 
          ctx.roundRect(x-width/2, y-height/2, width, height, r);
      }
      ctx.fill(); ctx.stroke();
      
      // 額外的高亮邊框 (如果是懸停狀態)
      if (isHovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = particleColor;
          ctx.stroke();
      }
      
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.setLineDash([]);

      ctx.fillStyle = node.type === 'cluster' ? '#334155' : '#000000';
      ctx.font = node.type === 'cluster' ? 'bold 11px Inter' : 'bold 14px Inter';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      
      if (node.type === 'cluster') {
          // Draw label above the cluster top border so it doesn't overlap inner nodes
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, x, y - height / 2 - 4);
          ctx.textBaseline = 'middle';
      } else {
          const lines = label.split('\n');
          const lh = 16;
          const totalH = lines.length * lh;
          lines.forEach((line, i) => {
              ctx.fillText(line, x, y - totalH/2 + i * lh + lh/2);
          });
      }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const bigW = w * 2; const bigH = h * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -bigW; x <= bigW; x += 40) { ctx.moveTo(x, -bigH); ctx.lineTo(x, bigH); }
      for (let y = -bigH; y <= bigH; y += 40) { ctx.moveTo(-bigW, y); ctx.lineTo(bigW, y); }
      ctx.stroke();
  };

  const handleDownload = () => {
     if(!canvasRef.current) return;
     setIsRecording(true);
     const stream = (canvasRef.current as any).captureStream(60);
     // Prefer MP4 (H.264) when the browser supports it; fall back to WebM
     const mp4Types = ['video/mp4;codecs=h264,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'];
     const mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
     const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
     const recorder = new MediaRecorder(stream, { mimeType });
     const chunks: any[] = [];
     recorder.ondataavailable = e => chunks.push(e.data);
     recorder.onstop = () => {
         const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
         const a = document.createElement('a'); a.href=url; a.download=`flowmotion.${ext}`; a.click();
         setIsRecording(false);
     };
     recorder.start();
     setTimeout(() => recorder.stop(), 3000);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      <div ref={hiddenContainerRef} style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', pointerEvents: 'none' }}></div>

      {/* ===== Header ===== */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-10 px-3 py-2 flex items-center gap-2 min-w-0">
        {/* Logo + title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm">
            <Zap size={16} className="text-white" />
          </div>
          <h1 className="font-bold text-sm md:text-base leading-tight text-slate-800 whitespace-nowrap">
            Mermaid<span className="hidden sm:inline"> Animation</span>
          </h1>
        </div>

        {/* Particle controls — desktop only */}
        {isPremium && (
          <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" title="更改粒子速度">
              <Gauge size={13} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">速度</span>
              <input
                type="range" min="0.1" max="5" step="0.1"
                value={particleSpeed}
                onChange={(e) => setParticleSpeed(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer" title="更改粒子顏色">
              <Palette size={13} className="text-slate-400 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">粒子色</span>
              <input
                type="color" value={particleColor}
                onChange={(e) => setParticleColor(e.target.value)}
                className="w-6 h-6 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* Action buttons — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 ml-auto flex-shrink-0">
          <button
            onClick={renderMermaidToData}
            className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 rounded text-xs flex items-center gap-1 shadow-sm transition-colors"
            title="重新渲染"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            重新渲染
          </button>
          <button
            onClick={() => setIsPremium(!isPremium)}
            className={`px-2.5 py-1.5 rounded text-xs border shadow-sm transition-colors flex items-center gap-1 ${
              isPremium
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span>{isPremium ? '✨' : '◻'}</span>
            {isPremium ? 'Export' : 'Draft'}
          </button>
          <button
            onClick={handleDownload}
            disabled={isRecording}
            className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1 font-bold shadow-sm transition-transform ${
              isRecording
                ? 'bg-red-100 text-red-600 border border-red-200'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'
            }`}
          >
            <Video size={14} />
            {isRecording ? 'REC...' : 'Download'}
          </button>
        </div>
      </header>

      {/* ===== Mobile FAB (hidden on md+) ===== */}
      <button
        onClick={() => setIsControlBarOpen(v => !v)}
        className="md:hidden fixed bottom-16 right-3 z-30 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md"
        style={{
          background: isControlBarOpen
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'linear-gradient(135deg, #3b82f6, #6366f1)',
        }}
        aria-label={isControlBarOpen ? '隱藏控制列' : '顯示控制列'}
      >
        {isControlBarOpen
          ? <X size={13} className="text-white" />
          : <SlidersHorizontal size={13} className="text-white" />
        }
      </button>

      {/* ===== Mobile bottom drawer ===== */}
      <>
        {/* Backdrop */}
        <div
          className={`md:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
            isControlBarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsControlBarOpen(false)}
        />

        {/* Drawer */}
        <div
          className={`md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 transition-transform duration-300 ease-in-out ${
            isControlBarOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-5 pt-2 pb-8 flex flex-col gap-4">
            {/* Particle controls (only in premium mode) */}
            {isPremium && (
              <div className="flex flex-col gap-4 pb-4 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">粒子設定</p>
                <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                  <Gauge size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-14">速度</span>
                  <input
                    type="range" min="0.1" max="5" step="0.1"
                    value={particleSpeed}
                    onChange={(e) => setParticleSpeed(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-xs text-slate-400 w-7 text-right tabular-nums">{particleSpeed.toFixed(1)}</span>
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                  <Palette size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="font-medium w-14">粒子色</span>
                  <input
                    type="color" value={particleColor}
                    onChange={(e) => setParticleColor(e.target.value)}
                    className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 p-0.5 bg-white cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 font-mono">{particleColor}</span>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">操作</p>
              <button
                onClick={() => { renderMermaidToData(); setIsControlBarOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm text-slate-700 font-medium transition-colors"
              >
                <RefreshCw size={16} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                重新渲染
              </button>
              <button
                onClick={() => setIsPremium(!isPremium)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  isPremium
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-gray-50 text-slate-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">{isPremium ? '✨' : '◻'}</span>
                {isPremium ? 'Export 模式（關閉切換 Draft）' : 'Draft 模式（點擊切換 Export）'}
              </button>
              <button
                onClick={() => { handleDownload(); setIsControlBarOpen(false); }}
                disabled={isRecording}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-transform ${
                  isRecording
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-[1.02]'
                }`}
              >
                <Video size={16} />
                {isRecording ? '錄製中...' : '下載影片'}
              </button>
            </div>
          </div>
        </div>
      </>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ===== 左側 Editor 面板 ===== */}
        <div
          className={`
            flex-shrink-0 border-gray-200 flex flex-col bg-white relative
            ${isEditorOpen
              ? 'h-[40vh] lg:h-auto border-b lg:border-b-0 lg:border-r'
              : 'h-8 lg:h-auto border-b-0 lg:border-r'
            }
          `}
          style={isDesktop
            ? { width: isEditorOpen ? editorWidth : 32, transition: isResizingRef.current ? 'none' : 'width 0.25s ease' }
            : undefined
          }
        >
          {/* 標題列 */}
          <div className="px-2 py-1.5 border-b border-gray-200 text-xs font-semibold text-slate-500 flex justify-between items-center bg-gray-50 flex-shrink-0 min-w-0">
            {isEditorOpen ? (
              <>
                <span className="flex items-center gap-1.5 truncate"><Code size={12}/> MERMAID SOURCE</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setCode(SEQUENCE_CODE)} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Sequence">
                    <FileText size={9}/> <span className="hidden xl:inline">Sequence</span><span className="xl:hidden">Seq</span>
                  </button>
                  <button onClick={() => setCode(FLOWCHART_CODE)} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Flowchart">
                    <Activity size={9}/> <span className="hidden xl:inline">Flowchart</span><span className="xl:hidden">Flow</span>
                  </button>
                  <button onClick={() => setCode(ARCH_CODE)} className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="Architecture">
                    <Server size={9}/> <span className="hidden xl:inline">Architecture</span><span className="xl:hidden">Arch</span>
                  </button>
                  {/* 收合按鈕 — 桌面版顯示在標題列右側 */}
                  <button
                    onClick={() => setIsEditorOpen(false)}
                    className="hidden lg:flex ml-1 w-5 h-5 items-center justify-center rounded hover:bg-gray-200 text-slate-400 hover:text-slate-600 transition-colors"
                    title="收合編輯器"
                  >
                    <X size={11} />
                  </button>
                </div>
              </>
            ) : (
              /* 收合狀態：只顯示展開按鈕（桌面版直向排列） */
              <button
                onClick={() => setIsEditorOpen(true)}
                className="hidden lg:flex w-full h-full items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                title="展開編輯器"
              >
                <Code size={13} />
              </button>
            )}
            {/* 手機版：收合 / 展開按鈕（固定顯示，不受 isEditorOpen 影響） */}
            {isEditorOpen && (
              <button
                onClick={() => setIsEditorOpen(false)}
                className="lg:hidden ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-slate-400 transition-colors"
                title="收合編輯器"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* 內容區：只在展開時顯示 */}
          {isEditorOpen && (
            <>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                className="flex-1 bg-white text-slate-800 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                spellCheck={false}
              />
              {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs border-t border-red-100">⚠️ {errorMsg}</div>}
            </>
          )}

          {/* Resize handle — 桌面版才顯示，貼在面板右邊緣 */}
          {isDesktop && isEditorOpen && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-30 group"
              title="拖曳調整寬度"
            >
              {/* 視覺指示條：hover 時才顯示 */}
              <div className="absolute inset-y-0 right-0 w-1 bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full" />
            </div>
          )}
        </div>

        {/* ===== 右側 Canvas 預覽區 ===== */}
        <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden min-h-0 bg-gray-100">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 z-10 backdrop-blur-sm">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Rendering...</p>
            </div>
          )}

          {/* 展開編輯器按鈕（桌面版，僅在收合時顯示） */}
          {!isEditorOpen && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="hidden lg:flex absolute top-3 left-3 z-20 items-center gap-1.5 px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm text-xs text-slate-600 hover:bg-white transition-colors"
              title="展開編輯器"
            >
              <Code size={12} />
              <span>編輯</span>
            </button>
          )}

          {/* 手機版展開按鈕（editor 收合時顯示） */}
          {!isEditorOpen && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="lg:hidden absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm text-xs text-slate-600"
            >
              <Code size={12} />
              <span>編輯</span>
            </button>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="block w-full h-full"
            style={{ cursor: 'grab' }}
          />

          {/* 縮放工具列 — 右下角浮動，緊湊版 */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 z-20 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm px-1.5 py-1">
            <span className="text-[10px] font-mono text-slate-400 w-8 text-center tabular-nums">
              {Math.round(transformState.scale * 100)}%
            </span>
            <div className="w-px h-3.5 bg-gray-200" />
            <button
              onClick={handleZoomOut}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
              title="縮小"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={handleZoomIn}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
              title="放大"
            >
              <ZoomIn size={12} />
            </button>
            <div className="w-px h-3.5 bg-gray-200" />
            <button
              onClick={handleFit}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-500"
              title="符合畫面"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={handleResetZoom}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all text-slate-400"
              title="重置"
            >
              <RotateCcw size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasDiagram;