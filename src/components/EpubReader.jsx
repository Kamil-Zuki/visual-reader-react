import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import { useStore } from '../store/useStore';
import { resolveEpubUrl } from '../utils/epubImport';
import {
  EPUB_READER_THEME_IDS,
  EPUB_READER_THEME_LABELS,
  selectEpubReaderTheme,
  epubThemeIframeBackground,
} from '../utils/epubReaderThemes';
import { ChevronLeft, ChevronRight, PenTool, Sparkles, Bookmark, CheckCircle2, X } from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: 'rgba(245, 158, 11, 0.45)', dotColor: '#f59e0b', label: 'Янтарный' },
  { id: 'green', value: 'rgba(34, 197, 94, 0.45)', dotColor: '#22c55e', label: 'Изумрудный' },
  { id: 'blue', value: 'rgba(59, 130, 246, 0.45)', dotColor: '#3b82f6', label: 'Лазурный' },
  { id: 'purple', value: 'rgba(168, 85, 247, 0.45)', dotColor: '#a855f7', label: 'Аметистовый' },
];

function annotationStyle(color) {
  return {
    fill: color || 'rgba(245, 158, 11, 0.45)',
    'fill-opacity': '0.55',
    'mix-blend-mode': 'multiply',
  };
}

/** Снять выделение в iframe epub.js (clearSelection в API нет) */
function clearIframeTextSelection(rendition) {
  if (!rendition) return;
  try {
    const contents = rendition.getContents();
    (Array.isArray(contents) ? contents : [contents]).forEach((c) => {
      c?.window?.getSelection?.()?.removeAllRanges?.();
    });
  } catch {
    /* ignore */
  }
}

