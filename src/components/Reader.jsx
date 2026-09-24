import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Bookmark, PenTool } from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: 'rgba(245, 158, 11, 0.16)', dotColor: '#f59e0b', label: 'Янтарный' },
  { id: 'green', value: 'rgba(34, 197, 94, 0.16)', dotColor: '#22c55e', label: 'Изумрудный' },
  { id: 'blue', value: 'rgba(59, 130, 246, 0.16)', dotColor: '#3b82f6', label: 'Лазурный' },
  { id: 'purple', value: 'rgba(168, 85, 247, 0.16)', dotColor: '#a855f7', label: 'Аметистовый' }
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHighlightStyles(rawColor) {
  let baseRgb = '245, 158, 11'; // subtle amber by default
  let borderRgb = '245, 158, 11';

  if (typeof rawColor === 'string') {
    if (rawColor.includes('34, 197, 94') || rawColor.includes('green')) {
      baseRgb = '34, 197, 94';
      borderRgb = '34, 197, 94';
    } else if (rawColor.includes('59, 130, 246') || rawColor.includes('blue')) {
      baseRgb = '59, 130, 246';
      borderRgb = '59, 130, 246';
    } else if (rawColor.includes('168, 85, 247') || rawColor.includes('purple')) {
      baseRgb = '168, 85, 247';
      borderRgb = '168, 85, 247';
    } else if (rawColor.includes('234, 179, 8') || rawColor.includes('yellow') || rawColor.includes('amber')) {
      baseRgb = '245, 158, 11';
      borderRgb = '245, 158, 11';
    }
  }

  return {
    bg: `rgba(${baseRgb}, 0.16)`,
    border: `rgba(${borderRgb}, 0.5)`
  };
}

function applyHighlightToHtml(html, highlight) {
  if (!highlight.text || highlight.text.length < 3) return html;
  const words = highlight.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return html;

  const styles = getHighlightStyles(highlight.color);
  const markTag = (content) => 
    `<mark id="highlight-${highlight.id}" data-highlight-id="${highlight.id}" style="background-color: ${styles.bg}; border-bottom: 2px solid ${styles.border}; color: inherit; padding: 1px 3px; border-radius: 3px; cursor: pointer;" title="${highlight.note || 'Заметка / Хайлайт'}">${content}</mark>`;

  // Build pattern matching words with arbitrary HTML tags and whitespace in-between
  const pattern = words.map(w => escapeRegExp(w)).join('(?:\\s*<[^>]+>\\s*|\\s+)');
  try {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(html)) {
      return html.replace(regex, (match) => markTag(match));
    }
  } catch (e) {
    console.warn('[Reader] Regex highlight failed:', e);
  }

  // Fallback: simple string replacement if regex fails
  if (html.includes(highlight.text)) {
    return html.replace(highlight.text, markTag(highlight.text));
  }

  return html;
}

