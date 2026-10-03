import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { X, Maximize2, Map, BookOpen } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  buildTocForceGraph,
  isDdiaConceptBook,
} from '../utils/knowledgeMap';
import {
  calcBookProgressPercent,
  countEffectiveReadSections,
  getEffectiveReadSectionIds,
} from '../utils/bookProgress';


export default function ConceptGraphModal() {
  const {
    isGraphOpen,
    setGraphOpen,
    currentBook,
    currentBookId,
    readSections,
    activeChapterIdx,
    activeSectionIdx,
    setActiveChapter,
    flashcards,
    glossary,
    bookmarks,
    highlights,
  } = useStore();

  const [view, setView] = useState('toc');
  const [isFullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  const showConceptTab = isDdiaConceptBook(currentBook);

  const readIdSet = useMemo(() => {
    return new Set(getEffectiveReadSectionIds(currentBook, readSections, currentBookId));
  }, [currentBook, readSections, currentBookId]);

  const progressPercent = useMemo(
    () => calcBookProgressPercent(currentBook, readSections, currentBookId),
    [currentBook, readSections, currentBookId]
  );

  const readCount = useMemo(
    () => countEffectiveReadSections(currentBook, readSections, currentBookId),
    [currentBook, readSections, currentBookId]
  );

  const graphData = useMemo(() => {
    if (view === 'concepts') {
      return { nodes: [], links: [], nodeMeta: {} }; // Mock for now or implement DDIA concepts later
    }
    return buildTocForceGraph(currentBook, {
      readIdSet,
      activeChapterIdx,
      activeSectionIdx,
      bookFlashcards: flashcards[currentBookId] || [],
      bookGlossary: glossary[currentBookId] || [],
      bookBookmarks: bookmarks[currentBookId] || [],
      bookHighlights: highlights[currentBookId] || [],
    });
  }, [view, currentBook, readIdSet, activeChapterIdx, activeSectionIdx, flashcards, glossary, bookmarks, highlights, currentBookId]);

  const navigateToNode = useCallback(
    (node) => {
      if (!node) return;
      const target = graphData.nodeMeta[node.id];
      if (target) {
        setActiveChapter(target.cIdx, target.sIdx);
        setGraphOpen(false);
        setFullscreen(false);
      }
    },
    [setActiveChapter, setGraphOpen, graphData]
  );

  useEffect(() => {
    if (!isGraphOpen) return;
    if (view === 'concepts' && !showConceptTab) setView('toc');
  }, [isGraphOpen, view, showConceptTab]);

  if (!isGraphOpen) return null;

  const totalSections = (currentBook?.chapters || []).reduce(
    (n, ch) => n + (ch.sections?.length || 0),
    0
  );

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-bgMain border border-borderColor rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-borderColor bg-bgSidebar">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                Карта знаний
              </h2>
              <p className="text-xs text-textDim mt-1">
                {view === 'toc'
                  ? `Оглавление «${currentBook?.title || 'книги'}» · прочитано ${readCount}/${totalSections} (${progressPercent}%)`
                  : 'Схема ключевых тем DDIA (не привязана к страницам)'}
              </p>
              {view === 'toc' && (
                <p className="text-[11px] text-primaryGlow/90 mt-1">
                  Клик по узлу — перейти к главе или разделу
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                disabled={!svg}
                className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-borderColor bg-white/5 hover:bg-white/10 text-textMain hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40"
                title="На весь экран"
              >
                <Maximize2 size={16} />
                <span className="hidden sm:inline text-sm">Увеличить</span>
              </button>
              <button
                type="button"
                onClick={() => setGraphOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 p-2 border-b border-borderColor bg-black/20">
            <button
              type="button"
              onClick={() => setView('toc')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                view === 'toc'
                  ? 'bg-primary/25 text-primaryGlow border border-primary/40'
                  : 'text-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen size={14} /> Оглавление
            </button>
            {showConceptTab && (
              <button
                type="button"
                onClick={() => setView('concepts')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  view === 'concepts'
                    ? 'bg-primary/25 text-primaryGlow border border-primary/40'
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <Map size={14} /> Темы DDIA
              </button>
            )}
          </div>

          {view === 'toc' && (
            <div className="flex flex-wrap gap-3 px-4 py-2 text-[10px] text-textDim border-b border-white/5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4338ca] shadow-[0_0_8px_rgba(67,56,202,0.8)]" /> текущий
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#064e3b]" /> прочитан
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> карточка
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" /> хайлайт
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> термин
              </span>
            </div>
          )}

          <div className="flex-1 overflow-hidden bg-bgMain relative flex" ref={containerRef}>
            {graphData.nodes.length > 0 ? (
              <ForceGraph2D
                width={containerRef.current ? containerRef.current.clientWidth : 800}
                height={containerRef.current ? containerRef.current.clientHeight : 600}
                graphData={graphData}
                nodeAutoColorBy="group"
                nodeRelSize={6}
                nodeColor={node => node.color}
                nodeLabel="name"
                onNodeClick={navigateToNode}
                linkColor={() => 'rgba(255,255,255,0.2)'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const isZettel = ['flashcard', 'highlight', 'glossary'].includes(node.type);
                  const isRoot = node.type === 'root';
                  
                  // Draw Node Circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color;
                  if (node.type === 'highlight' || node.type === 'flashcard' || node.type === 'glossary') {
                     ctx.shadowColor = node.color;
                     ctx.shadowBlur = 10;
                  } else {
                     ctx.shadowBlur = 0;
                  }
                  ctx.fill();

                  // Draw Label
                  const label = node.name;
                  const fontSize = isRoot ? 14 / globalScale : (isZettel ? 10 / globalScale : 12 / globalScale);
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                  // Label background
                  ctx.shadowBlur = 0; // reset shadow for text bg
                  ctx.fillStyle = 'rgba(10, 13, 20, 0.8)';
                  // Position label slightly below the node
                  const labelY = node.y + node.val + fontSize;
                  ctx.fillRect(node.x - bckgDimensions[0] / 2, labelY - bckgDimensions[1] / 2, ...bckgDimensions);

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = isZettel ? node.color : '#e2e8f0';
                  ctx.fillText(label, node.x, labelY);

                  node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
                  node.__labelY = labelY;
                }}
                nodePointerAreaPaint={(node, color, ctx) => {
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI, false);
                  ctx.fill();
                  
                  const bckgDimensions = node.__bckgDimensions;
                  if (bckgDimensions) {
                     ctx.fillRect(node.x - bckgDimensions[0] / 2, node.__labelY - bckgDimensions[1] / 2, ...bckgDimensions);
                  }
                }}
              />
            ) : (
              <div className="spinner m-auto" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
