import { describe, it, expect } from 'vitest';
import { getDiagramType } from '../services/diagramTypes';

describe('getDiagramType', () => {
  // ── Known diagram types ───────────────────────────────────────────────────

  it('detects flowchart from "graph TB"', () => {
    expect(getDiagramType('graph TB\n  A --> B')).toBe('flowchart');
  });

  it('detects flowchart from "flowchart LR"', () => {
    expect(getDiagramType('flowchart LR\n  A --> B')).toBe('flowchart');
  });

  it('detects sequence from "sequenceDiagram"', () => {
    expect(getDiagramType('sequenceDiagram\n  Alice->>Bob: Hello')).toBe('sequence');
  });

  it('detects class from "classDiagram"', () => {
    expect(getDiagramType('classDiagram\n  Animal <|-- Duck')).toBe('class');
  });

  it('detects state from "stateDiagram"', () => {
    expect(getDiagramType('stateDiagram\n  [*] --> Active')).toBe('state');
  });

  it('detects state from "stateDiagram-v2"', () => {
    expect(getDiagramType('stateDiagram-v2\n  [*] --> Active')).toBe('state');
  });

  it('detects er from "erDiagram"', () => {
    expect(getDiagramType('erDiagram\n  Customer ||--o{ Order : places')).toBe('er');
  });

  it('detects gantt', () => {
    expect(getDiagramType('gantt\n  title A Gantt Diagram')).toBe('gantt');
  });

  it('detects timeline', () => {
    expect(getDiagramType('timeline\n  title History')).toBe('timeline');
  });

  it('detects pie', () => {
    expect(getDiagramType('pie\n  title Pets')).toBe('pie');
  });

  it('detects mindmap', () => {
    expect(getDiagramType('mindmap\n  root((Root))')).toBe('mindmap');
  });

  it('detects gitgraph', () => {
    expect(getDiagramType('gitGraph\n  commit')).toBe('gitgraph');
  });

  it('detects sankey from "sankey-beta"', () => {
    expect(getDiagramType('sankey-beta\n  A,B,10')).toBe('sankey');
  });

  it('returns generic for unknown diagram type', () => {
    expect(getDiagramType('unknownDiagram\n  foo')).toBe('generic');
  });

  // ── Case-insensitivity ────────────────────────────────────────────────────

  it('is case-insensitive for diagram keywords', () => {
    expect(getDiagramType('GRAPH TB\n  A --> B')).toBe('flowchart');
    expect(getDiagramType('SequenceDiagram')).toBe('sequence');
    expect(getDiagramType('CLASSDIAGRAM')).toBe('class');
  });

  // ── Front-matter / comments / blank lines ─────────────────────────────────

  it('skips %%{init: ...}%% directive and reads the next meaningful line', () => {
    const code = '%%{init: {"theme": "base"}}%%\nflowchart TD\n  A --> B';
    expect(getDiagramType(code)).toBe('flowchart');
  });

  it('skips blank lines before the first keyword', () => {
    expect(getDiagramType('\n\n  \nsequenceDiagram')).toBe('sequence');
  });

  it('skips %% comment lines', () => {
    expect(getDiagramType('%% this is a comment\nclassDiagram')).toBe('class');
  });

  it('skips multiple %% lines and front-matter together', () => {
    const code = '%%{init: {}}%%\n%% author: me\n\nerDiagram\n  A ||--o{ B : rel';
    expect(getDiagramType(code)).toBe('er');
  });

  it('trims leading and trailing whitespace from each line', () => {
    expect(getDiagramType('   gantt   \n  title G')).toBe('gantt');
  });

  it('returns generic for completely empty input', () => {
    expect(getDiagramType('')).toBe('generic');
  });

  it('returns generic for only blank lines', () => {
    expect(getDiagramType('\n\n\n')).toBe('generic');
  });

  it('returns generic for only %% comments', () => {
    expect(getDiagramType('%% comment only')).toBe('generic');
  });
});
