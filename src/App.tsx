import React, { useRef, useEffect, useState, useCallback } from 'react';

import { AppHeader } from './components/AppHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasView } from './components/CanvasView';
import { MobileDrawer } from './components/MobileDrawer';
import { Maximize2, Code, X, SlidersHorizontal } from 'lucide-react';
import { ExportModal, type ExportFormat } from './components/ExportModal';

import { useMermaidParser } from './hooks/useMermaidParser';
import { useCanvasTransform, useCanvasResize } from './hooks/useCanvasTransform';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useEditorResize } from './hooks/useEditorResize';

import { renderFrame } from './utils/canvasRenderer';
import type { ParticleShape, ExportBg } from './utils/canvasRenderer';

// --- 預設代碼 ---
const SEQUENCE_CODE = `sequenceDiagram
    actor User
    participant Browser
    participant API
    participant Auth
    participant DB

    User->>Browser: 輸入帳號密碼
    Browser->>API: POST /auth/login
    API->>Auth: 驗證憑證
    Auth->>DB: 查詢使用者
    DB-->>Auth: 回傳使用者資料
    Auth-->>API: 驗證成功
    API-->>Browser: 回傳 JWT Token
    Browser-->>User: 登入成功 ✓

    Note over Browser,API: Token 有效期 1 小時

    loop Token 即將過期
        Browser->>API: POST /auth/refresh
        API-->>Browser: 新 JWT Token
    end`;

const FLOWCHART_CODE = `flowchart TB
    Client([🌐 用戶端])

    subgraph Edge["邊緣層"]
        CDN[CDN]
        LB[Load Balancer]
    end

    subgraph Services["應用服務"]
        GW[API Gateway]
        Auth[認證服務]
        User[用戶服務]
        Notify[通知服務]
    end

    subgraph Data["資料層"]
        PG[(PostgreSQL)]
        Cache[(Redis)]
        Queue[(Message Queue)]
    end

    Client --> CDN --> LB --> GW
    GW --> Auth
    GW --> User
    GW --> Notify
    Auth --> Cache
    User --> PG
    User --> Cache
    Notify --> Queue`;

const ARCH_CODE = `C4Context
    title System Context diagram for Internet Banking System
    Enterprise_Boundary(b0, "BankBoundary0") {
        Person(customerA, "Banking Customer A", "A customer of the bank, with personal bank accounts.")
        Person(customerB, "Banking Customer B")
        Person_Ext(customerC, "Banking Customer C", "desc")
        Person(customerD, "Banking Customer D", "A customer of the bank, <br/> with personal bank accounts.")

        System(SystemAA, "Internet Banking System", "Allows customers to view information about their bank accounts, and make payments.")

        Enterprise_Boundary(b1, "BankBoundary") {
            SystemDb_Ext(SystemE, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")
            System_Boundary(b2, "BankBoundary2") {
                System(SystemA, "Banking System A")
                System(SystemB, "Banking System B", "A system of the bank, with personal bank accounts. next line.")
            }
            System_Ext(SystemC, "E-mail system", "The internal Microsoft Exchange e-mail system.")
            SystemDb(SystemD, "Banking System D Database", "A system of the bank, with personal bank accounts.")
            Boundary(b3, "BankBoundary3", "boundary") {
                System(SystemF, "Banking System F")
                System(SystemG, "Banking System G", "A system of the bank, with personal bank accounts. next line.")
            }
        }
    }

    BiRel(customerA, SystemAA, "Uses")
    BiRel(SystemAA, SystemE, "Uses")
    Rel(SystemAA, SystemC, "Sends e-mails", "SMTP")
    Rel(SystemC, customerA, "Sends e-mails to")

    UpdateElementStyle(customerA, $fontColor="red", $bgColor="grey", $borderColor="red")
    UpdateRelStyle(customerA, SystemAA, $textColor="blue", $lineColor="blue", $offsetX="5")
    UpdateRelStyle(SystemAA, SystemE, $textColor="blue", $lineColor="blue", $offsetY="-10")
    UpdateRelStyle(SystemAA, SystemC, $textColor="blue", $lineColor="blue", $offsetY="-40", $offsetX="-50")
    UpdateRelStyle(SystemC, customerA, $textColor="red", $lineColor="red", $offsetX="-50", $offsetY="20")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")`;

