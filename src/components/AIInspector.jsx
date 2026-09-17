import React, { useState, useEffect } from 'react';
import { useStore, DEFAULT_PROMPTS } from '../store/useStore';
import { Lightbulb, Network, FileText, Maximize2, Trash2, Loader2, Sparkles } from 'lucide-react';
import mermaid from 'mermaid';
import DiagramModal from './DiagramModal';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#fff',
    primaryBorderColor: '#818cf8',
    lineColor: '#06b6d4',
    secondaryColor: '#1e1e2d',
    tertiaryColor: '#121620'
  }
});

const LANGUAGE_NAMES = {
  ru: 'Russian (на русском языке)',
  en: 'English',
  de: 'German (auf Deutsch)',
  es: 'Spanish (en español)',
  fr: 'French (en français)',
  zh: 'Chinese (用中文)'
};

export default function AIInspector() {
  const { apiKey, model, language, prompts, setSettingsOpen } = useStore();
  const [selectedText, setSelectedText] = useState('');
  const [cards, setCards] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ddia_saved_cards') || '[]');
    } catch {
      return [];
    }
  });

  const [fullscreenDiagram, setFullscreenDiagram] = useState({ isOpen: false, svg: '', title: '' });

  // Sync cards with localStorage
  useEffect(() => {
    localStorage.setItem('ddia_saved_cards', JSON.stringify(cards));
  }, [cards]);

  // Selection listener (desktop mouseup + mobile touchend / selectionchange)
  useEffect(() => {
    let timer = null;
    const updateSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 5) {
        setSelectedText(text);
      }
    };

    const handleSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(updateSelection, 200);
    };

    document.addEventListener('mouseup', updateSelection);
    document.addEventListener('touchend', updateSelection);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseup', updateSelection);
      document.removeEventListener('touchend', updateSelection);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const triggerAI = async (type) => {
    if (!selectedText) return;

    if (!apiKey) {
      setSettingsOpen(true);
      alert('Пожалуйста, укажите ваш API-ключ OpenRouter в настройках.');
      return;
    }

    const cardId = 'card_' + Date.now();
    const newCard = {
      id: cardId,
      type,
      quote: selectedText,
      loading: true,
      content: '',
      svg: null
    };

    setCards(prev => [newCard, ...prev]);

    // Use customized prompt and selected language
    const basePrompt = prompts?.[type] || DEFAULT_PROMPTS[type];
    const targetLang = LANGUAGE_NAMES[language] || 'Russian';

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'diagram') {
      systemPrompt = `${basePrompt}\nLanguage instruction: Node labels and text inside the diagram must be in ${targetLang}.`;
      userPrompt = `Generate a Mermaid diagram for this excerpt:\n\n"${selectedText}"`;
    } else if (type === 'analogy') {
      systemPrompt = `${basePrompt}\nLanguage instruction: You MUST write your entire response strictly in ${targetLang}.`;
      userPrompt = `Explain this excerpt with a simple analogy:\n\n"${selectedText}"`;
    } else if (type === 'summary') {
      systemPrompt = `${basePrompt}\nLanguage instruction: You MUST write your entire response strictly in ${targetLang}.`;
      userPrompt = `Summarize the key takeaways (3 points):\n\n"${selectedText}"`;
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Visual Reader React'
        },
        body: JSON.stringify({
          model: model || 'openrouter/free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const rawOutput = data.choices?.[0]?.message?.content || 'Нет ответа от модели';

      let renderedSvg = null;
      if (type === 'diagram') {
        const cleanCode = rawOutput.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
        try {
          const { svg } = await mermaid.render('mermaid_' + cardId, cleanCode);
          renderedSvg = svg;
        } catch (mErr) {
          console.error('Mermaid render error:', mErr);
        }
      }

      setCards(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, loading: false, content: rawOutput, svg: renderedSvg };
        }
        return c;
      }));
    } catch (err) {
      setCards(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, loading: false, content: `Ошибка: ${err.message}` };
        }
        return c;
      }));
    }
  };

  const removeCard = (id) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const [customText, setCustomText] = useState('');
  const [showInput, setShowInput] = useState(false);

  return (
    <aside className="w-full md:w-[450px] bg-bgSidebar md:border-l border-borderColor flex flex-col shrink-0 h-full pb-16 md:pb-0">
      {/* Header */}
      <div className="h-14 border-b border-borderColor flex items-center justify-between px-4 shrink-0 font-semibold text-sm">
        <div className="flex items-center gap-2 text-white">
          <Network size={16} className="text-primaryGlow" />
          Визуальный инспектор
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInput(!showInput)}
            className="text-xs text-primaryGlow hover:text-white transition-colors bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded"
          >
            {showInput ? 'Скрыть ввод' : '+ Свой текст'}
          </button>
          {cards.length > 0 && (
            <button 
              onClick={() => setCards([])}
              className="text-xs text-textDim hover:text-red-400 transition-colors"
            >
              Очистить все
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 overflow-y-auto relative custom-scrollbar flex flex-col gap-4">
        {/* Custom text input box */}
        {showInput && (
          <div className="p-3 rounded-xl bg-bgCard border border-primary/30 flex flex-col gap-2">
            <div className="text-xs font-semibold text-textMain">Введите текст или концепт:</div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Вставьте термин, алгоритм или фрагмент текста..."
              rows={3}
              className="w-full bg-black/40 border border-borderColor rounded-lg p-2.5 text-xs text-textMain outline-none focus:border-primary resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                disabled={!customText.trim()}
                onClick={() => {
                  setSelectedText(customText.trim());
                  setShowInput(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primaryGlow disabled:opacity-40 text-white text-xs font-semibold transition-all"
              >
                Применить для анализа
              </button>
            </div>
          </div>
        )}

        {/* Selected text prompt action panel */}
        {selectedText && (
          <div className="p-4 rounded-xl bg-bgCard border border-primary/30 shadow-lg shadow-primary/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primaryGlow uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} /> Выделенный фрагмент:
              </span>
              <button 
                onClick={() => setSelectedText('')}
                className="text-xs text-textDim hover:text-textMuted p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs italic text-textMuted border-l-2 border-primary/50 pl-3 py-1 max-h-28 overflow-y-auto custom-scrollbar">
              "{selectedText}"
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button 
                onClick={() => triggerAI('diagram')}
                className="w-full py-2.5 px-3 rounded-lg bg-primary hover:bg-primaryGlow text-white text-xs font-semibold transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Network size={14} /> 📊 Визуализировать архитектуру
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => triggerAI('analogy')}
                  className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-textMain border border-borderColor text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lightbulb size={13} className="text-yellow-400" /> Аналогия
                </button>
                <button 
                  onClick={() => triggerAI('summary')}
                  className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-textMain border border-borderColor text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText size={13} className="text-accentCyan" /> Резюме
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedText && cards.length === 0 && !showInput && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto opacity-70">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
              <Lightbulb size={24} />
            </div>
            <h3 className="font-semibold text-base text-white mb-1">Визуализация и Пояснения</h3>
            <p className="text-xs text-textMuted max-w-xs leading-relaxed mb-4">
              Выделите фрагмент текста в книге или нажмите кнопку "+ Свой текст" выше, чтобы сгенерировать архитектурную схему или аналогию.
            </p>
            <button
              onClick={() => setShowInput(true)}
              className="px-3.5 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primaryGlow text-xs font-medium hover:bg-primary/30 transition-all"
            >
              Ввести фрагмент вручную
            </button>
          </div>
        )}

        {/* Generated Cards */}
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="p-4 rounded-xl bg-bgCard border border-borderColor flex flex-col gap-3 shadow-md"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-primaryGlow uppercase tracking-wider flex items-center gap-1.5">
                {card.type === 'diagram' && '📊 Диаграмма'}
                {card.type === 'analogy' && '💡 Аналогия'}
                {card.type === 'summary' && '📝 Резюме'}
              </span>
              <div className="flex items-center gap-1">
                {card.svg && (
                  <button 
                    onClick={() => setFullscreenDiagram({ isOpen: true, svg: card.svg, title: card.quote })}
                    title="На весь экран"
                    className="p-1 rounded hover:bg-white/10 text-textDim hover:text-white transition-colors"
                  >
                    <Maximize2 size={13} />
                  </button>
                )}
                <button 
                  onClick={() => removeCard(card.id)}
                  title="Удалить карточку"
                  className="p-1 rounded hover:bg-red-500/20 text-textDim hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="text-xs text-textDim italic line-clamp-2">
              "{card.quote}"
            </div>

            {card.loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-textMuted">
                <Loader2 className="animate-spin text-primaryGlow" size={16} />
                <span>ИИ строит ответ...</span>
              </div>
            ) : (
              <div>
                {card.type === 'diagram' && card.svg ? (
                  <div 
                    onClick={() => setFullscreenDiagram({ isOpen: true, svg: card.svg, title: card.quote })}
                    className="overflow-hidden bg-[#0a0d14] p-3 rounded-lg cursor-pointer border border-white/5 hover:border-primary/40 transition-colors flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: card.svg }}
                  />
                ) : (
                  <div className="text-xs text-textMain leading-relaxed whitespace-pre-wrap">
                    {card.content}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fullscreen Diagram Modal */}
      <DiagramModal 
        isOpen={fullscreenDiagram.isOpen}
        onClose={() => setFullscreenDiagram({ isOpen: false, svg: '', title: '' })}
        svgContent={fullscreenDiagram.svg}
        title={fullscreenDiagram.title}
      />
    </aside>
  );
}
