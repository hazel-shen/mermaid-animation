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
  | 'generic';

export const getDiagramType = (code: string): DiagramType => {
  const lines = code.trim().split('\n');
  // Skip %%{init: ...}%% front-matter directives and blank/comment lines
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
  if (/^sankey-beta/.test(firstLine)) return 'sankey';

  return 'generic';
};
