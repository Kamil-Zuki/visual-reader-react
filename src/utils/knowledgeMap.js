/** Knowledge Map — force-graph data builder for both TOC and Semantic Concept (LightRAG) graphs */

import { CONCEPT_CATEGORIES } from '../data/ddiaConceptGraph';

function truncate(text, max = 40) {
  const s = String(text || '').replace(/[\r\n]+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function isDdiaConceptBook(book) {
  const t = `${book?.title || ''} ${book?.id || ''}`.toLowerCase();
  return t.includes('designing data-intensive') || t.includes('ddia') || t.includes('kleppmann');
}

/**
 * Builds semantic concept graph data for ForceGraph2D
 * @param {object} params
 * @param {Array} params.concepts
 * @param {Array} params.relationships
 * @param {string} [params.activeCategory] 'all' or category key
 * @param {string} [params.searchQuery]
 * @param {string|null} [params.focusedNodeId]
 */
export function buildSemanticConceptForceGraph({
  concepts = [],
  relationships = [],
  activeCategory = 'all',
  searchQuery = '',
  focusedNodeId = null,
}) {
  const q = (searchQuery || '').trim().toLowerCase();

  // Filter nodes
  const matchingNodes = concepts.filter(c => {
    if (activeCategory !== 'all' && c.category !== activeCategory) {
      return false;
    }
    if (q) {
      const inName = c.name?.toLowerCase().includes(q);
      const inSummary = c.summary?.toLowerCase().includes(q);
      if (!inName && !inSummary) return false;
    }
    return true;
  });

  const validNodeIds = new Set(matchingNodes.map(c => c.id));

  // If focused node exists, compute its 1st-degree neighbors
  const neighborIds = new Set();
  if (focusedNodeId) {
    neighborIds.add(focusedNodeId);
    relationships.forEach(r => {
      const src = typeof r.source === 'object' ? r.source.id : r.source;
      const tgt = typeof r.target === 'object' ? r.target.id : r.target;
      if (src === focusedNodeId) neighborIds.add(tgt);
      if (tgt === focusedNodeId) neighborIds.add(src);
    });
  }

  // Filter relationships where both ends are in matchingNodes
  const validLinks = relationships.filter(r => {
    const src = typeof r.source === 'object' ? r.source.id : r.source;
    const tgt = typeof r.target === 'object' ? r.target.id : r.target;
    return validNodeIds.has(src) && validNodeIds.has(tgt);
  });

  // Calculate degrees (connection counts)
  const degrees = {};
  validLinks.forEach(l => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    degrees[src] = (degrees[src] || 0) + 1;
    degrees[tgt] = (degrees[tgt] || 0) + 1;
  });

  // Format nodes for ForceGraph2D
  const nodes = matchingNodes.map(c => {
    const cat = CONCEPT_CATEGORIES[c.category] || { label: 'Концепт', color: '#818cf8' };
    const degree = degrees[c.id] || 0;
    const isFocused = c.id === focusedNodeId;
    const isNeighbor = neighborIds.has(c.id);
    const dimmed = focusedNodeId && !isNeighbor;

    return {
      id: c.id,
      name: c.name,
      val: Math.max(10, (c.val || 12) + degree * 1.5),
      category: c.category,
      categoryLabel: cat.label,
      color: cat.color,
      summary: c.summary,
      chapters: c.chapters || [],
      degree,
      isFocused,
      isNeighbor,
      dimmed,
    };
  });

  // Format links for ForceGraph2D
  const links = validLinks.map((l, i) => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    const isConnectedToFocus = focusedNodeId && (src === focusedNodeId || tgt === focusedNodeId);
    const dimmed = focusedNodeId && !isConnectedToFocus;

    return {
      id: `rel_${src}_${tgt}_${i}`,
      source: src,
      target: tgt,
      label: l.label || '',
      description: l.description || '',
      isConnectedToFocus,
      dimmed,
    };
  });

  // Build index for quick neighbor/relationship lookup
  const nodeMeta = {};
  nodes.forEach(n => {
    const outgoing = links.filter(l => (typeof l.source === 'object' ? l.source.id : l.source) === n.id);
    const incoming = links.filter(l => (typeof l.target === 'object' ? l.target.id : l.target) === n.id);
    nodeMeta[n.id] = {
      node: n,
      outgoing,
      incoming,
    };
  });

  return { nodes, links, nodeMeta };
}

/**
 * Builds force-graph data from a book's TOC + zettel annotations.
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
