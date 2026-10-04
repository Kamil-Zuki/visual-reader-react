import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { X, Maximize2, Minimize2, BookOpen, Layers, Eye, EyeOff, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { buildTocForceGraph, isDdiaConceptBook } from '../utils/knowledgeMap';
import {
  calcBookProgressPercent,
  countEffectiveReadSections,
  getEffectiveReadSectionIds,
} from '../utils/bookProgress';

const NODE_TYPE_CONFIG = {
  flashcard: { label: 'Карточки',  color: '#fbbf24' },
  glossary:  { label: 'Термины',   color: '#2dd4bf' },
  highlight: { label: 'Заметки',   color: '#f472b6' },
};

export default function ConceptGraphModal() {
  const {
    isGraphOpen, setGraphOpen,
    currentBook, currentBookId,
    readSections,
    activeChapterIdx, activeSectionIdx,
    setActiveChapter,
    flashcards, glossary, highlights,
  } = useStore();

  const [isFullscreen, setFullscreen] = useState(false);
  const [dimensions, setDimensions]   = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [filters, setFilters] = useState({
    showFlashcards: true,
    showGlossary:   true,
    showHighlights: true,
  });

  const containerRef = useRef(null);
  const fgRef        = useRef(null);

  // ── Data ───────────────────────────────────────────────────────────────
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

  const graphData = useMemo(() => {
    if (!currentBook) return { nodes: [], links: [], nodeMeta: {} };
    return buildTocForceGraph(currentBook, {
      readIdSet,
      activeChapterIdx,
      activeSectionIdx,
      bookFlashcards: flashcards[currentBookId] || [],
      bookGlossary:   glossary[currentBookId]   || [],
      bookHighlights: highlights[currentBookId] || [],
      showFlashcards: filters.showFlashcards,
      showGlossary:   filters.showGlossary,
      showHighlights: filters.showHighlights,
    });
  }, [currentBook, readIdSet, activeChapterIdx, activeSectionIdx,
      flashcards, glossary, highlights, currentBookId, filters]);

  // ── Resize observer ────────────────────────────────────────────────────
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
  }, [isGraphOpen, isFullscreen]);

  // ── Re-center on data change ───────────────────────────────────────────
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => fgRef.current?.zoomToFit?.(400, 40), 500);
    }
  }, [graphData.nodes.length]);

  // ── Navigation ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    const target = graphData.nodeMeta[node.id];
    if (target && (node.type === 'chapter' || node.type === 'section')) {
      setActiveChapter(target.cIdx, target.sIdx);
    }
  }, [graphData, setActiveChapter]);

  const handleNavigate = () => {
    if (!selectedNode) return;
    const target = graphData.nodeMeta[selectedNode.id];
    if (target) {
      setActiveChapter(target.cIdx, target.sIdx);
      setGraphOpen(false);
      setFullscreen(false);
    }
  };

  const toggleFilter = (key) =>
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  if (!isGraphOpen) return null;

  // ── Canvas renderer ───────────────────────────────────────────────────
  const paintNode = (node, ctx, globalScale) => {
    const r = node.val;
    const isActive = node.isActive;

    ctx.shadowColor = node.color;
    ctx.shadowBlur  = isActive ? 18 : (node.type === 'root' ? 22 : 6);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    if (isActive || node.type === 'root') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth   = 1.5 / globalScale;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Label — always draw for root/chapter, draw sections only if zoomed in
    const showLabel = node.type === 'root'
      || node.type === 'chapter'
      || (node.type === 'section' && globalScale > 0.9)
      || (['flashcard','glossary','highlight'].includes(node.type) && globalScale > 1.4);

    if (!showLabel) return;

    const isZettel = ['flashcard', 'glossary', 'highlight'].includes(node.type);
    const baseFontSize = node.type === 'root' ? 13 : (node.type === 'chapter' ? 11 : 9);
    const fontSize     = Math.max(baseFontSize / globalScale, 3);

    ctx.font         = `${node.type === 'root' ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const label = node.name;
    const tw    = ctx.measureText(label).width;
    const pad   = fontSize * 0.4;
    const bx    = node.x - tw / 2 - pad;
    const by    = node.y + r + fontSize * 0.3;
    const bw    = tw + pad * 2;
    const bh    = fontSize + pad * 2;

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
    ctx.arc(node.x, node.y, node.val + 3, 0, 2 * Math.PI);
    ctx.fill();
  };

  const linkColor = (link) =>
    link.type === 'zettel' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';

  const linkWidth = (link) =>
    link.type === 'zettel' ? 0.8 : 1.2;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && setGraphOpen(false)}
    >
      <div
        className={`flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-[#0a0c14] transition-all duration-200
          ${isFullscreen ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-5xl h-[88vh]'}`}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-white/3 shrink-0">
          <BookOpen size={18} className="text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-tight truncate">
              {currentBook?.title || 'Карта знаний'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Прочитано {readCount}/{totalSections} · {progressPercent}%
              &nbsp;·&nbsp; {graphData.nodes.length} узлов
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => fgRef.current?.zoomToFit?.(400, 40)}
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
              title="По центру"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setFullscreen(p => !p)}
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Свернуть' : 'Полный экран'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={() => { setGraphOpen(false); setFullscreen(false); }}
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6 bg-black/20 shrink-0 flex-wrap">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mr-1">Показать:</span>
          {Object.entries(NODE_TYPE_CONFIG).map(([key, cfg]) => {
            const filterKey = `show${key.charAt(0).toUpperCase() + key.slice(1)}`;
            const active = filters[filterKey];
            return (
              <button
                key={key}
                onClick={() => toggleFilter(filterKey)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150
                  ${active
                    ? 'border-transparent text-white'
                    : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
                style={active ? { backgroundColor: cfg.color + '28', borderColor: cfg.color + '60', color: cfg.color } : {}}
              >
                {active ? <Eye size={11} /> : <EyeOff size={11} />}
                {cfg.label}
              </button>
            );
          })}

          {/* Legend dots */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
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

        {/* ── Main area ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Graph canvas */}
          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            {graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeColor={n => n.color}
                nodeLabel={n => n.name}
                nodeRelSize={1}
                nodeVal={n => n.val}
                onNodeClick={handleNodeClick}
                linkColor={linkColor}
                linkWidth={linkWidth}
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={paintPointer}
                backgroundColor="transparent"
                cooldownTime={3000}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.4}
                d3Force="charge"
                onEngineStop={() => fgRef.current?.zoomToFit?.(400, 30)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Layers size={32} className="opacity-30" />
                <p className="text-sm">Загрузите книгу для отображения карты</p>
              </div>
            )}
          </div>

          {/* ── Detail panel ── */}
          {selectedNode && (
            <div className="w-56 shrink-0 border-l border-white/8 bg-black/30 flex flex-col p-4 gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: selectedNode.color + '25', color: selectedNode.color }}
                >
                  {{
                    root: 'Книга', chapter: 'Глава', section: 'Раздел',
                    flashcard: 'Карточка', glossary: 'Термин', highlight: 'Заметка',
                  }[selectedNode.type] ?? selectedNode.type}
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-slate-600 hover:text-white">
                  <X size={13} />
                </button>
              </div>

              <p className="text-sm text-white font-medium leading-snug">{selectedNode.name}</p>

              {selectedNode.type === 'chapter' && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Прогресс</span>
                    <span>{selectedNode.readCount}/{selectedNode.totalCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((selectedNode.progress || 0) * 100)}%`,
                        backgroundColor: selectedNode.color,
                      }}
                    />
                  </div>
                </div>
              )}

              {(selectedNode.type === 'chapter' || selectedNode.type === 'section') && (
                <button
                  onClick={handleNavigate}
                  className="mt-auto w-full text-center py-2 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ backgroundColor: selectedNode.color + 'aa' }}
                >
                  Перейти →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
