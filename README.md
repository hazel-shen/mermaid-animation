(🚧：It's still under development...)

# Mermaid Animation: Universal Diagram Animator

Mermaid Animation is a high-performance tool built with React 19 and Tailwind CSS v4, specifically designed for Mermaid.js diagrams. It automatically parses diagram paths and renders fluid particle animations using the Canvas API, transforming static architecture and sequence diagrams into dynamic visual assets.

Check the site [here](https://www.hazelshen.me/mermaid-animation/)

## Key Features

- **Broad Diagram Support**: Fully compatible with Sequence Diagrams, Flowcharts, and Architecture Diagrams.
- **High-Performance Rendering**: Built on the HTML5 Canvas API to maintain 60 FPS even with complex, large-scale diagrams.
- **Design System Controls**:
  - **Premium Mode**: Toggle advanced rendering effects including particle glow and refined pathing.
  - **Parameterized Tuning**: Real-time control over particle Speed and Color.
- **Export Capabilities**: Built-in WebM recording for seamless integration into presentations or technical documentation.
- **High-Density UI**: Compact layout optimized for SRE/DevOps workflows, driven by Tailwind v4 CSS variables.

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
