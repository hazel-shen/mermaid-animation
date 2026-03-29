export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'timeline'
  | 'pie'
  | 'mindmap'
  | 'gitgraph'
  | 'sankey'
  | 'c4'
  | 'generic';

export const getDiagramType = (code: string): DiagramType => {
  let lines = code.trim().split('\n');

  // Skip YAML front-matter block (--- ... ---) used by Mermaid config directives
  if (lines[0]?.trim() === '---') {
    const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (closingIdx > 0) lines = lines.slice(closingIdx + 1);
  }

  // Skip %%{init: ...}%% directives and blank/comment lines
  const firstMeaningfulLine = lines
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('%%'))
    ?.toLowerCase() ?? '';
  const firstLine = firstMeaningfulLine;

  if (/^graph\b|^flowchart\b/.test(firstLine)) return 'flowchart';
  if (/^sequencediagram/.test(firstLine)) return 'sequence';
  if (/^classdiagram/.test(firstLine)) return 'class';
  if (/^statediagram/.test(firstLine)) return 'state';
  if (/^erdiagram/.test(firstLine)) return 'er';
  if (/^gantt/.test(firstLine)) return 'gantt';
  if (/^timeline/.test(firstLine)) return 'timeline';
  if (/^pie/.test(firstLine)) return 'pie';
  if (/^mindmap/.test(firstLine)) return 'mindmap';
  if (/^gitgraph/.test(firstLine)) return 'gitgraph';
  if (/^sankey/.test(firstLine)) return 'sankey';
  if (/^c4context|^c4container|^c4component|^c4dynamic|^c4deployment/.test(firstLine)) return 'c4';

  return 'generic';
};
