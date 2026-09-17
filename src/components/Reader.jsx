import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export default function Reader() {
  const { currentBook, activeChapterIdx, activeSectionIdx, setActiveChapter, setMobileTab } = useStore();
  const contentRef = useRef(null);
  const [hasSelection, setHasSelection] = React.useState(false);

  const chapters = currentBook?.chapters || currentBook?.structure || [];
  const activeChapter = chapters[activeChapterIdx];
  const section = activeChapter?.sections?.[activeSectionIdx];
  const chapterTitle = activeChapter?.title;

  useEffect(() => {
    if (!currentBook) return;
    if (section && contentRef.current) {
      contentRef.current.innerHTML = section.html;
      // Scroll to top when section changes
      if (contentRef.current.parentElement) {
        contentRef.current.parentElement.scrollTop = 0;
      }
    }
  }, [currentBook, activeChapterIdx, activeSectionIdx, section]);

  // Check selection for mobile quick action
  useEffect(() => {
    const checkSel = () => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      setHasSelection(Boolean(txt && txt.length > 5));
    };
    document.addEventListener('selectionchange', checkSel);
    return () => document.removeEventListener('selectionchange', checkSel);
  }, []);

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
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primaryGlow">
          {chapterTitle}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-white leading-tight">
          {section?.title || chapterTitle}
        </h1>
        
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

      {/* Floating mobile prompt if text selected */}
      {hasSelection && (
        <div className="md:hidden fixed bottom-16 left-4 right-4 z-40 animate-bounce">
          <button 
            onClick={() => setMobileTab('ai')}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary to-accentPurple text-white text-xs font-semibold shadow-xl shadow-primary/30 flex items-center justify-center gap-2 border border-white/20"
          >
            <Sparkles size={16} /> Текст выделен! Открыть ИИ-инспектор
          </button>
        </div>
      )}
    </main>
  );
}
