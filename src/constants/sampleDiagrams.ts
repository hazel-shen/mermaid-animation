// Sample Mermaid sources shown in the editor's sample picker.
// Keys double as i18n suffixes: labels come from t(`samples.${key}`).

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

export const SAMPLES: Record<string, string> = {
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

// Picker display order.
export const SAMPLE_KEYS = Object.keys(SAMPLES);

export const DEFAULT_SAMPLE_KEY = 'sequence';
