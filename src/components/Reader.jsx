import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export default function Reader() {
  const { currentBook, activeChapterIdx, activeSectionIdx } = useStore();
  const contentRef = useRef(null);

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
    <main className="flex-1 bg-bgMain relative overflow-y-auto custom-scrollbar scroll-smooth p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">{section?.title || chapterTitle}</h1>
        <div 
          ref={contentRef}
          className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-textMain prose-a:text-primaryGlow prose-pre:bg-bgSidebar prose-pre:border-borderColor prose-img:rounded-lg"
        ></div>
      </div>
    </main>
  );
}
