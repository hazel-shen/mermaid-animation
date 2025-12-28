import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Zap, Video, Loader2, Code, RefreshCw, FileText, Activity, Palette, Server, Gauge } from 'lucide-react';

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
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`;

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
  
  const [isPremium, setIsPremium] = useState(true);
  const [particleColor, setParticleColor] = useState('#6366f1'); // 粒子顏色
  const [particleSpeed, setParticleSpeed] = useState(1);        // 粒子速度倍率
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        const match = transform.match(/translate\s*\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/);
        if (match) {
          x += parseFloat(match[1]);
          y += parseFloat(match[2]);
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
              dash = style.strokeDasharray.split(',').map(n => parseFloat(n));
          }

          const tagName = el.tagName.toLowerCase();

          if (tagName === 'line') {
              const x1 = el.getAttribute('x1');
              const y1 = el.getAttribute('y1');
              const x2 = el.getAttribute('x2');
              const y2 = el.getAttribute('y2');
              if (x1 && y1 && x2 && y2) {
                  d = `M ${x1} ${y1} L ${x2} ${y2}`;
              }
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

      svgElement.querySelectorAll(linkSelector).forEach(el => processEdge(el, 'link'));
      svgElement.querySelectorAll(structSelector).forEach(el => processEdge(el, 'structural'));

      svgElement.querySelectorAll('line').forEach(line => {
          const x1 = parseFloat(line.getAttribute('x1') || '0');
          const x2 = parseFloat(line.getAttribute('x2') || '0');
          const y1 = parseFloat(line.getAttribute('y1') || '0');
          const y2 = parseFloat(line.getAttribute('y2') || '0');
          
          const dx = Math.abs(x2 - x1);
          const dy = Math.abs(y2 - y1);
          
          if (dy > dx * 3 && dy > 50) {
              const potentialPath = `M ${x1} ${y1} L ${x2} ${y2}`;
              const alreadyProcessed = extractedEdges.some(e => e.pathD === potentialPath);
              if (!alreadyProcessed) {
                  processEdge(line, 'structural');
              }
          }
      });

      setNodes(extractedNodes);
      setEdges(extractedEdges);
      
      if (canvasRef.current) {
          canvasRef.current.width = viewBox.width + 100;
          canvasRef.current.height = viewBox.height + 100;
          (canvasRef.current as any).viewBoxOffset = { x: -viewBox.x + 50, y: -viewBox.y + 50 };
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

  // 互動處理: 滑鼠移動
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
      // 轉換為 Canvas 內的世界座標
      const mouseX = rawX - offset.x;
      const mouseY = rawY - offset.y;

      // 碰撞檢測
      let foundId = null;
      for (const node of nodes) {
          // 簡單的矩形碰撞檢測
          if (
              mouseX >= node.x - node.width / 2 &&
              mouseX <= node.x + node.width / 2 &&
              mouseY >= node.y - node.height / 2 &&
              mouseY <= node.y + node.height / 2
          ) {
              foundId = node.id;
              break; // 找到第一個重疊的節點即可
          }
      }

      hoveredNodeIdRef.current = foundId;
      canvas.style.cursor = foundId ? 'pointer' : 'default';
  };

  const handleMouseLeave = () => {
      hoveredNodeIdRef.current = null;
      if (canvasRef.current) {
          canvasRef.current.style.cursor = 'default';
      }
  };

  // 5. 繪圖
  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      let rafId: number;

      const render = () => {
          const w = canvas.width; const h = canvas.height;
          const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };

          ctx.fillStyle = isPremium ? '#f8fafc' : '#fff'; 
          ctx.fillRect(0, 0, w, h);
          
          ctx.save();
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
  }, [nodes, edges, particles, isPremium, isRecording, particleColor, particleSpeed]); // 加入 particleSpeed 依賴

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

      ctx.fillStyle = '#000000'; 
      ctx.font = node.type === 'cluster' ? 'bold 12px Inter' : 'bold 14px Inter';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      
      if (node.type === 'cluster') {
          ctx.fillText(label, x, y - height/2 + 20);
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
     const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
     const chunks: any[] = [];
     recorder.ondataavailable = e => chunks.push(e.data);
     recorder.onstop = () => {
         const url = URL.createObjectURL(new Blob(chunks));
         const a = document.createElement('a'); a.href=url; a.download='flowmotion.webm'; a.click();
         setIsRecording(false);
     };
     recorder.start();
     setTimeout(() => recorder.stop(), 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-slate-800 font-sans">
      <div ref={hiddenContainerRef} style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', pointerEvents: 'none' }}></div>

      <header className="border-b border-gray-200 p-4 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
         <div className="flex items-center gap-3">
             <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm"><Zap size={22} className="text-white" /></div>
             <div>
                 <h1 className="font-bold text-lg leading-tight text-slate-800">Mermaid Animation</h1>
                 <p className="text-xs text-slate-500">Universal Mermaid Animator</p>
             </div>
         </div>
         <div className="flex gap-2 items-center">
            {isPremium && (
                <>
                {/* 速度控制 */}
                <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
                    <label className="flex items-center gap-1 text-sm text-slate-600 hover:bg-gray-50 px-2 py-1.5 rounded cursor-pointer border border-transparent hover:border-gray-200 transition-colors" title="更改粒子速度">
                        <Gauge size={22} className="text-slate-500" />
                        <span className="text-lg font-medium">速度</span>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="5" 
                            step="0.1"
                            value={particleSpeed} 
                            onChange={(e) => setParticleSpeed(parseFloat(e.target.value))}
                            className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 ml-2"
                        />
                    </label>
                </div>
                {/* 顏色控制 */}
                <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
                    <label className="flex items-center gap-1 text-sm text-slate-600 hover:bg-gray-50 px-2 py-1.5 rounded cursor-pointer border border-transparent hover:border-gray-200 transition-colors" title="更改粒子顏色">
                        <Palette size={22} className="text-slate-500" />
                        <span className="text-lg font-medium">粒子色</span>
                        <input 
                            type="color" 
                            value={particleColor} 
                            onChange={(e) => setParticleColor(e.target.value)}
                            className="w-5 h-5 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer ml-1"
                        />
                    </label>
                </div>
                </>
            )}
            
            <button onClick={renderMermaidToData} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 rounded text-sm flex items-center gap-2 shadow-sm transition-colors">
                <RefreshCw size={22} className={isLoading ? 'animate-spin' : ''}/> 重新渲染
            </button>
            <button 
              onClick={() => setIsPremium(!isPremium)} 
              className={`px-4 py-2 rounded text-sm border shadow-sm transition-colors ${
                isPremium 
                  ? 'bg-indigo-600  text-slate-700 border-indigo-600 hover:bg-indigo-700' 
                  : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isPremium ? '✨ Premium Style' : 'Draft Style'}
            </button>
            <button onClick={handleDownload} disabled={isRecording} className={`px-4 py-2 rounded text-sm flex gap-2 font-bold shadow-sm transition-transform ${isRecording ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105'}`}>
                <Video size={22}/> {isRecording ? 'REC...' : 'Download'}
            </button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r border-gray-200 flex flex-col bg-white">
            <div className="p-3 border-b border-gray-200 text-xs font-semibold text-slate-500 flex justify-between items-center bg-gray-50">
                <span className="flex items-center gap-2"><Code size={14}/> MERMAID SOURCE</span>
                <div className="flex gap-1">
                    <button onClick={() => setCode(SEQUENCE_CODE)} className="px-2 py-1 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="載入時序圖範例">
                        <FileText size={10}/> Sequence
                    </button>
                    <button onClick={() => setCode(FLOWCHART_CODE)} className="px-2 py-1 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="載入流程圖範例">
                        <Activity size={10}/> Flowchart
                    </button>
                    <button onClick={() => setCode(ARCH_CODE)} className="px-2 py-1 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1" title="載入架構圖範例">
                        <Server size={10}/> Architecture
                    </button>
                </div>
            </div>
            <textarea 
                value={code} 
                onChange={e=>setCode(e.target.value)} 
                className="flex-1 bg-white text-slate-800 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                spellCheck={false}
            />
            {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs border-t border-red-100">⚠️ {errorMsg}</div>}
        </div>
        
        <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto relative">
             {isLoading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 z-10 backdrop-blur-sm">
                     <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                     <p className="text-slate-600 font-medium">Rendering...</p>
                 </div>
             )}
             <div className="rounded-xl overflow-hidden border border-gray-200 shadow-xl bg-white">
                {/* 綁定滑鼠事件 */}
                <canvas 
                    ref={canvasRef} 
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="w-full h-full block"
                />
             </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasDiagram;