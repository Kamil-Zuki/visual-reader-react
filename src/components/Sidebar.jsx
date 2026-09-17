import React from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronRight, FileText, PanelLeftClose } from 'lucide-react';

export default function Sidebar() {
  const { 
    currentBook, 
    activeChapterIdx, 
    activeSectionIdx, 
    setActiveChapter, 
    sidebarWidth, 
    setSidebarOpen 
  } = useStore();
  const [expandedChapters, setExpandedChapters] = React.useState(new Set([0]));
  const [searchQuery, setSearchQuery] = React.useState('');

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

  return (
    <aside 
      style={{ width: `${sidebarWidth}px` }}
      className="w-full md:w-auto bg-bgSidebar md:border-r border-borderColor flex flex-col shrink-0 h-full select-none"
    >
      <div className="p-3 md:p-3.5 border-b border-borderColor flex items-center gap-2">
        <div className="relative flex-1">
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

        {/* Close/collapse button for desktop */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors cursor-pointer shrink-0"
          title="Скрыть панель оглавления"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {filteredChapters.length === 0 ? (
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
                      return (
                        <div 
                          key={sIdx}
                          onClick={() => setActiveChapter(cIdx, sIdx)}
                          className={`flex items-start gap-2.5 pl-10 pr-4 py-2 cursor-pointer text-sm transition-colors rounded-r-md ${
                            isSecActive ? 'text-primaryGlow bg-primary/10 font-medium' : 'text-textMuted hover:text-textMain hover:bg-white/5'
                          }`}
                        >
                          <FileText size={14} className="mt-0.5 opacity-50 shrink-0" />
                          <span className="leading-snug">{sec.title}</span>
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
