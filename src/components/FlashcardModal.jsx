import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  X, Sparkles, RotateCw, Check, Trash2, Edit2, Plus,
  Download, Layers, Calendar, Clock, BookOpen, ChevronRight, Loader2, Send,
} from 'lucide-react';
import { pushFlashcardsToAnki } from '../services/ankiConnectService';

const LANGUAGE_NAMES = {
  ru: 'Russian (на русском языке)',
  en: 'English',
  de: 'German (auf Deutsch)',
  es: 'Spanish (en español)',
  fr: 'French (en français)',
  zh: 'Chinese (用中文)'
};

export default function FlashcardModal() {
  const {
    isFlashcardsOpen,
    setFlashcardsOpen,
    flashcardModalTab,
    setFlashcardModalTab,
    currentBook,
    currentBookId,
    activeChapterIdx,
    activeSectionIdx,
    flashcards,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    reviewFlashcard,
    apiKey,
    model,
    language,
    setSettingsOpen,
    ankiSettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'all' | 'create'
  const [reviewIdx, setReviewIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New / Edit card form state
  const [editingCardId, setEditingCardId] = useState(null);
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [ankiSending, setAnkiSending] = useState(false);

  const bookCards = flashcards[currentBookId] || [];

  // Filter cards due for review (nextReviewDate <= Date.now())
  const dueCards = bookCards.filter(c => !c.nextReviewDate || c.nextReviewDate <= Date.now());

  useEffect(() => {
    if (isFlashcardsOpen) {
      if (flashcardModalTab) {
        setActiveTab(flashcardModalTab);
      } else {
        setActiveTab(dueCards.length > 0 ? 'review' : 'all');
      }
      setReviewIdx(0);
      setIsFlipped(false);
    }
  }, [isFlashcardsOpen, flashcardModalTab]);

  // Flip card with Space key
  useEffect(() => {
    if (!isFlashcardsOpen || activeTab !== 'review') return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlashcardsOpen, activeTab]);

  if (!isFlashcardsOpen) return null;

  const currentReviewCard = dueCards[reviewIdx];

  const handleReviewRating = (rating) => {
    if (!currentReviewCard) return;
    reviewFlashcard(currentBookId, currentReviewCard.id, rating);
    setIsFlipped(false);
    if (reviewIdx < dueCards.length - 1) {
      setReviewIdx(prev => prev + 1);
    } else {
      // Completed session
      setReviewIdx(0);
    }
  };

  const handleAiGenerateCard = async () => {
    if (!frontText && !backText) {
      alert('Пожалуйста, введите фрагмент текста или концепт для генерации карточки.');
      return;
    }
    if (!apiKey) {
      setSettingsOpen(true);
      alert('Укажите ваш API-ключ OpenRouter в настройках.');
      return;
    }

    setIsAiGenerating(true);
    const targetLang = LANGUAGE_NAMES[language] || 'Russian';
    const inputText = backText || frontText;

    const prompt = `You are an expert tutor creating high-yield flashcards for spaced repetition (Anki / SuperMemo).
Based on this text, concept, or excerpt from the book "${currentBook?.title || 'Book'}" by ${currentBook?.author || 'Author'}:
"${inputText}"

Generate a single focused, high-retention flashcard:
1. FRONT: A clear, specific question or prompt testing the core concept, meaning, significance, or mechanism (under 25 words).
2. BACK: A crisp, precise, and complete answer or explanation (under 50 words).

Respond STRICTLY in this format with nothing else:
FRONT: <question>
BACK: <answer>
Language: ${targetLang}`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Visual Reader React - Flashcards'
        },
        body: JSON.stringify({
          model: model || 'openrouter/free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });

      if (!res.ok) throw new Error('Ошибка API OpenRouter');
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      const frontMatch = content.match(/(?:\*{0,2}FRONT\*{0,2}|Вопрос):\s*(.*?)(?=\n(?:\*{0,2}BACK\*{0,2}|Ответ):|$)/is);
      const backMatch = content.match(/(?:\*{0,2}BACK\*{0,2}|Ответ):\s*([\s\S]*)/is);

      if (frontMatch && backMatch) {
        setFrontText(frontMatch[1].trim());
        setBackText(backMatch[1].trim());
      } else {
        // Fallback: if format wasn't strictly followed, put content in back
        setBackText(content.trim());
      }
    } catch (err) {
      console.error('Flashcard AI Error:', err);
      alert('Не удалось сгенерировать карточку с помощью ИИ.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveCard = () => {
    if (!frontText.trim() || !backText.trim()) return;

    if (editingCardId) {
      updateFlashcard(currentBookId, editingCardId, {
        front: frontText.trim(),
        back: backText.trim()
      });
      setEditingCardId(null);
    } else {
      addFlashcard(currentBookId, {
        front: frontText.trim(),
        back: backText.trim(),
        chapterIdx: activeChapterIdx,
        sectionIdx: activeSectionIdx
      });
    }

    setFrontText('');
    setBackText('');
    setActiveTab('all');
  };

  const handleSendToAnki = async (cardsToSend) => {
    const list = cardsToSend || bookCards;
    if (!list.length) return;
    setAnkiSending(true);
    try {
      const result = await pushFlashcardsToAnki(list, currentBook?.title, ankiSettings);
      alert(
        `Anki: добавлено ${result.added} из ${result.total}` +
          (result.skipped ? `, пропущено (дубликаты): ${result.skipped}` : '')
      );
    } catch (err) {
      alert(`AnkiConnect: ${err.message}\n\nПроверьте Anki и вкладку «Anki» в настройках.`);
    } finally {
      setAnkiSending(false);
    }
  };

  const handleExportCsv = () => {
    if (bookCards.length === 0) return;
    // Anki header directives (lines starting with # are treated as metadata and not imported as cards)
    let tsv = '#separator:tab\n#html:true\n';
    bookCards.forEach(c => {
      const f = c.front.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
      const b = c.back.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
      tsv += `${f}\t${b}\n`;
    });

    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_${currentBookId}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCards = bookCards.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q);
  });

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={() => setFlashcardsOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-bgModal border border-borderColor rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-borderColor bg-black/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primaryGlow">
              <Layers size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Флешкарты и Интервальное повторение</h3>
              <p className="text-[11px] text-textDim">{currentBook?.title || 'Книга'}</p>
            </div>
          </div>

          <button
            onClick={() => setFlashcardsOpen(false)}
            className="p-1.5 rounded-lg text-textDim hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-borderColor bg-white/[0.02]">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'review'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textDim hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Повторение</span>
              {dueCards.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'review' ? 'bg-white/20 text-white' : 'bg-primary/20 text-primaryGlow'
                }`}>
                  {dueCards.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textDim hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Все карточки ({bookCards.length})</span>
            </button>

            <button
              onClick={() => {
                setEditingCardId(null);
                setFrontText('');
                setBackText('');
                setActiveTab('create');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textDim hover:text-white hover:bg-white/5'
              }`}
            >
              <Plus size={13} />
              <span>Создать</span>
            </button>
          </div>

          {bookCards.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSendToAnki(bookCards)}
                disabled={ankiSending}
                className="text-xs text-primaryGlow hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                title="Отправить в Anki через AnkiConnect"
              >
                {ankiSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span className="hidden sm:inline">AnkiConnect</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="text-xs text-textDim hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                title="Скачать TSV для импорта в Anki"
              >
                <Download size={13} />
                <span className="hidden sm:inline">TSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col justify-center">
          {/* TAB 1: Review Mode */}
          {activeTab === 'review' && (
            <div className="flex-1 flex flex-col justify-center items-center">
              {dueCards.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 border border-emerald-500/20">
                    <Check size={28} />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-1">Все карточки повторены! 🎉</h4>
                  <p className="text-xs text-textMuted max-w-xs leading-relaxed mb-4">
                    На сегодня запланированных повторений нет. Интервальный алгоритм (SM-2) предложит карточки, когда наступит оптимальное время для закрепления памяти.
                  </p>
                  <button
                    onClick={() => setActiveTab('all')}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all cursor-pointer"
                  >
                    Посмотреть все карточки ({bookCards.length})
                  </button>
                </div>
              ) : currentReviewCard ? (
                <div className="w-full max-w-lg flex flex-col gap-4">
                  {/* Progress Header */}
                  <div className="flex items-center justify-between text-xs text-textDim">
                    <span>Карточка {reviewIdx + 1} из {dueCards.length}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Интервал: {currentReviewCard.interval || 1} дн.
                    </span>
                  </div>

                  {/* 3D Flip Card */}
                  <div 
                    onClick={() => setIsFlipped(prev => !prev)}
                    className="w-full min-h-[260px] p-6 rounded-2xl bg-gradient-to-b from-bgCard to-[#141824] border border-borderColor hover:border-primary/40 shadow-xl cursor-pointer flex flex-col justify-between transition-all group relative select-none"
                  >
                    <div className="flex items-center justify-between text-[11px] text-textDim">
                      <span className="uppercase font-semibold tracking-wider text-primaryGlow">
                        {isFlipped ? 'Оборот (Ответ)' : 'Лицевая сторона (Вопрос)'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-textDim group-hover:text-white transition-colors">
                        <RotateCw size={11} /> Нажмите или Пробел для переворота
                      </span>
                    </div>

                    <div className="my-auto py-4">
                      <div className="text-base sm:text-lg font-medium text-white leading-relaxed text-center">
                        {isFlipped ? currentReviewCard.back : currentReviewCard.front}
                      </div>
                    </div>

                    <div className="text-center text-[11px] text-textDim">
                      {isFlipped ? 'Оцените, насколько легко вспомнили:' : 'Вспомните ответ и переверните карточку'}
                    </div>
                  </div>

                  {/* Rating Buttons (SM-2 Spaced Repetition) */}
                  {isFlipped ? (
                    <div className="grid grid-cols-4 gap-2 pt-1 animate-fade-in">
                      <button
                        onClick={() => handleReviewRating(1)}
                        className="py-2.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                      >
                        <span>Снова</span>
                        <span className="text-[10px] opacity-70">&lt; 1 дн.</span>
                      </button>

                      <button
                        onClick={() => handleReviewRating(2)}
                        className="py-2.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                      >
                        <span>Трудно</span>
                        <span className="text-[10px] opacity-70">1-2 дн.</span>
                      </button>

                      <button
                        onClick={() => handleReviewRating(3)}
                        className="py-2.5 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                      >
                        <span>Хорошо</span>
                        <span className="text-[10px] opacity-70">3-4 дн.</span>
                      </button>

                      <button
                        onClick={() => handleReviewRating(4)}
                        className="py-2.5 px-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                      >
                        <span>Легко</span>
                        <span className="text-[10px] opacity-70">7+ дн.</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsFlipped(true)}
                      className="w-full py-3 rounded-xl bg-primary hover:bg-primaryGlow text-white text-xs font-semibold transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCw size={14} /> Показать ответ (Пробел)
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: All Flashcards List */}
          {activeTab === 'all' && (
            <div className="flex-1 flex flex-col gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по флешкартам..."
                className="w-full p-2.5 bg-black/40 border border-borderColor rounded-xl text-xs text-textMain outline-none focus:border-primary"
              />

              {filteredCards.length === 0 ? (
                <div className="py-12 text-center text-xs text-textMuted">
                  {bookCards.length === 0 
                    ? 'У вас пока нет созданных карточек. Создайте первую или конвертируйте из хайлайта в Заметках!' 
                    : 'Ничего не найдено по вашему запросу.'}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredCards.map((card) => (
                    <div 
                      key={card.id}
                      className="p-3.5 rounded-xl bg-bgCard border border-borderColor hover:border-white/20 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold text-xs text-white leading-relaxed">
                          {card.front}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCardId(card.id);
                              setFrontText(card.front);
                              setBackText(card.back);
                              setActiveTab('create');
                            }}
                            className="p-1 rounded text-textDim hover:text-white hover:bg-white/10 transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendToAnki([card])}
                            disabled={ankiSending}
                            className="p-1 rounded text-textDim hover:text-primaryGlow hover:bg-primary/10 transition-colors"
                            title="В Anki"
                          >
                            <Send size={12} />
                          </button>
                          <button
                            onClick={() => deleteFlashcard(currentBookId, card.id)}
                            className="p-1 rounded text-textDim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-textMuted leading-relaxed pl-2 border-l-2 border-primary/40">
                        {card.back}
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-[10px] text-textDim font-mono">
                        <span>Повторений: {card.repetitions || 0}</span>
                        <span>•</span>
                        <span>Интервал: {card.interval || 1} дн.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Create / Edit Card */}
          {activeTab === 'create' && (
            <div className="flex-1 flex flex-col gap-3 max-w-lg mx-auto w-full">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-textMain">Вопрос (Лицевая сторона):</label>
                <textarea
                  value={frontText}
                  onChange={(e) => setFrontText(e.target.value)}
                  placeholder="Вопрос или ключевая мысль, например: В чем главная идея этой концепции?"
                  rows={3}
                  className="w-full bg-black/40 border border-borderColor rounded-xl p-3 text-xs text-textMain outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-textMain">Ответ (Оборот):</label>
                  <button
                    disabled={isAiGenerating || (!frontText && !backText)}
                    onClick={handleAiGenerateCard}
                    className="text-[11px] text-primaryGlow hover:text-white flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {isAiGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    <span>ИИ сформулировать</span>
                  </button>
                </div>
                <textarea
                  value={backText}
                  onChange={(e) => setBackText(e.target.value)}
                  placeholder="Краткий и точный ответ..."
                  rows={4}
                  className="w-full bg-black/40 border border-borderColor rounded-xl p-3 text-xs text-textMain outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className="px-3 py-1.5 rounded-lg text-xs text-textDim hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  disabled={!frontText.trim() || !backText.trim()}
                  onClick={handleSaveCard}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primaryGlow disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  {editingCardId ? 'Сохранить изменения' : 'Создать флешкарту'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
