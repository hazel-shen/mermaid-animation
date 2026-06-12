/**
 * Formats a raw Mermaid render/parse error message for display in the editor
 * error panel.
 *
 * Mermaid (jison) parse errors are multi-line and look like:
 *
 *   Parse error on line 3:
 *   ...A-->B  C--
 *   ----------^
 *   Expecting 'SEMI', 'NEWLINE', got 'EOF'
 *
 * Previously only the first line survived, which kept the line number but
 * dropped the offending snippet and the "Expecting ..." hint. We now keep the
 * full message (capped to MAX_LINES so a pathological message can't flood the
 * panel). The error panel renders with `whitespace-pre-line` + `font-mono` so
 * the caret line stays aligned with the snippet.
 */

const FALLBACK_MSG = '語法錯誤或無法解析';
const NO_TYPE_MSG = '無法識別圖表類型，請檢查開頭關鍵字 (如 sequenceDiagram, graph TB, classDiagram)';
const MAX_LINES = 8;

export const formatMermaidError = (message: string | null | undefined): string => {
  if (!message || !message.trim()) return FALLBACK_MSG;

  if (message.includes('No diagram type detected')) return NO_TYPE_MSG;

  const lines = message.trim().split('\n');
  if (lines.length <= MAX_LINES) return lines.join('\n');
  return [...lines.slice(0, MAX_LINES), '…'].join('\n');
};
