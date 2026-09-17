import React from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

export default function Sidebar() {
  const { currentBook, activeChapterIdx, activeSectionIdx, setActiveChapter } = useStore();
  const [expandedChapters, setExpandedChapters] = React.useState(new Set([0]));

  if (!currentBook) {
    return (
      <aside className="w-80 bg-bgSidebar border-r border-borderColor flex flex-col shrink-0 p-4">
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

  return (
    <aside className="w-80 bg-bgSidebar border-r border-borderColor flex flex-col shrink-0">
      <div className="p-4 border-b border-borderColor">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Поиск по главам и разделам..." 
            className="w-full bg-black/40 border border-borderColor rounded-md py-2 px-3 text-sm text-textMain outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {currentBook.structure.map((chapter, cIdx) => {
          const isExpanded = expandedChapters.has(cIdx);
          const isActive = activeChapterIdx === cIdx;
          
          return (
            <div key={cIdx} className="mb-1">
              <div 
                onClick={() => {
                  setActiveChapter(cIdx, 0);
                  if (!isExpanded) toggleChapter(cIdx, { stopPropagation: () => {} });
                }}
                className={`group flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
                  isActive ? 'bg-primary/10 text-primaryGlow' : 'hover:bg-white/5 text-textMain'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <button 
                    onClick={(e) => toggleChapter(cIdx, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-textMuted shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="text-sm font-medium truncate" title={chapter.title}>
                    {chapter.title}
                  </span>
                </div>
                <span className="text-xs text-textMuted font-mono shrink-0 ml-2">
                  {chapter.sections.length}
                </span>
              </div>

              {isExpanded && chapter.sections.length > 0 && (
                <div className="mt-1">
                  {chapter.sections.map((sec, sIdx) => {
                    const isSecActive = isActive && activeSectionIdx === sIdx;
                    return (
                      <div 
                        key={sIdx}
                        onClick={() => setActiveChapter(cIdx, sIdx)}
                        className={`flex items-start gap-2 pl-10 pr-4 py-1.5 cursor-pointer text-sm transition-colors ${
                          isSecActive ? 'text-primaryGlow bg-primary/5' : 'text-textMuted hover:text-textMain hover:bg-white/5'
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
        })}
      </div>
    </aside>
  );
}
