import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import {
  X, Maximize2, Minimize2, BookOpen, Layers, Eye, EyeOff,
  RefreshCw, Sparkles, Brain, Search, ArrowRight, Check,
  ExternalLink, Network, Filter, RotateCcw, Loader2
} from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  buildTocForceGraph,
  buildSemanticConceptForceGraph,
  isDdiaConceptBook,
} from '../utils/knowledgeMap';
import {
  CONCEPT_CATEGORIES,
  INITIAL_DDIA_CONCEPTS,
  INITIAL_DDIA_RELATIONSHIPS,
} from '../data/ddiaConceptGraph';
import {
  extractConceptsWithAI,
  mergeConceptGraphs,
} from '../services/conceptExtractionService';
import {
  calcBookProgressPercent,
  countEffectiveReadSections,
  getEffectiveReadSectionIds,
} from '../utils/bookProgress';

const TOC_NODE_TYPES = {
  flashcard: { label: 'Карточки', color: '#fbbf24' },
  glossary:  { label: 'Термины',  color: '#2dd4bf' },
  highlight: { label: 'Заметки',  color: '#f472b6' },
};

export default function ConceptGraphModal() {
  const {
    isGraphOpen, setGraphOpen,
    currentBook, currentBookId,
    readSections,
    activeChapterIdx, activeSectionIdx,
    setActiveChapter,
    flashcards, glossary, highlights,
    addFlashcard,
    conceptGraphs, saveBookConceptGraph, resetBookConceptGraph,
    apiKey, model,
    epubReaderText, readerSelectionText,
  } = useStore();

  // Mode: 'concepts' (LightRAG semantic web) vs 'toc' (Chapter/Section hierarchy)
  const [graphMode, setGraphMode] = useState('concepts');
  const [isFullscreen, setFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState('');
  const [cardCreatedToast, setCardCreatedToast] = useState(false);

  // TOC filters
  const [tocFilters, setTocFilters] = useState({
    showFlashcards: true,
    showGlossary:   true,
    showHighlights: true,
  });

  const containerRef = useRef(null);
  const fgRef = useRef(null);

  // ── Determine Active Book Concepts & Relationships ────────────────────────
  const isDdia = useMemo(() => isDdiaConceptBook(currentBook), [currentBook]);

  const rawBookGraph = useMemo(() => {
    if (conceptGraphs[currentBookId]) {
      return conceptGraphs[currentBookId];
    }
    // Default fallback to DDIA knowledge base for DDIA books
    if (isDdia) {
      return {
        nodes: INITIAL_DDIA_CONCEPTS,
        links: INITIAL_DDIA_RELATIONSHIPS,
      };
    }
    return { nodes: [], links: [] };
  }, [conceptGraphs, currentBookId, isDdia]);

  // ── Build Semantic Concept Graph Data (LightRAG) ─────────────────────────
  const conceptGraphData = useMemo(() => {
    return buildSemanticConceptForceGraph({
      concepts: rawBookGraph.nodes || [],
      relationships: rawBookGraph.links || [],
      activeCategory,
      searchQuery,
      focusedNodeId,
    });
  }, [rawBookGraph, activeCategory, searchQuery, focusedNodeId]);

  // ── Build TOC Hierarchy Graph Data ───────────────────────────────────────
  const readIdSet = useMemo(() =>
    new Set(getEffectiveReadSectionIds(currentBook, readSections, currentBookId)),
    [currentBook, readSections, currentBookId]
  );

  const progressPercent = useMemo(() =>
    calcBookProgressPercent(currentBook, readSections, currentBookId),
    [currentBook, readSections, currentBookId]
  );

  const readCount = useMemo(() =>
    countEffectiveReadSections(currentBook, readSections, currentBookId),
    [currentBook, readSections, currentBookId]
  );

  const totalSections = useMemo(() =>
    (currentBook?.chapters || []).reduce((n, ch) => n + (ch.sections?.length || 0), 0),
    [currentBook]
  );

  const tocGraphData = useMemo(() => {
    if (!currentBook) return { nodes: [], links: [], nodeMeta: {} };
    return buildTocForceGraph(currentBook, {
      readIdSet,
      activeChapterIdx,
      activeSectionIdx,
      bookFlashcards: flashcards[currentBookId] || [],
      bookGlossary:   glossary[currentBookId]   || [],
      bookHighlights: highlights[currentBookId] || [],
      showFlashcards: tocFilters.showFlashcards,
      showGlossary:   tocFilters.showGlossary,
      showHighlights: tocFilters.showHighlights,
    });
  }, [currentBook, readIdSet, activeChapterIdx, activeSectionIdx,
      flashcards, glossary, highlights, currentBookId, tocFilters]);

  // Active graph depending on tab
  const activeGraph = graphMode === 'concepts' ? conceptGraphData : tocGraphData;

  // ── Resize Observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGraphOpen || !containerRef.current) return;
    const update = () => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        setDimensions({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [isGraphOpen, isFullscreen, graphMode]);

  // Auto zoom-to-fit when data loads
  useEffect(() => {
    if (fgRef.current && activeGraph.nodes.length > 0) {
      setTimeout(() => fgRef.current?.zoomToFit?.(400, 35), 450);
    }
  }, [activeGraph.nodes.length, graphMode]);

  // ── AI LightRAG Extraction from Active Chapter / Selection ────────────────
  const handleExtractConcepts = async () => {
    if (isExtracting) return;
    setIsExtracting(true);
    setExtractSuccess('');

    try {
      const chapters = currentBook?.chapters || currentBook?.structure || [];
      const currentCh = chapters[activeChapterIdx];
      const currentSec = currentCh?.sections?.[activeSectionIdx];
      const chapterTitle = currentSec?.title || currentCh?.title || 'Текущий раздел';

      let textToExtract = readerSelectionText || currentSec?.text || currentSec?.html || epubReaderText || '';
      if (!textToExtract && currentCh?.sections?.length) {
        textToExtract = currentCh.sections.map(s => s.text || s.html || '').join('\n\n');
      }

      if (!textToExtract || textToExtract.length < 50) {
        throw new Error('Текст текущей главы пуст. Откройте главу с содержимым для анализа.');
      }

      const { concepts: newConcepts, relationships: newRelationships } = await extractConceptsWithAI({
        text: textToExtract,
        chapterTitle,
        chapterIdx: activeChapterIdx,
        sectionIdx: activeSectionIdx,
        apiKey,
        model,
      });

      const merged = mergeConceptGraphs(rawBookGraph, newConcepts, newRelationships);
      saveBookConceptGraph(currentBookId, merged);

      setExtractSuccess(`+${newConcepts.length} концептов, +${newRelationships.length} связей!`);
      setTimeout(() => setExtractSuccess(''), 4500);
    } catch (err) {
      alert(`Ошибка извлечения концептов: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Reset to default DDIA concepts
  const handleResetConcepts = () => {
    if (window.confirm('Сбросить карту концептов к исходному состоянию?')) {
      resetBookConceptGraph(currentBookId);
      setSelectedConcept(null);
      setFocusedNodeId(null);
    }
  };

  // ── Node Click Handlers ───────────────────────────────────────────────────
  const handleNodeClick = useCallback((node) => {
    if (graphMode === 'concepts') {
      setSelectedConcept(node);
      setFocusedNodeId(prev => (prev === node.id ? null : node.id));
      if (node.x !== undefined && node.y !== undefined && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 400);
        fgRef.current.zoom(1.8, 400);
      }
    } else {
      // TOC mode
      setSelectedConcept(node);
      const target = tocGraphData.nodeMeta[node.id];
      if (target && (node.type === 'chapter' || node.type === 'section')) {
        setActiveChapter(target.cIdx, target.sIdx);
      }
    }
  }, [graphMode, tocGraphData, setActiveChapter]);

  // Navigate to chapter in reader
  const handleNavigateToChapter = (cIdx, sIdx = 0) => {
    setActiveChapter(cIdx, sIdx);
    setGraphOpen(false);
    setFullscreen(false);
  };

  // Create Anki Flashcard from Concept
  const handleCreateAnkiCard = (concept) => {
    if (!concept) return;
    const meta = conceptGraphData.nodeMeta[concept.id];
    const outgoing = meta?.outgoing || [];
    const incoming = meta?.incoming || [];

    const relLines = [
      ...outgoing.map(l => `→ [${l.label}] ${(typeof l.target === 'object' ? l.target.name : l.target)}: ${l.description}`),
      ...incoming.map(l => `← [${l.label}] ${(typeof l.source === 'object' ? l.source.name : l.source)}: ${l.description}`),
    ].filter(Boolean);

    const chRef = concept.chapters?.[0] || { cIdx: activeChapterIdx, sIdx: activeSectionIdx, title: '' };

    addFlashcard(currentBookId, {
      front: `Что такое «${concept.name}» (${concept.categoryLabel || concept.category}) и какую архитектурную задачу решает?`,
      back: `${concept.summary || ''}\n\nКлючевые взаимосвязи:\n${relLines.join('\n') || 'Базовый концепт системы'}`,
      sourceText: concept.summary || concept.name,
      chapterIdx: chRef.cIdx,
      sectionIdx: chRef.sIdx,
      sectionTitle: chRef.title || concept.name,
    });

    setCardCreatedToast(true);
    setTimeout(() => setCardCreatedToast(false), 2500);
  };

  if (!isGraphOpen) return null;

  // ── Canvas Paint for Semantic Concepts ────────────────────────────────────
  const paintConceptNode = (node, ctx, globalScale) => {
    const r = node.val || 12;
    const isFocused = node.isFocused;
    const isNeighbor = node.isNeighbor;
    const dimmed = node.dimmed;

    ctx.save();
    if (dimmed) {
      ctx.globalAlpha = 0.22;
    }

    // Glow
    ctx.shadowColor = node.color;
    ctx.shadowBlur = isFocused ? 24 : (isNeighbor ? 16 : 8);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Border ring for focused or neighbor nodes
    if (isFocused || isNeighbor) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (isFocused ? 2.5 : 1.5) / globalScale;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Label Rendering
    const showLabel = isFocused || isNeighbor || globalScale > 0.85 || node.val >= 16;
    if (showLabel) {
      const baseFontSize = isFocused ? 13 : (node.val >= 16 ? 11 : 9.5);
      const fontSize = Math.max(baseFontSize / globalScale, 3.5);

      ctx.font = `${isFocused ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = node.name;
      const tw = ctx.measureText(label).width;
      const pad = fontSize * 0.35;
      const bx = node.x - tw / 2 - pad;
      const by = node.y + r + fontSize * 0.3;
      const bw = tw + pad * 2;
      const bh = fontSize + pad * 2;

      ctx.fillStyle = 'rgba(7, 9, 15, 0.85)';
      ctx.beginPath();
      ctx.roundRect?.(bx, by, bw, bh, 4) ?? ctx.rect(bx, by, bw, bh);
      ctx.fill();

      ctx.fillStyle = isFocused ? '#ffffff' : (isNeighbor ? node.color : '#f1f5f9');
      ctx.fillText(label, node.x, by + bh / 2);
    }
    ctx.restore();
  };

  // Canvas paint for TOC mode
  const paintTocNode = (node, ctx, globalScale) => {
    const r = node.val;
    const isActive = node.isActive;

    ctx.shadowColor = node.color;
    ctx.shadowBlur = isActive ? 18 : (node.type === 'root' ? 22 : 6);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    if (isActive || node.type === 'root') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const showLabel = node.type === 'root'
      || node.type === 'chapter'
      || (node.type === 'section' && globalScale > 0.9)
      || (['flashcard', 'glossary', 'highlight'].includes(node.type) && globalScale > 1.4);

    if (!showLabel) return;

    const isZettel = ['flashcard', 'glossary', 'highlight'].includes(node.type);
    const baseFontSize = node.type === 'root' ? 13 : (node.type === 'chapter' ? 11 : 9);
    const fontSize = Math.max(baseFontSize / globalScale, 3);

    ctx.font = `${node.type === 'root' ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = node.name;
    const tw = ctx.measureText(label).width;
    const pad = fontSize * 0.4;
    const bx = node.x - tw / 2 - pad;
    const by = node.y + r + fontSize * 0.3;
    const bw = tw + pad * 2;
    const bh = fontSize + pad * 2;

    ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
    ctx.beginPath();
    ctx.roundRect?.(bx, by, bw, bh, 3) ?? ctx.rect(bx, by, bw, bh);
    ctx.fill();

    ctx.fillStyle = isZettel ? node.color : (node.type === 'root' ? '#fff' : '#e2e8f0');
    ctx.fillText(label, node.x, by + bh / 2);
  };

  const paintPointer = (node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, (node.val || 10) + 4, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Selected Concept Metadata for detail sidebar
  const selectedMeta = selectedConcept && graphMode === 'concepts'
    ? conceptGraphData.nodeMeta[selectedConcept.id]
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && setGraphOpen(false)}
    >
      <div
        className={`flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-[#090b13] transition-all duration-200
          ${isFullscreen ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-6xl h-[90vh]'}`}
      >
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Brain size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {currentBook?.title || 'Карта знаний'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium shrink-0">
                  LightRAG
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {graphMode === 'concepts'
                  ? `Сеть архитектурных концептов · ${conceptGraphData.nodes.length} узлов · ${conceptGraphData.links.length} связей`
                  : `Иерархия оглавления · Прочитано ${readCount}/${totalSections} (${progressPercent}%)`}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => { setGraphMode('concepts'); setSelectedConcept(null); setFocusedNodeId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                graphMode === 'concepts'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Network size={14} /> Концепты
            </button>
            <button
              onClick={() => { setGraphMode('toc'); setSelectedConcept(null); setFocusedNodeId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                graphMode === 'toc'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen size={14} /> Оглавление
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => fgRef.current?.zoomToFit?.(400, 35)}
              className="p-2 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
              title="По центру"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setFullscreen(p => !p)}
              className="p-2 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Свернуть' : 'Полный экран'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={() => { setGraphOpen(false); setFullscreen(false); }}
              className="p-2 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Subheader Controls ── */}
        {graphMode === 'concepts' ? (
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/6 bg-black/25 shrink-0 flex-wrap">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Все ({rawBookGraph.nodes.length})
              </button>
              {Object.entries(CONCEPT_CATEGORIES).map(([catKey, cat]) => {
                const count = rawBookGraph.nodes.filter(n => n.category === catKey).length;
                const active = activeCategory === catKey;
                return (
                  <button
                    key={catKey}
                    onClick={() => setActiveCategory(active ? 'all' : catKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      active
                        ? 'border-transparent text-white font-semibold'
                        : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    style={active ? { backgroundColor: cat.color + '26', borderColor: cat.color + '60', color: cat.color } : {}}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search and AI Extract Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Поиск концепта..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* AI Extract Button */}
              <button
                onClick={handleExtractConcepts}
                disabled={isExtracting}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 active:scale-95 shrink-0"
                title="ИИ извлечет концепты и связи из текущего открытого раздела"
              >
                {isExtracting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{isExtracting ? 'Извлечение...' : 'ИИ: Извлечь из главы'}</span>
              </button>

              {/* Reset to DDIA default */}
              {isDdia && conceptGraphs[currentBookId] && (
                <button
                  onClick={handleResetConcepts}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Сбросить к исходным концептам DDIA"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* TOC Mode Filter Bar */
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6 bg-black/25 shrink-0 flex-wrap">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mr-1">Показать:</span>
            {Object.entries(TOC_NODE_TYPES).map(([key, cfg]) => {
              const filterKey = `show${key.charAt(0).toUpperCase() + key.slice(1)}`;
              const active = tocFilters[filterKey];
              return (
                <button
                  key={key}
                  onClick={() => setTocFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    active
                      ? 'border-transparent text-white'
                      : 'border-white/10 text-slate-500 hover:text-slate-300'
                  }`}
                  style={active ? { backgroundColor: cfg.color + '28', borderColor: cfg.color + '60', color: cfg.color } : {}}
                >
                  {active ? <Eye size={11} /> : <EyeOff size={11} />}
                  {cfg.label}
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#a78bfa]" /> активный
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#6ee7b7]" /> прочитан
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#475569]" /> не прочитан
              </span>
            </div>
          </div>
        )}

        {/* Success toast notification */}
        {extractSuccess && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-1.5 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
            <Check size={14} className="text-emerald-400" />
            <span>{extractSuccess}</span>
          </div>
        )}

        {/* Card created toast */}
        {cardCreatedToast && (
          <div className="bg-indigo-500/20 border-b border-indigo-500/30 px-4 py-1.5 text-xs text-indigo-300 flex items-center gap-2 animate-in slide-in-from-top-2">
            <Check size={14} className="text-indigo-400" />
            <span>Карточка для интервального повторения сохранена!</span>
          </div>
        )}

        {/* ── Main Graph & Inspector Area ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Force Graph Canvas */}
          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            {activeGraph.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={activeGraph}
                nodeColor={n => n.color}
                nodeLabel={n => n.name}
                nodeRelSize={1}
                nodeVal={n => n.val || 12}
                onNodeClick={handleNodeClick}
                linkColor={link => {
                  if (graphMode === 'concepts') {
                    if (link.dimmed) return 'rgba(255,255,255,0.04)';
                    if (link.isConnectedToFocus) return 'rgba(168, 85, 247, 0.75)';
                    return 'rgba(255, 255, 255, 0.16)';
                  }
                  return link.type === 'zettel' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';
                }}
                linkWidth={link => {
                  if (graphMode === 'concepts') {
                    return link.isConnectedToFocus ? 2.2 : 1.2;
                  }
                  return link.type === 'zettel' ? 0.8 : 1.2;
                }}
                linkDirectionalArrowLength={graphMode === 'concepts' ? 5.5 : 0}
                linkDirectionalArrowRelPos={1}
                linkDirectionalParticles={graphMode === 'concepts' ? 2 : 0}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={() => 'rgba(255,255,255,0.6)'}
                nodeCanvasObject={graphMode === 'concepts' ? paintConceptNode : paintTocNode}
                nodePointerAreaPaint={paintPointer}
                backgroundColor="transparent"
                cooldownTime={3500}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.35}
                onEngineStop={() => fgRef.current?.zoomToFit?.(400, 30)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Brain size={36} className="opacity-30 text-indigo-400" />
                <p className="text-sm font-medium text-slate-400">Нет данных для отображения</p>
                {graphMode === 'concepts' && (
                  <button
                    onClick={handleExtractConcepts}
                    disabled={isExtracting}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all"
                  >
                    <Sparkles size={14} /> Извлечь концепты с помощью ИИ
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Detail Inspector Sidebar ── */}
          {selectedConcept && (
            <div className="w-80 shrink-0 border-l border-white/10 bg-[#0e121d]/95 backdrop-blur-md flex flex-col p-4 gap-4 overflow-y-auto animate-in slide-in-from-right-4 duration-200">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: selectedConcept.color + '20',
                    borderColor: selectedConcept.color + '50',
                    color: selectedConcept.color
                  }}
                >
                  {selectedConcept.categoryLabel || selectedConcept.type || 'Концепт'}
                </span>
                <button
                  onClick={() => { setSelectedConcept(null); setFocusedNodeId(null); }}
                  className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {selectedConcept.name}
                </h3>
                {selectedConcept.summary && (
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    {selectedConcept.summary}
                  </p>
                )}
              </div>

              {/* Connected Relationships (Triplets) */}
              {selectedMeta && (selectedMeta.outgoing.length > 0 || selectedMeta.incoming.length > 0) && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Network size={12} className="text-indigo-400" />
                    Взаимосвязи ({selectedMeta.outgoing.length + selectedMeta.incoming.length})
                  </h4>
                  <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {/* Outgoing */}
                    {selectedMeta.outgoing.map((rel, idx) => {
                      const tgt = typeof rel.target === 'object' ? rel.target : { id: rel.target, name: rel.target };
                      return (
                        <div
                          key={`out_${idx}`}
                          onClick={() => {
                            const nextNode = conceptGraphData.nodes.find(n => n.id === tgt.id);
                            if (nextNode) handleNodeClick(nextNode);
                          }}
                          className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-violet-500/40 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 group-hover:text-white">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
                              → {rel.label}
                            </span>
                            <span className="truncate">{tgt.name}</span>
                          </div>
                          {rel.description && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {rel.description}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {/* Incoming */}
                    {selectedMeta.incoming.map((rel, idx) => {
                      const src = typeof rel.source === 'object' ? rel.source : { id: rel.source, name: rel.source };
                      return (
                        <div
                          key={`in_${idx}`}
                          onClick={() => {
                            const nextNode = conceptGraphData.nodes.find(n => n.id === src.id);
                            if (nextNode) handleNodeClick(nextNode);
                          }}
                          className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/40 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 group-hover:text-white">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                              ← {rel.label}
                            </span>
                            <span className="truncate">{src.name}</span>
                          </div>
                          {rel.description && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {rel.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Book Chapters Mentioning This Concept */}
              {selectedConcept.chapters && selectedConcept.chapters.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={12} className="text-emerald-400" />
                    Где упоминается в книге
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {selectedConcept.chapters.map((ch, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs"
                      >
                        <span className="text-slate-300 truncate pr-2">{ch.title || `Глава ${ch.cIdx + 1}`}</span>
                        <button
                          onClick={() => handleNavigateToChapter(ch.cIdx, ch.sIdx || 0)}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white shrink-0"
                          title="Перейти к чтению"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons in Inspector */}
              <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-white/10">
                {graphMode === 'concepts' && (
                  <button
                    onClick={() => handleCreateAnkiCard(selectedConcept)}
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-300 hover:text-white hover:bg-amber-500/30 text-xs font-semibold transition-all active:scale-95"
                  >
                    <span>⚡ Создать Anki-карточку</span>
                  </button>
                )}

                {/* If selected in TOC mode, allow direct navigation */}
                {graphMode === 'toc' && (selectedConcept.type === 'chapter' || selectedConcept.type === 'section') && (
                  <button
                    onClick={() => {
                      const target = tocGraphData.nodeMeta[selectedConcept.id];
                      if (target) handleNavigateToChapter(target.cIdx, target.sIdx);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95 shadow-md shadow-indigo-600/25"
                  >
                    <span>Перейти к разделу</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
