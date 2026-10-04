/** Knowledge Map — force-graph data builder */

function truncate(text, max = 40) {
  const s = String(text || '').replace(/[\r\n]+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function isDdiaConceptBook(book) {
  const t = `${book?.title || ''} ${book?.id || ''}`.toLowerCase();
  return t.includes('designing data-intensive') || t.includes('ddia') || t.includes('kleppmann');
}

/**
 * Builds force-graph data from a book's TOC + zettel annotations.
 *
 * Node types:
 *   root      – single book root
 *   chapter   – top-level chapter
 *   section   – sub-section inside a chapter
 *   flashcard – user flashcard anchored to a section
 *   highlight – user highlight anchored to a section
 *   glossary  – glossary term anchored to a section
 *
 * @returns {{ nodes: object[], links: object[], nodeMeta: object }}
 */
export function buildTocForceGraph(book, options = {}) {
  const {
    readIdSet = new Set(),
    activeChapterIdx = 0,
    activeSectionIdx = 0,
    bookFlashcards = [],
    bookGlossary = [],
    bookHighlights = [],
    showFlashcards = true,
    showGlossary = true,
    showHighlights = true,
  } = options;

  const chapters = book?.chapters || book?.structure || [];
  const nodes = [];
  const links = [];
  const nodeMeta = {};

  // ── Root ──────────────────────────────────────────────────────────────────
  nodes.push({
    id: 'root',
    name: truncate(book?.title || 'Книга', 50),
    val: 24,
    color: '#818cf8',
    type: 'root',
    group: 0,
  });

  // ── Chapters & Sections ───────────────────────────────────────────────────
  chapters.forEach((ch, cIdx) => {
    const cKey = `c${cIdx}`;
    const isChActive = cIdx === activeChapterIdx;

    // Count read sections in this chapter
    const secIds = (ch.sections || []).map(s => s.id).filter(Boolean);
    const readCount = secIds.filter(id => readIdSet.has(id)).length;
    const totalCount = secIds.length;
    const chProgress = totalCount > 0 ? readCount / totalCount : 0;

    // Color by progress + active state
    let chColor;
    if (isChActive) chColor = '#a78bfa';
    else if (chProgress === 1) chColor = '#34d399';
    else if (chProgress > 0) chColor = `hsl(${142 + (1 - chProgress) * 60}, 60%, 45%)`;
    else chColor = '#475569';

    nodes.push({
      id: cKey,
      name: truncate(ch.title || `Глава ${cIdx + 1}`, 45),
      val: 14,
      color: chColor,
      type: 'chapter',
      group: 1,
      progress: chProgress,
      readCount,
      totalCount,
    });
    links.push({ source: 'root', target: cKey, type: 'toc' });
    nodeMeta[cKey] = { cIdx, sIdx: 0, type: 'chapter' };

    (ch.sections || []).forEach((sec, sIdx) => {
      const sKey = `c${cIdx}s${sIdx}`;
      const isActive = cIdx === activeChapterIdx && sIdx === activeSectionIdx;
      const isRead = sec.id && readIdSet.has(sec.id);

      let secColor;
      if (isActive) secColor = '#c4b5fd';
      else if (isRead) secColor = '#6ee7b7';
      else secColor = '#334155';

      nodes.push({
        id: sKey,
        name: truncate(sec.title || `§ ${sIdx + 1}`, 40),
        val: isActive ? 9 : 7,
        color: secColor,
        type: 'section',
        group: 2,
        isActive,
        isRead,
      });
      links.push({ source: cKey, target: sKey, type: 'toc' });
      nodeMeta[sKey] = { cIdx, sIdx, type: 'section' };
    });
  });

  // ── Zettelkasten helpers ──────────────────────────────────────────────────
  const addZettelNodes = (items, type, color, getLabel) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!item) return;
      const cIdx = item.chapterIdx ?? 0;
      const sIdx = item.sectionIdx ?? 0;
      let parentKey = `c${cIdx}s${sIdx}`;
      if (!nodeMeta[parentKey]) parentKey = `c${cIdx}`;
      if (!nodeMeta[parentKey]) parentKey = 'root';

      const nodeId = `${type}_${item.id || i}`;
      nodes.push({
        id: nodeId,
        name: truncate(getLabel(item), 35),
        val: 5,
        color,
        type,
        group: { flashcard: 3, glossary: 4, highlight: 5 }[type] ?? 6,
      });
      links.push({ source: parentKey, target: nodeId, type: 'zettel' });
      nodeMeta[nodeId] = { cIdx, sIdx, type };
    });
  };

  if (showFlashcards) {
    addZettelNodes(bookFlashcards, 'flashcard', '#fbbf24',
      c => c?.front || c?.question || 'Карточка');
  }
  if (showGlossary) {
    addZettelNodes(bookGlossary, 'glossary', '#2dd4bf',
      g => g?.term || 'Термин');
  }
  if (showHighlights) {
    addZettelNodes(bookHighlights, 'highlight', '#f472b6',
      h => h?.text || h?.selectedText || 'Заметка');
  }

  return { nodes, links, nodeMeta };
}

/** Legacy Mermaid helpers (kept for any remaining references) */
export function parseMermaidNodeKey() { return null; }
export function attachKnowledgeMapClicks() { return () => {}; }
export function buildTocMermaidGraph() { return { diagram: '', nodeMeta: {}, compact: false }; }