export default function Reader() {
  const { 
    currentBook, 
    currentBookId, 
    activeChapterIdx, 
    activeSectionIdx, 
    setActiveChapter, 
    setMobileTab, 
    readSections, 
    markSectionAsRead, 
    unmarkSectionAsRead, 
    bookmarks, 
    addBookmark, 
    removeBookmark, 
    highlights, 
    addHighlight,
    pendingScrollHighlightId,
    setPendingScrollHighlightId,
    setNotesOpen,
    setInspectorOpen
  } = useStore();
  const contentRef = useRef(null);
  const [selectionRange, setSelectionRange] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  const chapters = currentBook?.chapters || currentBook?.structure || [];
  const activeChapter = chapters[activeChapterIdx];
  const section = activeChapter?.sections?.[activeSectionIdx];
  const chapterTitle = activeChapter?.title;
  const isRead = readSections[currentBookId]?.includes(section?.id);
  const bookBookmarks = bookmarks[currentBookId] || [];
  const isBookmarked = bookBookmarks.some(b => b.id === section?.id);
  
  const toggleReadStatus = () => {
    if (!section?.id) return;
    if (isRead) unmarkSectionAsRead(currentBookId, section.id);
    else markSectionAsRead(currentBookId, section.id);
  };

  const toggleBookmark = () => {
    if (!section?.id) return;
    if (isBookmarked) {
      removeBookmark(currentBookId, section.id);
    } else {
      addBookmark(currentBookId, {
        id: section.id,
        chapterIdx: activeChapterIdx,
        sectionIdx: activeSectionIdx,
        title: section.title || chapterTitle,
        timestamp: Date.now()
      });
    }
  };

  useEffect(() => {
    if (!currentBook) return;
    if (section && contentRef.current) {
      let html = section.html;
      
      // Robust highlight restoration across HTML tags
      const secHighlights = (highlights[currentBookId] || []).filter(
        h => h.chapterIdx === activeChapterIdx && h.sectionIdx === activeSectionIdx
      );
      secHighlights.forEach(h => {
        html = applyHighlightToHtml(html, h);
      });
      
      contentRef.current.innerHTML = html;

      // Handle scrolling to specific highlight if requested
      if (pendingScrollHighlightId) {
        const targetId = pendingScrollHighlightId;
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`highlight-${targetId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight pulse glow
              el.style.boxShadow = '0 0 0 4px #6366f1, 0 0 24px rgba(99, 102, 241, 0.7)';
              el.style.transition = 'box-shadow 0.4s ease';
              setTimeout(() => {
                if (el) el.style.boxShadow = 'none';
              }, 2500);
            } else if (contentRef.current?.parentElement) {
              contentRef.current.parentElement.scrollTop = 0;
            }
            setPendingScrollHighlightId(null);
          }, 80);
        });
      } else if (contentRef.current.parentElement) {
        // Scroll to top when section changes normally
        contentRef.current.parentElement.scrollTop = 0;
      }
    }
  }, [currentBook, activeChapterIdx, activeSectionIdx, section, highlights, currentBookId, pendingScrollHighlightId]);

  // Check selection for floating toolbar
  useEffect(() => {
    const checkSel = () => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      if (txt && txt.length > 5) {
        setSelectedText(txt);
        setSelectionRange(sel.getRangeAt(0).cloneRange());
      } else {
        setSelectedText('');
        setSelectionRange(null);
      }
    };
    document.addEventListener('selectionchange', checkSel);
    return () => document.removeEventListener('selectionchange', checkSel);
  }, []);

  const handleHighlight = (colorValue) => {
    if (!selectedText) return;
    
    // Save to store
    addHighlight(currentBookId, {
      id: Date.now().toString(),
      chapterIdx: activeChapterIdx,
      sectionIdx: activeSectionIdx,
      text: selectedText,
      color: colorValue,
      note: '',
      timestamp: Date.now()
    });

    // Deselect
    window.getSelection().removeAllRanges();
    setSelectedText('');
    setSelectionRange(null);
  };

  // Compute Prev / Next navigation
  const prevSectionInfo = (() => {
    if (activeSectionIdx > 0) {
      return { cIdx: activeChapterIdx, sIdx: activeSectionIdx - 1, title: activeChapter.sections[activeSectionIdx - 1]?.title };
    }
    if (activeChapterIdx > 0) {
      const prevChap = chapters[activeChapterIdx - 1];
      const lastSecIdx = (prevChap.sections?.length || 1) - 1;
      return { cIdx: activeChapterIdx - 1, sIdx: Math.max(0, lastSecIdx), title: prevChap.sections?.[lastSecIdx]?.title || prevChap.title };
    }
    return null;
  })();

  const nextSectionInfo = (() => {
    if (activeChapter?.sections && activeSectionIdx < activeChapter.sections.length - 1) {
      return { cIdx: activeChapterIdx, sIdx: activeSectionIdx + 1, title: activeChapter.sections[activeSectionIdx + 1]?.title };
    }
    if (activeChapterIdx < chapters.length - 1) {
      const nextChap = chapters[activeChapterIdx + 1];
      return { cIdx: activeChapterIdx + 1, sIdx: 0, title: nextChap.sections?.[0]?.title || nextChap.title };
    }
    return null;
  })();

  if (!currentBook) {
    return (
      <main className="flex-1 bg-bgMain relative overflow-y-auto custom-scrollbar flex items-center justify-center">
        <div className="text-textMuted flex items-center gap-3">
          <div className="spinner"></div> Загрузка книги...
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-bgMain relative overflow-y-auto custom-scrollbar scroll-smooth p-4 sm:p-6 md:p-10 pb-20 md:pb-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primaryGlow">
              {chapterTitle}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {section?.title || chapterTitle}
            </h1>
          </div>
          {section?.id && (
            <div className="flex gap-2">
              <button 
                onClick={toggleBookmark}
                className={`shrink-0 flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-lg border transition-colors ${
                  isBookmarked ? 'bg-primary/20 text-primaryGlow border-primary/30' : 'bg-bgSidebar text-textDim border-borderColor hover:text-white hover:bg-white/5'
                }`}
                title={isBookmarked ? 'Удалить закладку' : 'Добавить закладку'}
              >
                <Bookmark size={20} className={isBookmarked ? 'opacity-100 fill-primaryGlow' : 'opacity-50'} />
              </button>
              <button 
                onClick={toggleReadStatus}
                className={`shrink-0 flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-lg border transition-colors ${
                  isRead ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-bgSidebar text-textDim border-borderColor hover:text-white hover:bg-white/5'
                }`}
                title={isRead ? 'Отметить как непрочитанное' : 'Отметить как прочитанное'}
              >
                <CheckCircle2 size={20} className={`sm:mr-2 ${isRead ? 'opacity-100' : 'opacity-50'}`} />
                <span className="hidden sm:inline text-sm font-medium">
                  {isRead ? 'Прочитано' : 'Отметить'}
                </span>
              </button>
            </div>
          )}
        </div>
        
        <div 
          ref={contentRef}
          className="prose prose-invert prose-base sm:prose-lg max-w-none prose-headings:text-white prose-p:text-textMain prose-p:leading-relaxed prose-a:text-primaryGlow prose-pre:bg-bgSidebar prose-pre:border-borderColor prose-img:rounded-lg overflow-x-auto"
        ></div>

        {/* Navigation bottom pagination */}
        <div className="mt-12 pt-6 border-t border-borderColor flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {prevSectionInfo ? (
            <button
              onClick={() => setActiveChapter(prevSectionInfo.cIdx, prevSectionInfo.sIdx)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bgSidebar hover:bg-white/5 border border-borderColor text-sm text-textMain transition-all text-left group"
            >
              <ChevronLeft size={16} className="shrink-0 text-textDim group-hover:text-white transition-colors" />
              <div className="overflow-hidden">
                <div className="text-[10px] text-textDim uppercase">Назад</div>
                <div className="truncate font-medium max-w-[200px]">{prevSectionInfo.title}</div>
              </div>
            </button>
          ) : <div />}

          {nextSectionInfo && (
            <button
              onClick={() => setActiveChapter(nextSectionInfo.cIdx, nextSectionInfo.sIdx)}
              className="flex items-center justify-end gap-2 px-4 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-sm text-primaryGlow transition-all text-right group ml-auto"
            >
              <div className="overflow-hidden">
                <div className="text-[10px] text-primaryGlow/70 uppercase">Далее</div>
                <div className="truncate font-medium max-w-[200px]">{nextSectionInfo.title}</div>
              </div>
              <ChevronRight size={16} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Selected Text */}
      {selectedText && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-bgSidebar border border-borderColor shadow-2xl shadow-black rounded-2xl p-2 flex flex-col gap-2 w-[90vw] max-w-sm">
            <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-white/5">
              <span className="text-xs text-textMuted font-medium">Действия с текстом</span>
              <span className="text-[10px] text-textDim">{selectedText.length} симв.</span>
            </div>
            
            <div className="flex items-center justify-around gap-2">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleHighlight(c.value)}
                  className="w-8 h-8 rounded-full border border-white/20 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer shadow-sm"
                  style={{ backgroundColor: c.dotColor }}
                  title={`Выделить цветом: ${c.label}`}
                >
                  <PenTool size={14} className="text-white opacity-90" />
                </button>
              ))}
              
              <div className="w-px h-8 bg-white/10 mx-1"></div>
              
              <button 
                onClick={() => {
                  setMobileTab('ai');
                  setInspectorOpen(true);
                }}
                className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-primary to-accentPurple text-white text-xs font-semibold shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 border border-white/20 cursor-pointer hover:brightness-110 transition-all"
              >
                <Sparkles size={14} /> ИИ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
