import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { X, Maximize2, Map, BookOpen } from 'lucide-react';
import mermaid from 'mermaid';
import DiagramModal from './DiagramModal';
import {
  buildTocMermaidGraph,
  attachKnowledgeMapClicks,
  isDdiaConceptBook,
} from '../utils/knowledgeMap';
import {
  calcBookProgressPercent,
  countEffectiveReadSections,
  getEffectiveReadSectionIds,
} from '../utils/bookProgress';

const DDIA_CONCEPT_GRAPH = `
graph TD
    DataSystems[Data Systems] --> Reliability[Reliability]
    DataSystems --> Scalability[Scalability]
    DataSystems --> Maintainability[Maintainability]
    DataSystems --> DataModels[Data Models]
    DataModels --> Relational[Relational]
    DataModels --> Document[Document / NoSQL]
    DataModels --> GraphModel[Graph]
    DataSystems --> Storage[Storage & Retrieval]
    Storage --> SSTables[SSTables & LSM-Trees]
    Storage --> BTree[B-Trees]
    DataSystems --> Distributed[Distributed Data]
    Distributed --> Replication[Replication]
    Distributed --> Partitioning[Partitioning / Sharding]
    Distributed --> Transactions[Transactions]
    Replication --> LeaderBased[Leader-based]
    Replication --> MultiLeader[Multi-leader]
    Replication --> Leaderless[Leaderless]
    Transactions --> ACID[ACID Properties]
    Transactions --> Serializability[Serializability]
    Distributed --> Consensus[Consistency & Consensus]
    Consensus --> Linearizability[Linearizability]
    Consensus --> TwoPC[2-Phase Commit]
    DataSystems --> DerivedData[Derived Data]
    DerivedData --> Batch[Batch Processing]
    DerivedData --> Stream[Stream Processing]
    classDef default fill:#1e1e2d,stroke:#818cf8,stroke-width:1px,color:#fff;
    classDef root fill:#6366f1,stroke:#818cf8,stroke-width:2px,color:#fff;
    class DataSystems root;
`;

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#fff',
    primaryBorderColor: '#818cf8',
    lineColor: '#06b6d4',
    secondaryColor: '#1e1e2d',
    tertiaryColor: '#121620',
  },
});

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
  } = useStore();

  const [view, setView] = useState('toc');
  const [svg, setSvg] = useState('');
  const [isFullscreen, setFullscreen] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [compactHint, setCompactHint] = useState(false);
  const containerRef = useRef(null);
  const nodeMetaRef = useRef({});
  const renderGenRef = useRef(0);

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

  const diagramSource = useMemo(() => {
    if (view === 'concepts') {
      return { diagram: DDIA_CONCEPT_GRAPH, nodeMeta: {}, compact: false };
    }
    return buildTocMermaidGraph(currentBook, {
      readIdSet,
      activeChapterIdx,
      activeSectionIdx,
    });
  }, [view, currentBook, readIdSet, activeChapterIdx, activeSectionIdx]);

  const navigateToNode = useCallback(
    (cIdx, sIdx) => {
      setActiveChapter(cIdx, sIdx);
      setGraphOpen(false);
      setFullscreen(false);
    },
    [setActiveChapter, setGraphOpen]
  );

  useEffect(() => {
    if (!isGraphOpen) return;
    if (view === 'concepts' && !showConceptTab) setView('toc');
  }, [isGraphOpen, view, showConceptTab]);

  useEffect(() => {
    if (!isGraphOpen) {
      setSvg('');
      setRenderError('');
      return;
    }

    const gen = ++renderGenRef.current;
    setSvg('');
    setRenderError('');
    setCompactHint(diagramSource.compact);

    const id = `knowledge_map_${view}_${renderGenRef.current}`;
    mermaid
      .render(id, diagramSource.diagram)
      .then(({ svg: renderedSvg }) => {
        if (gen !== renderGenRef.current) return;
        nodeMetaRef.current = diagramSource.nodeMeta;
        setSvg(renderedSvg);
      })
      .catch((err) => {
        if (gen !== renderGenRef.current) return;
        console.error('[KnowledgeMap]', err);
        setRenderError('Не удалось построить граф. Попробуйте вкладку «Темы DDIA» или обновите оглавление EPUB.');
      });
  }, [isGraphOpen, diagramSource, view]);

  useEffect(() => {
    if (!svg || !containerRef.current || view !== 'toc') return undefined;
    const detach = attachKnowledgeMapClicks(
      containerRef.current,
      nodeMetaRef.current,
      navigateToNode
    );
    return detach;
  }, [svg, view, navigateToNode]);

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
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 border border-indigo-300" /> текущий
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-900 border border-emerald-400" /> прочитан
              </span>
              {compactHint && (
                <span className="text-amber-400/90">
                  Много разделов — показаны только главы (клик откроет начало главы)
                </span>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto p-6 bg-[#0a0d14] flex custom-scrollbar min-h-[280px]">
            {renderError ? (
              <p className="text-sm text-red-300 m-auto text-center max-w-md">{renderError}</p>
            ) : svg ? (
              <div
                ref={containerRef}
                className="m-auto flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                onClick={(e) => {
                  if (e.target.closest('g.node')) return;
                  setFullscreen(true);
                }}
                role="presentation"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="spinner m-auto" />
            )}
          </div>
        </div>
      </div>

      <DiagramModal
        isOpen={isFullscreen}
        onClose={() => setFullscreen(false)}
        svgContent={svg}
        title={view === 'toc' ? `Карта: ${currentBook?.title || 'книга'}` : 'Темы DDIA'}
      />
    </>
  );
}
