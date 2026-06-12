import type { TFunction } from 'i18next';

/**
 * Structured parser error emitted by useMermaidParser.
 *
 * The hook stores this instead of a display string so the UI layer can
 * translate it at render time — switching the app language updates any
 * visible error message immediately.
 */
export type ParserError =
  | { kind: 'load-failed' }
  | { kind: 'empty-code' }
  | { kind: 'classdef-unsupported' }
  | { kind: 'no-diagram-type' }
  | { kind: 'svg-failed' }
  | { kind: 'parse-error'; line: number; raw: string }
  | { kind: 'unknown'; raw: string | null };

const MAX_LINES = 8;

const capLines = (message: string): string => {
  const lines = message.trim().split('\n');
  if (lines.length <= MAX_LINES) return lines.join('\n');
  return [...lines.slice(0, MAX_LINES), '…'].join('\n');
};

/**
 * Classifies a raw Mermaid render/parse error message.
 *
 * Mermaid (jison) parse errors are multi-line:
 *
 *   Parse error on line 3:
 *   ...A-->B  C--
 *   ----------^
 *   Expecting 'SEMI', 'NEWLINE', got 'EOF'
 *
 * The full message is kept in `raw` (capped at MAX_LINES) because the snippet
 * and the "Expecting ..." hint are the useful part; the extracted line number
 * lets the UI prepend a localized summary line.
 */
export const classifyMermaidError = (message: string | null | undefined): ParserError => {
  if (!message || !message.trim()) return { kind: 'unknown', raw: null };

  if (message.includes('No diagram type detected')) return { kind: 'no-diagram-type' };

  const parseMatch = message.match(/Parse error on line (\d+)/);
  if (parseMatch) {
    return { kind: 'parse-error', line: Number(parseMatch[1]), raw: capLines(message) };
  }

  return { kind: 'unknown', raw: capLines(message) };
};

/**
 * Renders a ParserError to display text using the caller's i18n `t`.
 *
 * Mermaid's own parse error text (line snippet, caret, "Expecting ...") is
 * untranslatable — it is dynamic English output from the jison parser — so it
 * is shown verbatim under a localized summary line.
 */
export const parserErrorToText = (error: ParserError, t: TFunction): string => {
  switch (error.kind) {
    case 'load-failed':
      return t('editor.errors.loadFailed');
    case 'empty-code':
      return t('editor.errors.emptyCode');
    case 'classdef-unsupported':
      return t('editor.errors.classDefUnsupported');
    case 'no-diagram-type':
      return t('editor.errors.noDiagramType');
    case 'svg-failed':
      return t('editor.errors.svgFailed');
    case 'parse-error':
      return `${t('editor.errors.parseErrorLine', { line: error.line })}\n${error.raw}`;
    case 'unknown':
      return error.raw ?? t('editor.errors.unknown');
  }
};