const CLASS_CODE = `classDiagram
    class User {
        +String id
        +String name
        +String email
        +login() bool
        +logout()
    }

    class Post {
        +String id
        +String title
        +String content
        +Date publishedAt
        +publish()
        +archive()
    }

    class Comment {
        +String id
        +String content
        +edit(content)
        +delete()
    }

    class Tag {
        +String name
        +String color
    }

    User "1" --> "many" Post : writes
    User "1" --> "many" Comment : posts
    Post "1" --> "many" Comment : has
    Post "many" <--> "many" Tag : tagged`;

const STATE_CODE = `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : 收到請求
    Processing --> Success : 處理成功
    Processing --> Error : 發生錯誤
    Success --> Idle : 重置
    Error --> Idle : 重試
    Error --> [*] : 放棄
    
    state Processing {
        [*] --> Validating
        Validating --> Executing
        Executing --> [*]
    }`;

const ER_CODE = `erDiagram
    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created_at
        float total
    }
    PRODUCT {
        int id PK
        string name
        float price
    }
    ORDER_ITEM {
        int order_id FK
        int product_id FK
        int quantity
    }
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "included in"`;

const GANTT_CODE = `gantt
    title 專案開發時程
    dateFormat  YYYY-MM-DD
    section 規劃
    需求分析      :done,    des1, 2024-01-01, 2024-01-07
    系統設計      :done,    des2, 2024-01-08, 5d
    section 開發
    後端實作      :active,  dev1, 2024-01-15, 10d
    前端實作      :         dev2, 2024-01-20, 8d
    section 測試
    整合測試      :         test1, after dev2, 5d
    使用者驗收    :         test2, after test1, 3d`;

const PIE_CODE = `pie title 技術棧佔比
    "TypeScript" : 42
    "Python" : 28
    "Go" : 15
    "Rust" : 10
    "Other" : 5`;

const MINDMAP_CODE = `mindmap
  root((系統設計))
    可靠性
      備援機制
      錯誤處理
      健康檢查
      限流熔斷
    可擴展性
      水平擴展
      快取策略
      負載均衡
      資料分片
    效能
      資料庫索引
      CDN 加速
      非同步處理
      連線池
    安全性
      身份驗證
      授權控制
      資料加密
      稽核日誌`;

const GITGRAPH_CODE = `gitGraph
    commit id: "初始提交"
    commit id: "基礎架構"
    branch feature/auth
    checkout feature/auth
    commit id: "新增登入"
    commit id: "新增註冊"
    checkout main
    branch feature/api
    checkout feature/api
    commit id: "REST API"
    checkout main
    merge feature/auth id: "合併 Auth"
    merge feature/api id: "合併 API"
    commit id: "v1.0 發布"`;

