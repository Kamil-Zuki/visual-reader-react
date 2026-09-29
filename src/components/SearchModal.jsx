import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { searchInBook, searchRecords } from '../utils/searchIndex';
import { buildEpubSearchRecords } from '../utils/epubSearchIndex';
import { Search, X, BookOpen, ChevronRight, CornerDownLeft, Sparkles, Hash } from 'lucide-react';

const SUGGESTED_QUERIES = [
  'ACID',
  'CAP theorem',
  'Replication',
  'Transactions',
  'B-tree',
  'LSM-tree',
  'SSTables',
  'Consensus',
  'Partitioning',
  'Leader-follower',
  'Eventual consistency',
  'Unreliable Networks'
];

export default function SearchModal() {
  const {
    isSearchOpen,
    setSearchOpen,
    currentBook,
    currentBookId,
    setActiveChapter,
    setPendingSearchScroll
  } = useStore();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [epubRecords, setEpubRecords] = useState(null);
  const [epubIndexLoading, setEpubIndexLoading] = useState(false);
  const [epubIndexError, setEpubIndexError] = useState('');
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  const isEpub = currentBook?.format === 'epub';

  // Debounce query for smooth typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIdx(0);
    } else {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || !isEpub || !currentBook) {
      setEpubRecords(null);
      setEpubIndexLoading(false);
      setEpubIndexError('');
      return;
    }
    let cancelled = false;
    setEpubIndexLoading(true);
    setEpubIndexError('');
    buildEpubSearchRecords(currentBook, currentBookId)
      .then((records) => {
        if (!cancelled) {
          setEpubRecords(records);
          setEpubIndexLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[SearchModal] EPUB index failed:', err);
          setEpubIndexError(err.message || 'Не удалось проиндексировать EPUB');
          setEpubIndexLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSearchOpen, isEpub, currentBook, currentBookId]);

  // Perform search
  const searchResults = useMemo(() => {
    if (!currentBook || !debouncedQuery || debouncedQuery.length < 2) {
      return [];
    }
    if (isEpub) {
      if (!epubRecords?.length) return [];
      return searchRecords(epubRecords, debouncedQuery, 50);
    }
    return searchInBook(currentBook, currentBookId, debouncedQuery, 50);
  }, [currentBook, currentBookId, debouncedQuery, isEpub, epubRecords]);

  // Calculate total occurrences
  const totalMatches = useMemo(() => {
    return searchResults.reduce((acc, r) => acc + (r.matchCount || 1), 0);
  }, [searchResults]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
      } else if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        const target = searchResults[selectedIdx] || searchResults[0];
        if (target) {
          handleSelectResult(target);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchResults, selectedIdx]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const selectedEl = resultsContainerRef.current.querySelector(`[data-index="${selectedIdx}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIdx]);

  if (!isSearchOpen) return null;

  const handleSelectResult = (result, snippetText = null) => {
    setActiveChapter(result.chapterIdx, result.sectionIdx);
    setPendingSearchScroll({
      query: debouncedQuery,
      snippet: snippetText || debouncedQuery,
      timestamp: Date.now()
    });
    setSearchOpen(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-10 sm:pt-20 px-3 sm:px-4 animate-fade-in"
      onClick={() => setSearchOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-bgModal border border-borderColor rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-borderColor flex items-center gap-3 bg-black/40">
          <Search size={20} className="text-primaryGlow shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Поиск по всей книге (ACID, индексы, репликация)..."
            className="flex-1 bg-transparent text-sm sm:text-base text-textMain placeholder:text-textDim outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-textDim hover:text-white hover:bg-white/10 transition-colors"
              title="Очистить"
            >
              <X size={16} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-textDim bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
            <span>ESC</span>
          </div>
        </div>

        {/* Status / Count bar */}
        {isEpub && isSearchOpen && epubIndexLoading && (
          <div className="px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-xs text-indigo-200">
            Индексируем EPUB для поиска… (первый раз может занять минуту)
          </div>
        )}
        {epubIndexError && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            {epubIndexError}
          </div>
        )}
        {debouncedQuery && debouncedQuery.length >= 2 && (
          <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs text-textMuted">
            <span>
              {isEpub && epubIndexLoading ? (
                'Подготовка индекса…'
              ) : (
                <>
                  Найдено: <strong className="text-primaryGlow">{totalMatches}</strong>{' '}
                  {totalMatches === 1 ? 'совпадение' : totalMatches < 5 ? 'совпадения' : 'совпадений'} в{' '}
                  <strong className="text-white">{searchResults.length}</strong>{' '}
                  {searchResults.length === 1 ? 'разделе' : 'разделах'}
                </>
              )}
            </span>
            <span className="hidden sm:inline text-textDim">
              Нажмите <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[10px]">↵ Enter</kbd> для перехода
            </span>
          </div>
        )}

        {/* Content Area */}
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
          {/* Empty Query: show suggestions */}
          {(!debouncedQuery || debouncedQuery.length < 2) && (
            <div className="py-4 px-2 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-textDim uppercase tracking-wider">
                <Sparkles size={14} className="text-primaryGlow" />
                <span>Быстрый поиск по ключевым концептам:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setQuery(item);
                      setDebouncedQuery(item);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-primary/20 hover:border-primary/40 border border-white/10 text-xs text-textMain hover:text-primaryGlow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Hash size={12} className="text-textDim" />
                    <span>{item}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-textMuted leading-relaxed flex items-start gap-3">
                <BookOpen size={18} className="text-primaryGlow shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white mb-0.5">Полнотекстовый поиск по книге</div>
                  Ищите любые технические термины, протоколы, имена авторов или фрагменты определений. Поиск индексирует все главы и параграфы книги.
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          {debouncedQuery && debouncedQuery.length >= 2 && searchResults.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {searchResults.map((result, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <div
                    key={`${result.chapterIdx}_${result.sectionIdx}`}
                    data-index={idx}
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-primary/10 border-primary/50 shadow-md shadow-primary/5'
                        : 'bg-bgCard/60 border-borderColor hover:border-primary/30 hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Header: Chapter and Section Title */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-medium text-textDim truncate max-w-[200px] sm:max-w-xs">
                          {result.chapterTitle}
                        </span>
                        <ChevronRight size={12} className="text-textDim shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-white truncate">
                          {result.sectionTitle}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-primaryGlow font-mono shrink-0">
                        {result.matchCount} {result.matchCount === 1 ? 'совп.' : 'совп.'}
                      </span>
                    </div>

                    {/* Snippets */}
                    <div className="flex flex-col gap-1.5 pl-1 border-l-2 border-white/10">
                      {result.snippets.map((snip, sIdx) => (
                        <div
                          key={sIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectResult(result, snip.match);
                          }}
                          className="text-xs text-textMuted hover:text-textMain transition-colors leading-relaxed line-clamp-2"
                        >
                          {snip.before}
                          <mark className="bg-primary/30 text-primaryGlow font-semibold px-1 py-0.5 rounded">
                            {snip.match}
                          </mark>
                          {snip.after}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {debouncedQuery && debouncedQuery.length >= 2 && searchResults.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-textDim mb-3">
                <Search size={22} />
              </div>
              <div className="text-sm font-semibold text-white mb-1">Ничего не найдено</div>
              <p className="text-xs text-textMuted max-w-sm">
                По запросу <span className="text-primaryGlow">"{debouncedQuery}"</span> совпадений в книге не обнаружено. Попробуйте другой термин или часть слова.
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 bg-black/40 border-t border-borderColor flex items-center justify-between text-[11px] text-textDim">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">↓</kbd>
              <span>навигация</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Enter</kbd>
              <span>выбрать</span>
            </span>
          </div>
          <button
            onClick={() => setSearchOpen(false)}
            className="text-textDim hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
