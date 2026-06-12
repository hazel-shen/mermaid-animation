import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { classifyMermaidError, parserErrorToText } from '../../utils/parserError';
import type { ParserError } from '../../utils/parserError';
import en from '../../locales/en.json';
import zhTW from '../../locales/zh-TW.json';
import ja from '../../locales/ja.json';

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

// Fake t that records the key and interpolation values, so assertions don't
// depend on any particular locale.
const fakeT = ((key: string, opts?: Record<string, unknown>) =>
  opts && opts.line !== undefined ? `${key}(${opts.line})` : key) as TFunction;

describe('classifyMermaidError', () => {
  it('classifies undefined / null / blank messages as unknown without raw text', () => {
    expect(classifyMermaidError(undefined)).toEqual({ kind: 'unknown', raw: null });
    expect(classifyMermaidError(null)).toEqual({ kind: 'unknown', raw: null });
    expect(classifyMermaidError('   \n  ')).toEqual({ kind: 'unknown', raw: null });
  });

  it('classifies "No diagram type detected" messages', () => {
    expect(classifyMermaidError(NO_DIAGRAM_TYPE_ERROR)).toEqual({ kind: 'no-diagram-type' });
  });

  it('extracts the line number and keeps the full flowchart parse error', () => {
    expect(classifyMermaidError(FLOWCHART_PARSE_ERROR)).toEqual({
      kind: 'parse-error',
      line: 3,
      raw: FLOWCHART_PARSE_ERROR,
    });
  });

  it('extracts the line number and keeps the full sequence parse error', () => {
    const result = classifyMermaidError(SEQUENCE_PARSE_ERROR);
    expect(result.kind).toBe('parse-error');
    if (result.kind === 'parse-error') {
      expect(result.line).toBe(3);
      expect(result.raw).toContain("Expecting 'ACTOR', got 'TXT'");
    }
  });

  it('classifies other messages as unknown but keeps the text', () => {
    expect(classifyMermaidError('Cannot read properties of undefined')).toEqual({
      kind: 'unknown',
      raw: 'Cannot read properties of undefined',
    });
  });

  it('trims surrounding whitespace from kept text', () => {
    const result = classifyMermaidError('\nParse error on line 1:\nfoo\n');
    expect(result).toEqual({ kind: 'parse-error', line: 1, raw: 'Parse error on line 1:\nfoo' });
  });

  it('caps pathological messages at 8 lines and appends ellipsis', () => {
    const longMessage =
      'Parse error on line 2:\n' +
      Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = classifyMermaidError(longMessage);
    expect(result.kind).toBe('parse-error');
    if (result.kind === 'parse-error') {
      const lines = result.raw.split('\n');
      expect(lines).toHaveLength(9);
      expect(lines[8]).toBe('…');
    }
  });
});

describe('parserErrorToText', () => {
  it.each([
    ['load-failed', 'editor.errors.loadFailed'],
    ['empty-code', 'editor.errors.emptyCode'],
    ['classdef-unsupported', 'editor.errors.classDefUnsupported'],
    ['no-diagram-type', 'editor.errors.noDiagramType'],
    ['svg-failed', 'editor.errors.svgFailed'],
  ] as const)('maps %s to its locale key', (kind, key) => {
    expect(parserErrorToText({ kind } as ParserError, fakeT)).toBe(key);
  });

  it('prepends a localized line summary to the raw parse error', () => {
    const error: ParserError = { kind: 'parse-error', line: 3, raw: FLOWCHART_PARSE_ERROR };
    expect(parserErrorToText(error, fakeT)).toBe(
      `editor.errors.parseErrorLine(3)\n${FLOWCHART_PARSE_ERROR}`
    );
  });

  it('shows unknown errors verbatim when raw text exists', () => {
    expect(parserErrorToText({ kind: 'unknown', raw: 'boom' }, fakeT)).toBe('boom');
  });

  it('falls back to the locale key when unknown has no raw text', () => {
    expect(parserErrorToText({ kind: 'unknown', raw: null }, fakeT)).toBe('editor.errors.unknown');
  });
});

describe('locale completeness', () => {
  const REQUIRED_KEYS = [
    'loadFailed',
    'emptyCode',
    'classDefUnsupported',
    'noDiagramType',
    'svgFailed',
    'parseErrorLine',
    'unknown',
  ];

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['ja', ja],
  ])('%s defines every editor.errors key', (_lang, locale) => {
    const errors = (locale as any).editor?.errors;
    expect(errors).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect(errors[key], `missing editor.errors.${key}`).toBeTypeOf('string');
    }
    expect(errors.parseErrorLine).toContain('{{line}}');
  });
});