// TODO: implement dedicated SankeyParser (nodes = link bands, edges = flows)
const SANKEY_CODE = `---
config:
  sankey:
    showValues: false
---
sankey-beta

Agricultural 'waste',Bio-conversion,124.729
Bio-conversion,Liquid,0.597
Bio-conversion,Losses,26.862
Bio-conversion,Solid,280.322
Bio-conversion,Gas,81.144
Biofuel imports,Liquid,35
Biomass imports,Solid,35
Coal imports,Coal,11.606
Coal reserves,Coal,63.965
Coal,Solid,75.571
District heating,Industry,10.639
District heating,Heating and cooling - commercial,22.505
District heating,Heating and cooling - homes,46.184
Electricity grid,Over generation / exports,104.453
Electricity grid,Heating and cooling - homes,113.726
Electricity grid,H2 conversion,27.14
Electricity grid,Industry,342.165
Electricity grid,Road transport,37.797
Electricity grid,Agriculture,4.412
Electricity grid,Heating and cooling - commercial,40.858
Electricity grid,Losses,56.691
Electricity grid,Rail transport,7.863
Electricity grid,Lighting & appliances - commercial,90.008
Electricity grid,Lighting & appliances - homes,93.494
Gas imports,Ngas,40.719
Gas reserves,Ngas,82.233
Gas,Heating and cooling - commercial,0.129
Gas,Losses,1.401
Gas,Thermal generation,151.891
Gas,Agriculture,2.096
Gas,Industry,48.58
Geothermal,Electricity grid,7.013
H2 conversion,H2,20.897
H2 conversion,Losses,6.242
H2,Road transport,20.897
Hydro,Electricity grid,6.995
Liquid,Industry,121.066
Liquid,International shipping,128.69
Liquid,Road transport,135.835
Liquid,Domestic aviation,14.458
Liquid,International aviation,206.267
Liquid,Agriculture,3.64
Liquid,National navigation,33.218
Liquid,Rail transport,4.413
Marine algae,Bio-conversion,4.375
Ngas,Gas,122.952
Nuclear,Thermal generation,839.978
Oil imports,Oil,504.287
Oil reserves,Oil,107.703
Oil,Liquid,611.99
Other waste,Solid,56.587
Other waste,Bio-conversion,77.81
Pumped heat,Heating and cooling - homes,193.026
Pumped heat,Heating and cooling - commercial,70.672
Solar PV,Electricity grid,59.901
Solar Thermal,Heating and cooling - homes,19.263
Solar,Solar Thermal,19.263
Solar,Solar PV,59.901
Solid,Agriculture,0.882
Solid,Thermal generation,400.12
Solid,Industry,46.477
Thermal generation,Electricity grid,525.531
Thermal generation,Losses,787.129
Thermal generation,District heating,79.329
Tidal,Electricity grid,9.452
UK land based bioenergy,Bio-conversion,182.01
Wave,Electricity grid,19.013
Wind,Electricity grid,289.366`;

// --- Mobile draggable pill toolbar ---
interface MobilePillToolbarProps {
  isEditorOpen: boolean;
  scale: number;
  isControlBarOpen: boolean;
  onToggleEditor: () => void;
  onFit: () => void;
  onToggleDrawer: () => void;
}