export default function EpubReader() {
  const {
    currentBook,
    currentBookId,
    activeChapterIdx,
    activeSectionIdx,
    setEpubReaderText,
    setReaderSelectionText,
    epubLocations,
    setEpubLocation,
    markSectionAsRead,
    unmarkSectionAsRead,
    readSections,
    bookmarks,
    addBookmark,
    removeBookmark,
    highlights,
    addHighlight,
    setInspectorOpen,
    setMobileTab,
    pendingScrollHighlightId,
    setPendingScrollHighlightId,
    pendingSearchScroll,
    setPendingSearchScroll,
    epubResumeBookId,
    clearEpubResume,
    epubReaderTheme,
    setEpubReaderTheme,
  } = useStore();

  const hostRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const navGenRef = useRef(0);
  const appliedCfisRef = useRef(new Set());
  const skipNavOnceRef = useRef(false);

  const [epubSelection, setEpubSelection] = useState(null);

  const chapters = currentBook?.chapters || [];
  const section = chapters[activeChapterIdx]?.sections?.[activeSectionIdx];
  const sectionId = section?.id;
  const isRead = sectionId ? readSections[currentBookId]?.includes(sectionId) : false;
  const bookBookmarks = bookmarks[currentBookId] || [];
  const isBookmarked = sectionId ? bookBookmarks.some((b) => b.id === sectionId) : false;

  const toggleReadStatus = () => {
    if (!sectionId) return;
    if (isRead) unmarkSectionAsRead(currentBookId, sectionId);
    else markSectionAsRead(currentBookId, sectionId);
  };

  /** Закрыть панель выделения, не сбрасывая текст для AI-инспектора */
  const closeEpubSelectionToolbar = useCallback(() => {
    clearIframeTextSelection(renditionRef.current);
    setEpubSelection(null);
  }, []);

  const dismissEpubSelection = useCallback(() => {
    closeEpubSelectionToolbar();
    setReaderSelectionText('');
  }, [closeEpubSelectionToolbar, setReaderSelectionText]);

  const toggleBookmark = () => {
    if (!sectionId) return;
    const chapterTitle = chapters[activeChapterIdx]?.title;
    if (isBookmarked) {
      removeBookmark(currentBookId, sectionId);
    } else {
      addBookmark(currentBookId, {
        id: sectionId,
        chapterIdx: activeChapterIdx,
        sectionIdx: activeSectionIdx,
        title: section?.title || chapterTitle,
        timestamp: Date.now(),
      });
    }
  };

  const applyStoredEpubHighlights = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition || !currentBookId) return;

    const list = (highlights[currentBookId] || []).filter((h) => h.cfiRange);
    const nextCfis = new Set();

    list.forEach((h) => {
      if (!h.cfiRange || appliedCfisRef.current.has(h.cfiRange)) {
        if (h.cfiRange) nextCfis.add(h.cfiRange);
        return;
      }
      try {
        rendition.annotations.add(
          'highlight',
          h.cfiRange,
          { highlightId: h.id },
          () => {},
          'vr-epub-hl',
          annotationStyle(h.color)
        );
        appliedCfisRef.current.add(h.cfiRange);
        nextCfis.add(h.cfiRange);
      } catch (e) {
        console.warn('[EpubReader] annotation add failed:', e);
      }
    });

    for (const cfi of appliedCfisRef.current) {
      if (!nextCfis.has(cfi)) {
        try {
          rendition.annotations.remove(cfi, 'highlight');
        } catch {
          /* ignore */
        }
        appliedCfisRef.current.delete(cfi);
      }
    }
  }, [currentBookId, highlights]);

  useEffect(() => {
    if (!currentBook || currentBook.format !== 'epub' || !hostRef.current) return;

    let cancelled = false;
    const host = hostRef.current;
    host.innerHTML = '';
    appliedCfisRef.current.clear();
    setEpubSelection(null);
    skipNavOnceRef.current = false;

    (async () => {
      try {
        const url = await resolveEpubUrl(currentBook);
        if (cancelled) return;

        const epub = ePub(url);
        bookRef.current = epub;
        await epub.ready;

        const savedCfi = epubLocations[currentBookId];
        const shouldResume = epubResumeBookId === currentBookId && savedCfi;

        const rendition = epub.renderTo(host, {
          width: '100%',
          height: '100%',
          flow: 'scrolled-doc',
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;

        selectEpubReaderTheme(rendition, epubReaderTheme);

        if (shouldResume) {
          await rendition.display(savedCfi);
          skipNavOnceRef.current = true;
          clearEpubResume();
        } else {
          const href = section?.epubHref;
          if (href) {
            await rendition.display(href);
          } else if (savedCfi) {
            await rendition.display(savedCfi);
          } else {
            await rendition.display();
          }
        }

        rendition.on('relocated', (location) => {
          const cfi = location?.start?.cfi;
          if (cfi) setEpubLocation(currentBookId, cfi);
          try {
            const contents = rendition.getContents();
            const texts = (Array.isArray(contents) ? contents : [contents])
              .map((c) => c?.document?.body?.innerText || '')
              .filter(Boolean);
            setEpubReaderText(texts.join('\n\n').slice(0, 50000));
          } catch {
            /* iframe недоступен */
          }
        });

        const syncIframeText = () => {
          try {
            const contents = rendition.getContents();
            const texts = (Array.isArray(contents) ? contents : [contents])
              .map((c) => c?.document?.body?.innerText || '')
              .filter(Boolean);
            setEpubReaderText(texts.join('\n\n').slice(0, 50000));
          } catch {
            /* ignore */
          }
          applyStoredEpubHighlights();
        };

        rendition.on('rendered', syncIframeText);

        // epub.js шлёт selected, но не «снято выделение» — слушаем iframe
        rendition.hooks.content.register((contents) => {
          if (!contents?.document) return;
          let selTimer = null;
          const onSelectionChange = () => {
            clearTimeout(selTimer);
            selTimer = setTimeout(() => {
              const sel = contents.window?.getSelection?.();
              if (!sel || sel.rangeCount === 0) {
                setEpubSelection(null);
                return;
              }
              if (sel.getRangeAt(0).collapsed) {
                setEpubSelection(null);
                return;
              }
              const text = sel.toString().trim();
              if (text.length > 5) {
                setReaderSelectionText(text);
              }
            }, 150);
          };
          contents.document.addEventListener('selectionchange', onSelectionChange);
        });

        rendition.on('selected', (cfiRange, contents) => {
          let text = '';
          try {
            const range = contents?.range(cfiRange);
            text = range?.toString?.()?.trim() || '';
          } catch {
            /* ignore */
          }
          if (text.length > 2) {
            setEpubSelection({ cfiRange, text });
            setReaderSelectionText(text);
          } else {
            setEpubSelection(null);
          }
        });
      } catch (err) {
        console.error('[EpubReader] init failed:', err);
        host.innerHTML = `<p style="color:#f87171;padding:1rem">Не удалось открыть EPUB: ${err.message}</p>`;
      }
    })();

    return () => {
      cancelled = true;
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
      renditionRef.current = null;
      bookRef.current = null;
      appliedCfisRef.current.clear();
      setEpubReaderText('');
      setReaderSelectionText('');
      setEpubSelection(null);
    };
  }, [currentBookId, currentBook?.filePath, setReaderSelectionText]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    selectEpubReaderTheme(rendition, epubReaderTheme);
  }, [epubReaderTheme]);

  useEffect(() => {
    if (!epubSelection) return;
    const onKey = (e) => {
      if (e.key === 'Escape') dismissEpubSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [epubSelection, dismissEpubSelection]);

  useEffect(() => {
    applyStoredEpubHighlights();
  }, [applyStoredEpubHighlights, activeChapterIdx, activeSectionIdx]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !section?.epubHref) return;

    if (skipNavOnceRef.current) {
      skipNavOnceRef.current = false;
      return;
    }

    dismissEpubSelection();

    const gen = ++navGenRef.current;
    rendition.display(section.epubHref).catch((e) => {
      console.warn('[EpubReader] display href failed:', e);
    });

    return () => {
      if (gen === navGenRef.current) {
        /* noop */
      }
    };
  }, [activeChapterIdx, activeSectionIdx, section?.epubHref, dismissEpubSelection]);

  useEffect(() => {
    const rendition = renditionRef.current;
    const targetId = pendingScrollHighlightId;
    if (!rendition || !targetId || !currentBookId) return;

    const h = (highlights[currentBookId] || []).find((x) => x.id === targetId);
    if (!h?.cfiRange) return;

    rendition
      .display(h.cfiRange)
      .then(() => {
        try {
          rendition.annotations.add(
            'highlight',
            h.cfiRange,
            { highlightId: h.id },
            () => {},
            'vr-epub-hl',
            { ...annotationStyle(h.color), 'fill-opacity': '0.85' }
          );
          appliedCfisRef.current.add(h.cfiRange);
        } catch {
          /* ignore */
        }
      })
      .finally(() => setPendingScrollHighlightId(null));
  }, [pendingScrollHighlightId, highlights, currentBookId, setPendingScrollHighlightId]);

  useEffect(() => {
    const scrollData = pendingSearchScroll;
    const rendition = renditionRef.current;
    if (!scrollData || !rendition) return;

    const textToFind = (scrollData.snippet || scrollData.query || '').trim();
    if (textToFind.length < 2) {
      setPendingSearchScroll(null);
      return;
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        let found = false;
        try {
          const contents = rendition.getContents();
          const list = Array.isArray(contents) ? contents : [contents];
          const searchLower = textToFind.toLowerCase();

          for (const c of list) {
            const doc = c?.document;
            if (!doc?.body) continue;
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
              const idx = node.nodeValue.toLowerCase().indexOf(searchLower);
              if (idx === -1) continue;
              const range = doc.createRange();
              range.setStart(node, idx);
              range.setEnd(node, Math.min(node.nodeValue.length, idx + textToFind.length));
              const span = doc.createElement('span');
              span.className = 'search-match-pulse';
              span.style.backgroundColor = 'rgba(99, 102, 241, 0.45)';
              span.style.borderRadius = '3px';
              span.style.padding = '0 2px';
              range.surroundContents(span);
              span.scrollIntoView({ behavior: 'smooth', block: 'center' });
              found = true;
              break;
            }
            if (found) break;
          }
        } catch (err) {
          console.warn('[EpubReader] search highlight error:', err);
        }
        setPendingSearchScroll(null);
      }, 150);
    });
  }, [pendingSearchScroll, activeChapterIdx, activeSectionIdx, setPendingSearchScroll]);

  const handleEpubHighlight = (colorValue) => {
    if (!epubSelection?.cfiRange) return;
    const id = Date.now().toString();
    addHighlight(currentBookId, {
      id,
      chapterIdx: activeChapterIdx,
      sectionIdx: activeSectionIdx,
      text: epubSelection.text,
      color: colorValue,
      cfiRange: epubSelection.cfiRange,
      note: '',
      timestamp: Date.now(),
    });
    const rendition = renditionRef.current;
    if (rendition) {
      try {
        rendition.annotations.add(
          'highlight',
          epubSelection.cfiRange,
          { highlightId: id },
          () => {},
          'vr-epub-hl',
          annotationStyle(colorValue)
        );
        appliedCfisRef.current.add(epubSelection.cfiRange);
      } catch (e) {
        console.warn('[EpubReader] live annotation failed:', e);
      }
    }
    setReaderSelectionText(epubSelection.text);
    closeEpubSelectionToolbar();
  };

  const goPrev = () => {
    dismissEpubSelection();
    renditionRef.current?.prev();
  };
  const goNext = () => {
    dismissEpubSelection();
    renditionRef.current?.next();
  };

  if (!currentBook) {
    return (
      <main className="flex-1 flex items-center justify-center text-textMuted">
        Выберите книгу в библиотеке
      </main>
    );
  }

  return (
    <main className="flex-1 bg-bgMain relative flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-borderColor shrink-0">
        <span className="text-xs text-textMuted truncate max-w-[70%]">
          {section?.title || currentBook.title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {sectionId && (
            <>
              <button
                type="button"
                onClick={toggleBookmark}
                className={`p-2 rounded-lg border transition-colors ${
                  isBookmarked
                    ? 'bg-primary/20 text-primaryGlow border-primary/30'
                    : 'text-textDim border-borderColor hover:text-white hover:bg-white/5'
                }`}
                title={isBookmarked ? 'Удалить закладку' : 'Добавить закладку'}
              >
                <Bookmark size={18} className={isBookmarked ? 'fill-primaryGlow opacity-100' : 'opacity-50'} />
              </button>
              <button
                type="button"
                onClick={toggleReadStatus}
                className={`p-2 rounded-lg border transition-colors ${
                  isRead
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'text-textDim border-borderColor hover:text-white hover:bg-white/5'
                }`}
                title={isRead ? 'Отметить как непрочитанное' : 'Отметить как прочитанное'}
              >
                <CheckCircle2 size={18} className={isRead ? 'opacity-100' : 'opacity-50'} />
              </button>
            </>
          )}
          <div
            className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10"
            role="group"
            aria-label="Тема чтения EPUB"
          >
            {EPUB_READER_THEME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setEpubReaderTheme(id)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  epubReaderTheme === id
                    ? 'bg-primary/30 text-white'
                    : 'text-textMuted hover:text-white hover:bg-white/10'
                }`}
                title={EPUB_READER_THEME_LABELS[id]}
              >
                {EPUB_READER_THEME_LABELS[id]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={goPrev}
            className="p-2 rounded-lg hover:bg-white/10 text-textMuted hover:text-white"
            title="Предыдущая страница"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="p-2 rounded-lg hover:bg-white/10 text-textMuted hover:text-white"
            title="Следующая страница"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        ref={hostRef}
        className="flex-1 overflow-hidden epub-host min-h-0 w-full"
        data-epub-theme={epubReaderTheme}
        style={{ '--epub-iframe-bg': epubThemeIframeBackground(epubReaderTheme) }}
      />

      {epubSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200 epub-selection-toolbar">
          <div className="bg-bgSidebar border border-borderColor shadow-2xl shadow-black rounded-2xl p-2.5 flex flex-col gap-2 w-[92vw] max-w-sm">
            <div className="flex items-center justify-between px-1 border-b border-white/5 pb-1.5 gap-2">
              <span className="text-xs text-textMuted font-medium">Выделение в EPUB</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-textDim">{epubSelection.text.length} симв.</span>
                <button
                  type="button"
                  onClick={dismissEpubSelection}
                  className="p-1 rounded-md text-textDim hover:text-white hover:bg-white/10"
                  title="Закрыть (Esc)"
                  aria-label="Закрыть панель выделения"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-around gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleEpubHighlight(c.value)}
                  className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer shadow-sm"
                  style={{ backgroundColor: c.dotColor }}
                  title={`Выделить: ${c.label}`}
                >
                  <PenTool size={13} className="text-white opacity-90" />
                </button>
              ))}
              <div className="w-px h-7 bg-white/10 mx-1" />
              <button
                type="button"
                onClick={() => {
                  setReaderSelectionText(epubSelection.text);
                  setMobileTab('ai');
                  setInspectorOpen(true);
                  closeEpubSelectionToolbar();
                }}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-primary to-accentPurple text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} /> ИИ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
