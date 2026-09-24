import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  X, BookMarked, Search, Plus, Trash2, Edit2, 
  Sparkles, Download, Loader2, BookOpen, ChevronRight 
} from 'lucide-react';

const LANGUAGE_NAMES = {
  ru: 'Russian (на русском языке)',
  en: 'English',
  de: 'German (auf Deutsch)',
  es: 'Spanish (en español)',
  fr: 'French (en français)',
  zh: 'Chinese (用中文)'
};

export default function GlossaryModal() {
  const {
    isGlossaryOpen,
    setGlossaryOpen,
    currentBook,
    currentBookId,
    activeChapterIdx,
    activeSectionIdx,
    glossary,
    addGlossaryTerm,
    updateGlossaryTerm,
    deleteGlossaryTerm,
    apiKey,
    model,
    language,
    setSettingsOpen
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [termName, setTermName] = useState('');
  const [termDef, setTermDef] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const bookTerms = glossary[currentBookId] || [];

  if (!isGlossaryOpen) return null;

  const handleAiDefine = async () => {
    if (!termName.trim()) {
      alert('Введите название термина для генерации определения.');
      return;
    }
    if (!apiKey) {
      setSettingsOpen(true);
      alert('Укажите ваш API-ключ OpenRouter в настройках.');
      return;
    }

    setIsGenerating(true);
    const targetLang = LANGUAGE_NAMES[language] || 'Russian';

    const prompt = `You are a technical glossary writer for computer systems engineers.
Define the term "${termName.trim()}" in the context of the book "${currentBook?.title || 'Distributed Systems & Data Engineering'}".
Provide a clear, authoritative, concise definition (1-3 sentences, under 60 words).
Language: ${targetLang}`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Visual Reader React - Glossary'
        },
        body: JSON.stringify({
          model: model || 'openrouter/free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      setTermDef(content.trim());
    } catch (err) {
      console.error('Glossary AI Error:', err);
      alert('Не удалось сгенерировать определение ИИ.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveTerm = () => {
    if (!termName.trim() || !termDef.trim()) return;

    if (editingId) {
      updateGlossaryTerm(currentBookId, editingId, {
        term: termName.trim(),
        definition: termDef.trim()
      });
      setEditingId(null);
    } else {
      addGlossaryTerm(currentBookId, {
        term: termName.trim(),
        definition: termDef.trim(),
        chapterIdx: activeChapterIdx,
        sectionIdx: activeSectionIdx
      });
    }

    setTermName('');
    setTermDef('');
    setIsAdding(false);
  };

  const handleExportMarkdown = () => {
    if (bookTerms.length === 0) return;
    let md = `# Глоссарий терминов: ${currentBook?.title || 'Книга'}\n\n`;
    
    const sorted = [...bookTerms].sort((a, b) => a.term.localeCompare(b.term));
    sorted.forEach(t => {
      md += `### ${t.term}\n${t.definition}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glossary_${currentBookId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sort and filter terms
  const filteredTerms = bookTerms
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q);
    })
    .sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={() => setGlossaryOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-bgModal border border-borderColor rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-borderColor bg-black/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primaryGlow">
              <BookMarked size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Глоссарий терминов</h3>
              <p className="text-[11px] text-textDim">{currentBook?.title || 'Книга'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {bookTerms.length > 0 && (
              <button
                onClick={handleExportMarkdown}
                title="Экспорт в Markdown"
                className="p-1.5 rounded-lg text-textDim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download size={15} />
              </button>
            )}
            <button
              onClick={() => setGlossaryOpen(false)}
              className="p-1.5 rounded-lg text-textDim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Add Term */}
        <div className="p-3 border-b border-borderColor bg-white/[0.02] flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textDim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по терминам и определениям..."
              className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-borderColor rounded-xl text-xs text-textMain outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={() => {
              setEditingId(null);
              setTermName('');
              setTermDef('');
              setIsAdding(prev => !prev);
            }}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primaryGlow text-white text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            <Plus size={13} />
            <span>{isAdding ? 'Отмена' : 'Добавить термин'}</span>
          </button>
        </div>

        {/* Add / Edit Form */}
        {isAdding && (
          <div className="p-4 bg-primary/5 border-b border-primary/20 flex flex-col gap-3 animate-fade-in">
            <div className="text-xs font-semibold text-white">
              {editingId ? 'Редактировать термин:' : 'Новый термин глоссария:'}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="Термин (например, SSTable, Линеаризуемость)..."
                className="flex-1 p-2.5 bg-black/50 border border-borderColor rounded-xl text-xs text-white outline-none focus:border-primary"
              />
              <button
                disabled={isGenerating || !termName.trim()}
                onClick={handleAiDefine}
                className="px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primaryGlow text-xs font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shrink-0"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>ИИ Определение</span>
              </button>
            </div>

            <textarea
              value={termDef}
              onChange={(e) => setTermDef(e.target.value)}
              placeholder="Точное и краткое определение термина..."
              rows={3}
              className="w-full p-2.5 bg-black/50 border border-borderColor rounded-xl text-xs text-textMain outline-none focus:border-primary resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-textDim hover:text-white"
              >
                Отмена
              </button>
              <button
                disabled={!termName.trim() || !termDef.trim()}
                onClick={handleSaveTerm}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primaryGlow disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-primary/20"
              >
                Сохранить в глоссарий
              </button>
            </div>
          </div>
        )}

        {/* Terms List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredTerms.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-textDim mb-3">
                <BookMarked size={22} />
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                {bookTerms.length === 0 ? 'Глоссарий пока пуст' : 'Термин не найден'}
              </div>
              <p className="text-xs text-textMuted max-w-xs leading-relaxed">
                {bookTerms.length === 0
                  ? 'Выделяйте ключевые термины при чтении или добавляйте их вручную с помощью ИИ.'
                  : `По запросу "${searchQuery}" совпадений не обнаружено.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredTerms.map((item) => (
                <div 
                  key={item.id}
                  className="p-3.5 rounded-xl bg-bgCard border border-borderColor hover:border-primary/40 transition-all flex flex-col gap-1.5 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-primaryGlow">
                      {item.term}
                    </h4>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setTermName(item.term);
                          setTermDef(item.definition);
                          setIsAdding(true);
                        }}
                        className="p-1 rounded text-textDim hover:text-white hover:bg-white/10"
                        title="Редактировать"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => deleteGlossaryTerm(currentBookId, item.id)}
                        className="p-1 rounded text-textDim hover:text-red-400 hover:bg-red-500/10"
                        title="Удалить"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-textMain leading-relaxed">
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