const MobilePillToolbar: React.FC<MobilePillToolbarProps> = ({
  isEditorOpen, scale, isControlBarOpen, onToggleEditor, onFit, onToggleDrawer,
}) => {
  const pillRef = React.useRef<HTMLDivElement>(null);
  const posRef = React.useRef({ x: -1, y: 80 }); // x=-1 means "not yet placed"
  const dragRef = React.useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = React.useRef(false);
  const wasDragRef = React.useRef(false);

  const applyPos = React.useCallback((x: number, y: number) => {
    posRef.current = { x, y };
    if (pillRef.current) {
      pillRef.current.style.right = '';
      pillRef.current.style.left  = `${x}px`;
      pillRef.current.style.top   = `${y}px`;
    }
  }, []);

  // Use layout effect so position is applied before first paint
  React.useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const w = el.offsetWidth || 200;
    const initialX = Math.max(4, window.innerWidth - w - 12);
    applyPos(initialX, 80);
  }, [applyPos]);

  const onDragStart = React.useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    didDragRef.current = false;
    wasDragRef.current = false;
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: posRef.current.x, origY: posRef.current.y,
    };
    pillRef.current?.setPointerCapture(e.pointerId);
    if (pillRef.current) pillRef.current.style.cursor = 'grabbing';
  }, []);

  const onDragMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) didDragRef.current = true;
    if (!didDragRef.current) return;
    const x = Math.max(4, Math.min(window.innerWidth  - 210, dragRef.current.origX + dx));
    const y = Math.max(60, Math.min(window.innerHeight -  40, dragRef.current.origY + dy));
    applyPos(x, y);
  }, [applyPos]);

  const onDragEnd = React.useCallback(() => {
    wasDragRef.current = didDragRef.current;
    dragRef.current = null;
    didDragRef.current = false;
    if (pillRef.current) pillRef.current.style.cursor = 'grab';
  }, []);

  return (
    <div
      ref={pillRef}
      className="lg:hidden fixed z-40 flex items-center bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-md select-none text-[10px]"
      style={{ right: 12, top: 80, cursor: 'grab' }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <button
        onClick={() => { if (!wasDragRef.current) onToggleEditor(); }}
        className="flex items-center gap-0.5 pl-2 pr-1.5 py-1 text-slate-600 active:bg-gray-100 rounded-l-full transition-colors"
      >
        <Code size={10} />
        <span>{isEditorOpen ? '關閉' : '編輯'}</span>
      </button>
      <div className="w-px h-3 bg-gray-200 flex-shrink-0" />
      <span className="font-mono text-slate-400 px-1.5 tabular-nums">
        {Math.round(scale * 100)}%
      </span>
      <div className="w-px h-3 bg-gray-200 flex-shrink-0" />
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => { if (!wasDragRef.current) onFit(); }}
        className="w-6 h-6 flex items-center justify-center text-slate-500 active:bg-gray-100 transition-colors"
        title="符合畫面"
      >
        <Maximize2 size={10} />
      </button>
      <div className="w-px h-3 bg-gray-200 flex-shrink-0" />
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => { if (!wasDragRef.current) onToggleDrawer(); }}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0 m-0.5"
        style={{ background: isControlBarOpen ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
        aria-label={isControlBarOpen ? '隱藏控制列' : '顯示控制列'}
      >
        {isControlBarOpen
          ? <X size={11} className="text-white" />
          : <SlidersHorizontal size={11} className="text-white" />
        }
      </button>
    </div>
  );
};

