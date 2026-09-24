import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Download, Trash2, PenTool, Layers } from 'lucide-react';

export default function NotesModal() {
  const { 
    isNotesOpen, 
    setNotesOpen, 
    currentBook, 
    currentBookId, 
    highlights, 
    removeHighlight, 
    updateHighlightNote, 
    setActiveChapter,
    setPendingScrollHighlightId,
    addFlashcard,
    setFlashcardsOpen,
    setFlashcardModalTab
  } = useStore();
  const [editingId, setEditingId] = useState(null);
  const [noteText, setNoteText] = useState('');

  if (!isNotesOpen) return null;

  const bookHighlights = highlights[currentBookId] || [];

  const handleExport = () => {
    let content = `# Заметки и Хайлайты: ${currentBook?.title || 'Книга'}\n\n`;
    const sorted = [...bookHighlights].sort((a, b) => a.chapterIdx - b.chapterIdx || a.sectionIdx - b.sectionIdx);
    
    sorted.forEach(h => {
      content += `> ${h.text}\n`;
      if (h.note) {
        content += `**Заметка:** ${h.note}\n`;
      }
      content += `\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${currentBookId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveNote = (id) => {
    updateHighlightNote(currentBookId, id, noteText);
    setEditingId(null);
    setNoteText('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bgMain border border-borderColor rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-borderColor bg-bgSidebar">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Ваши Заметки</h2>
            <p className="text-xs text-textDim mt-1">
              {bookHighlights.length} {bookHighlights.length === 1 ? 'сохранение' : 'сохранений'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bookHighlights.length > 0 && (
              <button 
                onClick={handleExport}
                className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-borderColor bg-white/5 hover:bg-white/10 text-textMain hover:text-white transition-colors flex items-center gap-2"
                title="Экспорт в Markdown"
              >
                <Download size={16} />
                <span className="hidden sm:inline text-sm">Экспорт</span>
              </button>
            )}
            <button 
              onClick={() => setNotesOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-black/20">
          {bookHighlights.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-textDim">
              <PenTool size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Нет сохраненных заметок</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookHighlights.sort((a, b) => b.timestamp - a.timestamp).map(h => (
                <div key={h.id} className="bg-bgSidebar border border-borderColor rounded-xl p-4 group">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div 
                      className="text-sm text-textMain leading-relaxed p-2 rounded border-l-4"
                      style={{ borderColor: h.color, backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                      {h.text}
                    </div>
                    <button
                      onClick={() => removeHighlight(currentBookId, h.id)}
                      className="text-textDim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {editingId === h.id ? (
                    <div className="mt-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full bg-black/40 border border-primary/50 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary resize-none h-20"
                        placeholder="Ваша заметка..."
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-textDim hover:text-white hover:bg-white/10 transition-colors"
                        >
                          Отмена
                        </button>
                        <button 
                          onClick={() => saveNote(h.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primaryGlow transition-colors"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between">
                      {h.note ? (
                        <div 
                          className="text-sm text-primaryGlow bg-primary/10 px-3 py-2 rounded-lg cursor-pointer flex-1 mr-4"
                          onClick={() => { setEditingId(h.id); setNoteText(h.note); }}
                        >
                          {h.note}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingId(h.id); setNoteText(''); }}
                          className="text-xs text-textDim hover:text-white transition-colors px-2 py-1 bg-white/5 rounded"
                        >
                          + Добавить заметку
                        </button>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            addFlashcard(currentBookId, {
                              front: h.text,
                              back: h.note || '',
                              chapterIdx: h.chapterIdx,
                              sectionIdx: h.sectionIdx
                            });
                            setFlashcardModalTab('create');
                            setNotesOpen(false);
                            setFlashcardsOpen(true);
                          }}
                          className="text-xs text-primaryGlow hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                          title="Создать флешкарту для интервального повторения"
                        >
                          <Layers size={12} />
                          <span>→ Флешкарта</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setPendingScrollHighlightId(h.id);
                            setActiveChapter(h.chapterIdx, h.sectionIdx);
                            setNotesOpen(false);
                          }}
                          className="text-xs text-textMuted hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          Перейти к тексту
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
