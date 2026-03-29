import React, { useRef, useEffect, useState, useCallback } from 'react';

import { AppHeader } from './components/AppHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasView } from './components/CanvasView';
import { MobileDrawer } from './components/MobileDrawer';
import { ExportModal } from './components/ExportModal';

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
  // diagramType is available from useMermaidParser but not consumed at top-level (used internally by parsers)

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

  // Bind wheel event (needs passive:false to preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel, nodes]);

  // --- Animation loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const offset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
      const tr = transformRef.current;

      particles.forEach(p => p.update(particleSpeed));

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
      });

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, particles, seqLabels, isRecording, particleColor, particleSpeed, particleSize, particleShape, transformState]);

  // --- Download handler ---
  const handleDownload = useCallback((format: import('./hooks/useMediaRecorder').DownloadFormat) => {
    startDownload(
      canvasRef,
      diagramSizeRef,
      { nodes, edges, particles, seqLabels, isPremium: true, particleColor, particleSpeed, particleSize, particleShape, isRecording, hoveredNodeId: hoveredNodeIdRef.current },
      format
    );
  }, [startDownload, nodes, edges, particles, seqLabels, particleColor, particleSize, particleShape, isRecording, diagramSizeRef]);

  // --- Static PNG export handler ---
  const handleExport = useCallback((exportBg: ExportBg) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const OUT_W = 1920;
    const OUT_H = 1080;
    const PADDING = 80;

    const diagramOffset = (canvas as any).viewBoxOffset || { x: 0, y: 0 };
    const { w: dw, h: dh } = diagramSizeRef.current;
    const scale = dw > 0 && dh > 0
      ? Math.min((OUT_W - PADDING) / dw, (OUT_H - PADDING) / dh)
      : 1;
    const tr = { x: (OUT_W - dw * scale) / 2, y: (OUT_H - dh * scale) / 2, scale };

    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUT_W;
    outCanvas.height = OUT_H;
    const outCtx = outCanvas.getContext('2d')!;

    renderFrame(outCtx, OUT_W, OUT_H, tr, diagramOffset, false, {
      nodes, edges, particles, seqLabels,
      isPremium: true,
      particleColor, particleSpeed, particleSize, particleShape,
      isRecording: false,
      hoveredNodeId: null,
      exportBg,
    });

    const link = document.createElement('a');
    link.download = 'flowmotion.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();

    setExportModalOpen(false);
  }, [nodes, edges, particles, seqLabels, particleColor, particleSpeed, particleSize, particleShape, diagramSizeRef]);

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
        onToggle={() => setIsControlBarOpen(v => !v)}
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
    </div>
  );
};

export default CanvasDiagram;
