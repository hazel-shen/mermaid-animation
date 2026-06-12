import { describe, it, expect } from 'vitest';
import { formatMermaidError } from '../../utils/formatMermaidError';

/**
 * Fixtures below mirror the actual messages Mermaid 11 throws from render().
 * Each one is annotated with the example Mermaid source that produces it,
 * so the fixtures can be reproduced/refreshed against a real Mermaid build.
 */

// Produced by:
//   graph TB
//     A[開始] --> B{判斷}
//     B -- 是 --> C[結束
// (unclosed bracket on the last node)
const FLOWCHART_PARSE_ERROR = [
  'Parse error on line 3:',
  '...判斷}    B -- 是 --> C[結束',
  '----------------------^',
  "Expecting 'SQE', 'DOUBLECIRCLEEND', 'PE', '-)', 'STADIUMEND', 'SUBROUTINEEND', 'PIPE', 'CYLINDEREND', 'DIAMOND_STOP', 'TAGEND', 'TRAPEND', 'INVTRAPEND', 'UNICODE_TEXT', 'TEXT', 'TAGSTART', got 'EOF'",
].join('\n');

// Produced by:
//   sequenceDiagram
//     Alice->>Bob: Hello
//     Bob-->>: missing target
const SEQUENCE_PARSE_ERROR = [
  'Parse error on line 3:',
  '...e->>Bob: Hello    Bob-->>: missing tar',
  '----------------------^',
  "Expecting 'ACTOR', got 'TXT'",
].join('\n');

// Produced by source whose first keyword Mermaid doesn't recognize:
//   grph TB
//     A --> B
const NO_DIAGRAM_TYPE_ERROR =
  'No diagram type detected matching given configuration for text: grph TB\n  A --> B';

describe('formatMermaidError', () => {
  it('returns generic fallback for undefined message', () => {
    expect(formatMermaidError(undefined)).toBe('語法錯誤或無法解析');
  });

  it('returns generic fallback for null message', () => {
    expect(formatMermaidError(null)).toBe('語法錯誤或無法解析');
  });

  it('returns generic fallback for empty / whitespace-only message', () => {
    expect(formatMermaidError('')).toBe('語法錯誤或無法解析');
    expect(formatMermaidError('   \n  ')).toBe('語法錯誤或無法解析');
  });

  it('maps "No diagram type detected" to the diagram-type hint', () => {
    expect(formatMermaidError(NO_DIAGRAM_TYPE_ERROR)).toBe(
      '無法識別圖表類型，請檢查開頭關鍵字 (如 sequenceDiagram, graph TB, classDiagram)'
    );
  });

  it('preserves the full multi-line flowchart parse error', () => {
    const result = formatMermaidError(FLOWCHART_PARSE_ERROR);
    expect(result).toBe(FLOWCHART_PARSE_ERROR);
    // The parts the old first-line truncation used to drop:
    expect(result).toContain('Parse error on line 3:');
    expect(result).toContain('----------------------^');
    expect(result).toContain("got 'EOF'");
  });

  it('preserves the full multi-line sequence parse error', () => {
    const result = formatMermaidError(SEQUENCE_PARSE_ERROR);
    expect(result).toBe(SEQUENCE_PARSE_ERROR);
    expect(result).toContain("Expecting 'ACTOR', got 'TXT'");
  });

  it('passes through single-line errors unchanged', () => {
    expect(formatMermaidError('SVG 生成失敗')).toBe('SVG 生成失敗');
  });

  it('trims surrounding whitespace', () => {
    expect(formatMermaidError('\nParse error on line 1:\nfoo\n')).toBe(
      'Parse error on line 1:\nfoo'
    );
  });

  it('caps pathological messages at 8 lines and appends ellipsis', () => {
    const longMessage = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = formatMermaidError(longMessage);
    const lines = result.split('\n');
    expect(lines).toHaveLength(9);
    expect(lines[7]).toBe('line 8');
    expect(lines[8]).toBe('…');
  });

  it('does not truncate a message of exactly 8 lines', () => {
    const exact = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n');
    expect(formatMermaidError(exact)).toBe(exact);
  });
});
