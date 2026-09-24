import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronRight, FileText, PanelLeftClose, Bookmark, List } from 'lucide-react';

export default function Sidebar() {
  const { 
    currentBook, 
    currentBookId,
    activeChapterIdx, 
    activeSectionIdx, 
    setActiveChapter, 
    sidebarWidth, 
    setSidebarOpen,
    readSections,
    bookmarks,
    quizResults
  } = useStore();
  const [expandedChapters, setExpandedChapters] = useState(new Set([0]));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('toc'); // 'toc' | 'bookmarks'

  if (!currentBook) {
    return (
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className="w-full md:w-auto bg-bgSidebar md:border-r border-borderColor flex flex-col shrink-0 p-4"
      >
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-4 bg-white/5 rounded w-3/4"></div>
          <div className="h-4 bg-white/5 rounded w-1/2"></div>
        </div>
      </aside>
    );
  }

  const toggleChapter = (idx, e) => {
    e.stopPropagation();
    const next = new Set(expandedChapters);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedChapters(next);
  };

  const chapters = currentBook?.chapters || currentBook?.structure || [];

  const filteredChapters = chapters.map((chapter, cIdx) => {
    if (!searchQuery.trim()) return { ...chapter, originalIndex: cIdx, matchedSections: chapter.sections || [] };
    const q = searchQuery.toLowerCase();
    const chapterMatch = chapter.title.toLowerCase().includes(q);
    const matchedSections = (chapter.sections || []).filter(s => 
      s.title.toLowerCase().includes(q)
    );
    if (chapterMatch || matchedSections.length > 0) {
      return { ...chapter, originalIndex: cIdx, matchedSections: chapterMatch ? (chapter.sections || []) : matchedSections };
    }
    return null;
  }).filter(Boolean);

  const bookReadSections = readSections[currentBookId] || [];
  const bookBookmarks = bookmarks[currentBookId] || [];
  const totalSections = chapters.reduce((acc, chap) => acc + (chap.sections?.length || 0), 0);
  const readCount = bookReadSections.length;
  const progressPercent = totalSections === 0 ? 0 : Math.round((readCount / totalSections) * 100);

  return (
    <aside 
      style={{ width: `${sidebarWidth}px` }}
      className="w-full md:w-auto bg-bgSidebar md:border-r border-borderColor flex flex-col shrink-0 h-full select-none"
    >
      <div className="p-3 border-b border-borderColor flex items-center gap-2">
        <div className="flex bg-black/40 rounded-lg p-1 flex-1">
          <button
            onClick={() => setActiveTab('toc')}
            className={`flex-1 flex justify-center py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'toc' ? 'bg-white/10 text-white' : 'text-textDim hover:text-textMuted'
            }`}
          >
            <List size={14} className="mr-1.5" />
            Оглавление
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`flex-1 flex justify-center py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'bookmarks' ? 'bg-white/10 text-white' : 'text-textDim hover:text-textMuted'
            }`}
          >
            <Bookmark size={14} className="mr-1.5" />
            Закладки
            {bookBookmarks.length > 0 && (
              <span className="ml-1.5 px-1.5 rounded-full bg-primary/20 text-primaryGlow text-[10px]">
                {bookBookmarks.length}
              </span>
            )}
          </button>
        </div>

        {/* Close/collapse button for desktop */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
          title="Скрыть панель"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      {activeTab === 'toc' && (
        <div className="px-3 md:px-3.5 py-2 border-b border-borderColor">
          <div className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по главам..." 
              className="w-full bg-black/40 border border-borderColor rounded-lg py-1.5 pl-2.5 pr-7 text-xs text-textMain outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-xs text-textDim hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar (only in TOC tab) */}
      {activeTab === 'toc' && totalSections > 0 && (
        <div className="px-4 py-3 border-b border-borderColor bg-black/20">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-textMuted font-medium">Прогресс чтения</span>
            <span className="text-xs font-mono text-primaryGlow">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-textDim mt-1.5 text-right">
            {readCount} из {totalSections} разделов
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {activeTab === 'bookmarks' ? (
          bookBookmarks.length === 0 ? (
            <div className="text-center py-10 px-4 text-sm text-textDim">
              <Bookmark size={32} className="mx-auto mb-3 opacity-20" />
              Нет сохраненных закладок.<br/>
              <span className="text-xs mt-2 block">Добавляйте их во время чтения.</span>
            </div>
          ) : (
            <div className="px-2">
              {bookBookmarks.sort((a, b) => b.timestamp - a.timestamp).map(bm => (
                <div 
                  key={bm.id}
                  onClick={() => setActiveChapter(bm.chapterIdx, bm.sectionIdx)}
                  className="p-3 mb-1.5 rounded-lg cursor-pointer transition-colors bg-white/5 hover:bg-white/10 group"
                >
                  <div className="flex items-start gap-2">
                    <Bookmark size={14} className="mt-0.5 text-primaryGlow shrink-0" />
                    <div>
                      <div className="text-sm text-white font-medium leading-snug group-hover:text-primaryGlow transition-colors">
                        {bm.title}
                      </div>
                      <div className="text-[10px] text-textDim mt-1 flex items-center gap-2">
                        <span>Глава {bm.chapterIdx + 1}</span>
                        <span>•</span>
                        <span>{new Date(bm.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredChapters.length === 0 ? (
          <div className="text-center py-8 text-sm text-textDim">
            Ничего не найдено
          </div>
        ) : (
          filteredChapters.map((chapter) => {
            const cIdx = chapter.originalIndex;
            const isExpanded = searchQuery ? true : expandedChapters.has(cIdx);
            const isActive = activeChapterIdx === cIdx;
            const sections = chapter.matchedSections || [];
            
            return (
              <div key={cIdx} className="mb-1">
                <div 
                  onClick={() => {
                    setActiveChapter(cIdx, 0);
                    if (!isExpanded) toggleChapter(cIdx, { stopPropagation: () => {} });
                  }}
                  className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                    isActive ? 'bg-primary/10 text-primaryGlow' : 'hover:bg-white/5 text-textMain'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    <button 
                      onClick={(e) => toggleChapter(cIdx, e)}
                      className="p-1 rounded hover:bg-white/10 text-textMuted shrink-0"
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <span className="text-sm font-medium leading-snug" title={chapter.title}>
                      {chapter.title}
                    </span>
                  </div>
                  <span className="text-xs text-textMuted font-mono shrink-0">
                    {sections.length}
                  </span>
                </div>

                {isExpanded && sections.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {sections.map((sec, sIdx) => {
                      const isSecActive = isActive && activeSectionIdx === sIdx;
                      const isRead = bookReadSections.includes(sec.id);
                      const quiz = quizResults[currentBookId]?.[sec.id];
                      return (
                        <div 
                          key={sIdx}
                          onClick={() => setActiveChapter(cIdx, sIdx)}
                          className={`flex items-start gap-2.5 pl-10 pr-4 py-2 cursor-pointer text-sm transition-colors rounded-r-md ${
                            isSecActive ? 'text-primaryGlow bg-primary/10 font-medium' : 'text-textMuted hover:text-textMain hover:bg-white/5'
                          }`}
                        >
                          <div className="mt-0.5 relative shrink-0">
                            <FileText size={14} className={`transition-opacity ${isRead ? 'opacity-20' : 'opacity-50'}`} />
                            {isRead && (
                              <div className="absolute -bottom-1 -right-1 bg-bgSidebar rounded-full">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-bgSidebar" />
                              </div>
                            )}
                          </div>
                          <span className={`leading-snug flex-1 ${isRead && !isSecActive ? 'text-textDim' : ''}`}>{sec.title}</span>
                          {quiz && (
                            <span 
                              className={`shrink-0 text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                                quiz.percentage >= 80 
                                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' 
                                  : quiz.percentage >= 50 
                                    ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' 
                                    : 'border-red-500/40 text-red-400 bg-red-500/10'
                              }`}
                              title={`Квиз: ${quiz.score}/${quiz.total} (${quiz.percentage}%)`}
                            >
                              {quiz.percentage}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