// --- 主元件 ---
const CanvasDiagram = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);

  // --- Sample map ---
  const SAMPLES: Record<string, string> = {
    sequence:   SEQUENCE_CODE,
    flowchart:  FLOWCHART_CODE,
    arch:       ARCH_CODE,
    class:      CLASS_CODE,
    state:      STATE_CODE,
    er:         ER_CODE,
    gantt:      GANTT_CODE,
    pie:        PIE_CODE,
    gitgraph:   GITGRAPH_CODE,
    mindmap:    MINDMAP_CODE,
    sankey:     SANKEY_CODE,
  };

  const SAMPLE_OPTIONS = [
    { value: 'sequence',  label: 'Sequence Diagram' },
    { value: 'flowchart', label: 'Flowchart' },
    { value: 'arch',      label: 'C4 Diagram（TODO）' },
    { value: 'class',     label: 'Class Diagram' },
    { value: 'state',     label: 'State Diagram' },
    { value: 'er',        label: 'ER Diagram' },
    { value: 'gantt',     label: 'Gantt Chart' },
    { value: 'pie',       label: 'Pie Chart' },
    { value: 'gitgraph',  label: 'Git Graph' },
    { value: 'mindmap',   label: 'Mind Map' },
    { value: 'sankey',    label: 'Sankey Diagram' },
  ];

  // UI state
  const [selectedSample, setSelectedSample] = useState('sequence');
  const [code, setCode] = useState(SEQUENCE_CODE);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [particleColor, setParticleColor] = useState('#2ea4ff');
  const [particleSpeed, setParticleSpeed] = useState(1);
  const [particleSize, setParticleSize] = useState(3);
  const [particleShape, setParticleShape] = useState<ParticleShape>('circle');
  const [isControlBarOpen, setIsControlBarOpen] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  // isDesktop listener
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // --- Hooks ---
  const { nodes, edges, seqLabels, isLoading, errorMsg, renderMermaidToData, viewBox } =
    useMermaidParser(code, true, hiddenContainerRef as React.RefObject<HTMLDivElement>);

  const particles = useParticleSystem(edges);

  const {
    transformRef,
    transformState,
    diagramSizeRef,
    fitToScreen,
    handleZoomIn,
    handleZoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    applyViewBox,
  } = useCanvasTransform(canvasRef);

  const { isRecording, startDownload } = useMediaRecorder();
  const { editorWidth, isResizingRef, handleResizeStart } = useEditorResize(320);

  // Keep canvas buffer synced to container size
  useCanvasResize(canvasRef, canvasContainerRef as React.RefObject<HTMLDivElement>);

  // Apply viewBox whenever a new diagram is parsed
  useEffect(() => {
    if (viewBox) {
      applyViewBox(viewBox, canvasRef, canvasContainerRef as React.RefObject<HTMLDivElement>);
    }
  }, [viewBox, applyViewBox]);

  // Bind wheel + touch events (needs passive:false to preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, nodes]);

  // --- Animation loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      // canvas.width/height are physical pixels; pass CSS-pixel dimensions to renderFrame
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
      const tr = transformRef.current;

      particles.forEach(p => p.update(particleSpeed));

      (canvas as any)._lastTransform = tr;
      renderFrame(ctx, w, h, tr, offset, isRecording, {
        nodes,
        edges,
        particles,
        seqLabels,
        isPremium: true,
        particleColor,
        particleSpeed,
        particleSize,
        particleShape,
        isRecording,
        hoveredNodeId: hoveredNodeIdRef.current,
      }, dpr);

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  // transformRef.current is read inside the loop directly — transformState intentionally omitted
  // to prevent the rAF loop from restarting on every pan/zoom event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, particles, seqLabels, isRecording, particleColor, particleSpeed, particleSize, particleShape]);

  // --- Download handler ---
  const handleDownload = useCallback((format: import('./hooks/useMediaRecorder').DownloadFormat) => {
    startDownload(
      canvasRef,
      diagramSizeRef,
      { nodes, edges, particles, seqLabels, isPremium: true, particleColor, particleSpeed, particleSize, particleShape, isRecording, hoveredNodeId: hoveredNodeIdRef.current },
      format
    );
  }, [startDownload, nodes, edges, particles, seqLabels, particleColor, particleSize, particleShape, isRecording, diagramSizeRef]);

  // --- Shared helper: build tight-crop render options ---
  const buildExportFrame = useCallback((PADDING = 40, SS = 2) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const diagramOffset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
    const { w: dw, h: dh } = diagramSizeRef.current;
    const OUT_W = dw > 0 ? Math.round(dw + PADDING * 2) : 1920;
    const OUT_H = dh > 0 ? Math.round(dh + PADDING * 2) : 1080;
    const SS_W = OUT_W * SS;
    const SS_H = OUT_H * SS;
    const ssTr = { x: PADDING * SS, y: PADDING * SS, scale: SS };
    return { OUT_W, OUT_H, SS_W, SS_H, ssTr, diagramOffset };
  }, [canvasRef, diagramSizeRef]);

  // --- Preview render callback — used by ExportModal ---
  const handlePreviewRender = useCallback((exportBg: ExportBg, dstCanvas: HTMLCanvasElement) => {
    const frame = buildExportFrame(40, 1);
    if (!frame) return;
    const { OUT_W, OUT_H, ssTr, diagramOffset } = frame;
    dstCanvas.width  = OUT_W;
    dstCanvas.height = OUT_H;
    const ctx = dstCanvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, OUT_W, OUT_H, ssTr, diagramOffset, false, {
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
    });
  }, [buildExportFrame, nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape]);

  // --- Static export handler ---
  const handleExport = useCallback((exportBg: ExportBg, format: ExportFormat = 'png') => {
    // MMD: download raw Mermaid source
    if (format === 'mmd') {
      const blob = new Blob([code], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = 'flowmotion.mmd';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      setExportModalOpen(false);
      return;
    }

    // SVG: grab the Mermaid-rendered SVG from the hidden container
    if (format === 'svg') {
      const svgEl = hiddenContainerRef.current?.querySelector('svg');
      if (!svgEl) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = 'flowmotion.svg';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      setExportModalOpen(false);
      return;
    }

    // PNG: tight-crop supersampled render
    const frame = buildExportFrame();
    if (!frame) return;
    const { OUT_W, OUT_H, SS_W, SS_H, ssTr, diagramOffset } = frame;

    const ssCanvas = document.createElement('canvas');
    ssCanvas.width  = SS_W;
    ssCanvas.height = SS_H;
    const ssCtx = ssCanvas.getContext('2d')!;
    renderFrame(ssCtx, SS_W, SS_H, ssTr, diagramOffset, false, {
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
    });

    const outCanvas = document.createElement('canvas');
    outCanvas.width  = OUT_W;
    outCanvas.height = OUT_H;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.drawImage(ssCanvas, 0, 0, OUT_W, OUT_H);

    const link = document.createElement('a');
    link.download = 'flowmotion.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();

    setExportModalOpen(false);
  }, [buildExportFrame, code, hiddenContainerRef, nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape]);

  // --- Mouse event wrappers (bind hoveredNodeIdRef) ---
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => handleMouseMove(e, nodes, hoveredNodeIdRef),
    [handleMouseMove, nodes]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(hoveredNodeIdRef),
    [handleMouseLeave]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      {/* Hidden Mermaid render target */}
      <div
        ref={hiddenContainerRef}
        style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', pointerEvents: 'none' }}
      />

      <AppHeader
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
        onParticleSpeedChange={setParticleSpeed}
        onParticleColorChange={setParticleColor}
        onParticleSizeChange={setParticleSize}
        onParticleShapeChange={setParticleShape}
      />

      {exportModalOpen && (
        <ExportModal
          onConfirm={handleExport}
          onClose={() => setExportModalOpen(false)}
          onPreviewRender={handlePreviewRender}
        />
      )}

      <MobileDrawer
        isOpen={isControlBarOpen}
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        onClose={() => setIsControlBarOpen(false)}
        onExport={() => setExportModalOpen(true)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
        onParticleSpeedChange={setParticleSpeed}
        onParticleColorChange={setParticleColor}
        onParticleSizeChange={setParticleSize}
        onParticleShapeChange={setParticleShape}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <EditorSidebar
          code={code}
          errorMsg={errorMsg}
          isOpen={isEditorOpen}
          isDesktop={isDesktop}
          editorWidth={editorWidth}
          isResizing={isResizingRef.current}
          samples={SAMPLE_OPTIONS}
          selectedSample={selectedSample}
          onCodeChange={setCode}
          onToggleOpen={setIsEditorOpen}
          onLoadSample={(key) => { setSelectedSample(key); setCode(SAMPLES[key] ?? code); }}
          onResizeStart={handleResizeStart}
        />

        <CanvasView
          canvasRef={canvasRef}
          containerRef={canvasContainerRef as React.RefObject<HTMLDivElement>}
          isLoading={isLoading}
          isEditorOpen={isEditorOpen}
          transformState={transformState}
          onOpenEditor={() => setIsEditorOpen(true)}
          onMouseDown={handleMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={onMouseLeave}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={fitToScreen}
          onReset={fitToScreen}
        />
      </div>

      <MobilePillToolbar
        isEditorOpen={isEditorOpen}
        scale={transformState.scale}
        isControlBarOpen={isControlBarOpen}
        onToggleEditor={() => setIsEditorOpen(v => !v)}
        onFit={fitToScreen}
        onToggleDrawer={() => setIsControlBarOpen(v => !v)}
      />
    </div>
  );
};

export default CanvasDiagram;
