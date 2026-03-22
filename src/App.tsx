import React, { useRef, useEffect, useState, useCallback } from 'react';

import { AppHeader } from './components/AppHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasView } from './components/CanvasView';
import { MobileDrawer } from './components/MobileDrawer';

import { useMermaidParser } from './hooks/useMermaidParser';
import { useCanvasTransform, useCanvasResize } from './hooks/useCanvasTransform';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useEditorResize } from './hooks/useEditorResize';

import { renderFrame } from './utils/canvasRenderer';
import type { ParticleShape } from './utils/canvasRenderer';

// --- 預設代碼 ---
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

const FLOWCHART_CODE = `graph LR
    W0["Week 0<br/>GCP: 100%"]
    W1["Week 1<br/>GCP: 60%"]
    W2["Week 2<br/>GCP: 25%"]
    W3["Week 3<br/>GCP: 5%"]
    W4["Week 4<br/>GCP: 0.8%"]
    
    W0 --> W1 --> W2 --> W3 --> W4
    
    style W0 fill:#4285f4,color:#fff,stroke:#333
    style W1 fill:#7aa9f7,color:#fff,stroke:#333
    style W2 fill:#f7c47a,color:#000,stroke:#333
    style W3 fill:#ffb347,color:#000,stroke:#333
    style W4 fill:#ff9900,color:#000,stroke:#333,stroke-width:4px`;

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

const CLASS_CODE = `classDiagram
    class Portfolio {
        +String owner
        +float totalValue
        +updateTotalValue()
        +getAllocation() Map
    }

    class Account {
        +String brokerName
        +String currency
        +float balance
        +deposit(amount)
    }

    class Asset {
        <<abstract>>
        +String symbol
        +String name
        +float currentPrice
        +int quantity
        +getMarketValue() float
    }

    class ETF {
        +String expenseRatio
        +String region
        +String indexTracked
        +rebalance()
    }

    class Cash {
        +float interestRate
    }

    class Transaction {
        +DateTime timestamp
        +String type
        +float price
        +int units
        +record()
    }

    %% 關係定義
    Portfolio "1" *-- "many" Account : manages
    Account "1" o-- "many" Asset : holds
    Asset <|-- ETF : inheritance
    Asset <|-- Cash : inheritance
    Asset "1" -- "many" Transaction : generates`;

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
  };

  const SAMPLE_OPTIONS = [
    { value: 'sequence',  label: 'Sequence Diagram' },
    { value: 'flowchart', label: 'Flowchart' },
    { value: 'arch',      label: 'Architecture' },
    { value: 'class',     label: 'Class Diagram' },
    { value: 'state',     label: 'State Diagram (TODO)' },
    { value: 'er',        label: 'ER Diagram (TODO)' },
    { value: 'gantt',     label: 'Gantt Chart (TODO)' },
    { value: 'pie',       label: 'Pie Chart (TODO)' },
    { value: 'gitgraph',  label: 'Git Graph (TODO)' },
  ];

  // UI state
  const [selectedSample, setSelectedSample] = useState('sequence');
  const [code, setCode] = useState(SEQUENCE_CODE);
  const [isPremium, setIsPremium] = useState(true);
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
    useMermaidParser(code, isPremium, hiddenContainerRef as React.RefObject<HTMLDivElement>);
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

      if (isPremium) particles.forEach(p => p.update(particleSpeed));

      renderFrame(ctx, w, h, tr, offset, isRecording, {
        nodes,
        edges,
        particles,
        seqLabels,
        isPremium,
        particleColor,
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
  }, [nodes, edges, particles, seqLabels, isPremium, isRecording, particleColor, particleSpeed, particleSize, particleShape, transformState]);

  // --- Download handler ---
  const handleDownload = useCallback((format: import('./hooks/useMediaRecorder').DownloadFormat) => {
    startDownload(
      canvasRef,
      diagramSizeRef,
      { nodes, edges, particles, seqLabels, isPremium, particleColor, particleSize, particleShape, isRecording, hoveredNodeId: hoveredNodeIdRef.current },
      format
    );
  }, [startDownload, nodes, edges, particles, seqLabels, isPremium, particleColor, particleSize, particleShape, isRecording, diagramSizeRef]);

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
        isPremium={isPremium}
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        onTogglePremium={() => setIsPremium(v => !v)}
        onRefresh={renderMermaidToData}
        onDownload={handleDownload}
        onParticleSpeedChange={setParticleSpeed}
        onParticleColorChange={setParticleColor}
        onParticleSizeChange={setParticleSize}
        onParticleShapeChange={setParticleShape}
      />

      <MobileDrawer
        isOpen={isControlBarOpen}
        isPremium={isPremium}
        isLoading={isLoading}
        isRecording={isRecording}
        particleSpeed={particleSpeed}
        particleColor={particleColor}
        particleSize={particleSize}
        particleShape={particleShape}
        onClose={() => setIsControlBarOpen(false)}
        onToggle={() => setIsControlBarOpen(v => !v)}
        onTogglePremium={() => setIsPremium(v => !v)}
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
