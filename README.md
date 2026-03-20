(🚧：It's still under development...)

# Mermaid Animation: Universal Diagram Animator

Mermaid Animation is a high-performance tool built with React 19 and Tailwind CSS v4, specifically designed for Mermaid.js diagrams. It automatically parses diagram paths and renders fluid particle animations using the Canvas API, transforming static architecture and sequence diagrams into dynamic visual assets.

Check the site [here](https://www.hazelshen.me/mermaid-animation/)

## Key Features

- **Multi-Diagram Support**: Renders Sequence Diagrams, Flowcharts, and Architecture Diagrams from a single Mermaid source.
- **Particle Animation Engine**: Automatically traces diagram paths and overlays smooth, real-time particle flows using the Canvas API at 60 FPS.
- **Live Tuning Controls**: Adjust particle speed and color on the fly without re-rendering the diagram.
- **Export / Draft Mode**: Switch between a polished Export mode (with glow effects and grid) and a clean Draft mode for quick iteration.
- **Video Export**: Records and downloads the animated canvas as a 1280×720 video (MP4 or WebM) with 2× supersampling for sharp output.
- **Pan, Zoom & Fit**: Full interactive canvas navigation — scroll to zoom, drag to pan, and one-click fit-to-screen.
- **Responsive Layout**: Collapsible editor sidebar with drag-to-resize on desktop and a slide-up drawer on mobile.

## Tech Stack

- **Framework**: React 19 (Client-side Rendering)
- **Build Tooling**: Vite 6
- **Styling Engine**: Tailwind CSS v4 (Theme-driven via CSS variables)
- **Diagramming**: Mermaid.js
- **Iconography**: Lucide-React
- **Hosting**: GitHub Pages (Static Hosting)

## Development and Deployment

### Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build the project and deploy to gh-pages branch
npm run deploy
```

## Security Audit

In light of the critical vulnerabilities discovered in late 2025 regarding React 19, this project has undergone the following security assessment:

CVE-2025-55182 (React2Shell) Mitigation: This vulnerability targets the React Server Components (RSC) "Flight" protocol during server-side deserialization.

Architectural Isolation: This project utilizes a pure Client-side Rendering (CSR) architecture and is hosted in a static environment on GitHub Pages.

Conclusion: Because the application lacks a Node.js server-side decoder to process react-server data streams, it maintains No Attack Surface regarding this 10.0 CVSS vulnerability.

## Architecture

```bash
src/
├── App.tsx                        ← Orchestrates all layers
├── types/
│   └── index.ts                   ← Shared types (DiagramNode, DiagramEdge, SeqLabel, Transform…)
├── utils/
│   ├── particle.ts                ← Particle class
│   ├── colorUtils.ts              ← hexToRgba utility function
│   └── canvasRenderer.ts          ← drawGrid / drawNode / drawEdge / renderFrame (pure functions)
├── services/
│   ├── svgUtils.ts                ← getCumulativeTransform (shared SVG helper)
│   ├── SequenceParser.ts          ← Sequence diagram parser (nodes / edges / labels / loopFrames)
│   └── FlowchartParser.ts         ← Flowchart parser (nodes / edges)
├── hooks/
│   ├── useMermaidParser.ts        ← Mermaid script loading + render + SVG parsing
│   ├── useCanvasTransform.ts      ← Pan / Zoom / Fit / Hover collision detection
│   ├── useCanvasResize.ts         ← Syncs canvas buffer with container via ResizeObserver
│   ├── useParticleSystem.ts       ← Generates Particle array based on edges
│   ├── useMediaRecorder.ts        ← 2× supersampling video recording + download
│   └── useEditorResize.ts         ← Sidebar width adjustment/resizing
└── components/
    ├── AppHeader.tsx              ← Top navigation bar (particle controls + action buttons)
    ├── EditorSidebar.tsx          ← Left-side Mermaid editor panel
    ├── CanvasView.tsx             ← Canvas preview area + expand/collapse button
    ├── ZoomToolbar.tsx            ← Bottom-right zoom toolkit
    └── MobileDrawer.tsx           ← Mobile bottom drawer + FAB (Floating Action Button)
```