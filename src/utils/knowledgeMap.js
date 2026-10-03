/** Построение Mermaid-графа оглавления и клики по узлам */

const MAX_SECTIONS_FULL = 56;

function escapeMermaidLabel(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/[[\]{}#]/g, '')
    .trim()
    .slice(0, 72);
}

export function isDdiaConceptBook(book) {
  const t = `${book?.title || ''} ${book?.id || ''}`.toLowerCase();
  return t.includes('designing data-intensive') || t.includes('ddia') || t.includes('kleppmann');
}

/**
 * @returns {{ diagram: string, nodeMeta: Record<string, { cIdx: number, sIdx: number }>, compact: boolean }}
 */
export function buildTocMermaidGraph(book, options = {}) {
  const {
    readIdSet = new Set(),
    activeChapterIdx = 0,
    activeSectionIdx = 0,
  } = options;

  const chapters = book?.chapters || book?.structure || [];
  const lines = ['graph TD'];
  const nodeMeta = {};
  const classLines = [];

  const totalSections = chapters.reduce((n, ch) => n + (ch.sections?.length || 0), 0);
  const compact = totalSections > MAX_SECTIONS_FULL;

  lines.push(`  root["${escapeMermaidLabel(book?.title || 'Книга')}"]`);
  classLines.push('class root rootNode');

  chapters.forEach((ch, cIdx) => {
    const cKey = `c${cIdx}`;
    const chTitle = escapeMermaidLabel(ch.title || `Глава ${cIdx + 1}`);
    lines.push(`  ${cKey}["${chTitle}"]`);
    lines.push(`  root --> ${cKey}`);
    nodeMeta[cKey] = { cIdx, sIdx: 0 };

    const chapterActive =
      cIdx === activeChapterIdx && (!ch.sections?.length || activeSectionIdx === 0);
    if (chapterActive) classLines.push(`class ${cKey} activeNode`);

    if (compact) return;

    (ch.sections || []).forEach((sec, sIdx) => {
      const sKey = `c${cIdx}s${sIdx}`;
      const secTitle = escapeMermaidLabel(sec.title || `§ ${sIdx + 1}`);
      lines.push(`  ${sKey}["${secTitle}"]`);
      lines.push(`  ${cKey} --> ${sKey}`);
      nodeMeta[sKey] = { cIdx, sIdx };

      const isActive = cIdx === activeChapterIdx && sIdx === activeSectionIdx;
      const isRead = sec.id && readIdSet.has(sec.id);
      if (isActive) classLines.push(`class ${sKey} activeNode`);
      else if (isRead) classLines.push(`class ${sKey} readNode`);
    });
  });

  lines.push('  classDef rootNode fill:#6366f1,stroke:#818cf8,stroke-width:2px,color:#fff');
  lines.push('  classDef readNode fill:#064e3b,stroke:#34d399,color:#ecfdf5');
  lines.push('  classDef activeNode fill:#4338ca,stroke:#c4b5fd,stroke-width:3px,color:#fff');
  lines.push('  classDef defaultNode fill:#1e1e2d,stroke:#64748b,color:#e2e8f0');
  lines.push(...classLines);

  return { diagram: lines.join('\n'), nodeMeta, compact };
}

export function parseMermaidNodeKey(svgNodeId) {
  if (!svgNodeId) return null;
  const m = svgNodeId.match(/flowchart-(c\d+(?:s\d+)?)-/i) || svgNodeId.match(/-(c\d+(?:s\d+)?)-/i);
  return m ? m[1] : null;
}

/** Вешает переход по разделу на узлы SVG */
export function attachKnowledgeMapClicks(container, nodeMeta, onNavigate) {
  if (!container || !nodeMeta) return () => {};

  const onClick = (e) => {
    const node = e.target.closest?.('g.node');
    if (!node?.id) return;
    const key = parseMermaidNodeKey(node.id);
    const target = key ? nodeMeta[key] : null;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(target.cIdx, target.sIdx);
  };

  container.addEventListener('click', onClick);
  container.querySelectorAll('g.node').forEach((g) => {
    g.style.cursor = 'pointer';
  });

  return () => container.removeEventListener('click', onClick);
}

/**
 * @returns {{ nodes: any[], links: any[], nodeMeta: Record<string, { cIdx: number, sIdx: number }> }}
 */
export function buildTocForceGraph(book, options = {}) {
  const {
    readIdSet = new Set(),
    activeChapterIdx = 0,
    activeSectionIdx = 0,
    bookFlashcards = [],
    bookGlossary = [],
    bookBookmarks = [],
    bookHighlights = [],
  } = options;

  const chapters = book?.chapters || book?.structure || [];
  const nodes = [];
  const links = [];
  const nodeMeta = {};

  const totalSections = chapters.reduce((n, ch) => n + (ch.sections?.length || 0), 0);
  const compact = totalSections > MAX_SECTIONS_FULL;

  // Root node
  nodes.push({
    id: 'root',
    name: escapeMermaidLabel(book?.title || 'Книга'),
    val: 20,
    color: '#6366f1', // primary color
    type: 'root'
  });

  chapters.forEach((ch, cIdx) => {
    const cKey = `c${cIdx}`;
    const chapterActive =
      cIdx === activeChapterIdx && (!ch.sections?.length || activeSectionIdx === 0);

    nodes.push({
      id: cKey,
      name: escapeMermaidLabel(ch.title || `Глава ${cIdx + 1}`),
      val: 12,
      color: chapterActive ? '#4338ca' : '#1e1e2d',
      type: 'chapter'
    });
    links.push({ source: 'root', target: cKey });
    nodeMeta[cKey] = { cIdx, sIdx: 0, type: 'chapter' };

    if (compact) return;

    (ch.sections || []).forEach((sec, sIdx) => {
      const sKey = `c${cIdx}s${sIdx}`;
      const isActive = cIdx === activeChapterIdx && sIdx === activeSectionIdx;
      const isRead = sec.id && readIdSet.has(sec.id);

      let color = '#1e1e2d';
      if (isActive) color = '#4338ca'; // active
      else if (isRead) color = '#064e3b'; // read green

      nodes.push({
        id: sKey,
        name: escapeMermaidLabel(sec.title || `§ ${sIdx + 1}`),
        val: 7,
        color,
        type: 'section'
      });
      links.push({ source: cKey, target: sKey });
      nodeMeta[sKey] = { cIdx, sIdx, type: 'section' };
    });
  });

  // Helper to add Zettelkasten nodes
  const addZettelNodes = (items, type, baseColor, getLabel) => {
    items.forEach((item, i) => {
      // Find parent section or chapter
      const cIdx = item.chapterIdx ?? 0;
      const sIdx = item.sectionIdx ?? 0;
      let parentKey = `c${cIdx}s${sIdx}`;
      
      // Fallback to chapter if section doesn't exist in our graph (e.g., compact mode or malformed data)
      if (!nodeMeta[parentKey]) {
        parentKey = `c${cIdx}`;
        if (!nodeMeta[parentKey]) {
           parentKey = 'root'; // ultimate fallback
        }
      }

      const nodeId = `${type}_${item.id || i}`;
      nodes.push({
        id: nodeId,
        name: escapeMermaidLabel(getLabel(item)),
        val: 4,
        color: baseColor,
        type
      });
      links.push({ source: parentKey, target: nodeId });
      // Keep track of where it belongs if clicked
      nodeMeta[nodeId] = { cIdx, sIdx, type };
    });
  };

  if (!compact) {
    addZettelNodes(bookFlashcards, 'flashcard', '#eab308', (c) => c?.front || c?.question || 'Карточка');
    addZettelNodes(bookGlossary, 'glossary', '#10b981', (g) => g?.term || 'Термин');
    addZettelNodes(bookHighlights, 'highlight', '#f43f5e', (h) => String(h?.text || h?.selectedText || 'Заметка').substring(0, 20) + '...');
  }

  return { nodes, links, nodeMeta };
}
