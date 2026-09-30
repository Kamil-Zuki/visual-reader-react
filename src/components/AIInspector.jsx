import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Lightbulb, Network, FileText, Maximize2, Trash2, Loader2,
  Sparkles, Plus, Edit2, PanelRightClose, MessageSquare, Send,
  Bot, User, Copy, Check, Quote, BookOpen, HelpCircle,
} from 'lucide-react';
import { pushSavedAiCardToAnki } from '../services/ankiConnectService';
import mermaid from 'mermaid';
import DiagramModal from './DiagramModal';
import CommandModal from './CommandModal';
import { stripHtml } from '../utils/searchIndex';

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

const CHAT_PROMPT_SUGGESTIONS = [
  { label: '💡 Объясни просто (ELI5)', prompt: 'Объясни ключевую идею этого раздела простыми словами, понятными новичку, используя наглядную аналогию.' },
  { label: '⚠️ Риски и компромиссы', prompt: 'Какие главные архитектурные компромиссы, ограничения и подводные камни описаны в этом разделе?' },
  { label: '🎯 Задай вопрос для проверки', prompt: 'Сформулируй 2 сложных концептуальных вопроса по этому разделу, чтобы проверить, насколько хорошо я усвоил материал.' },
  { label: '🛠 Пример из практики', prompt: 'Приведи реальный пример из современной разработки (например, в микросервисах или распределенных БД), где применяется эта концепция.' }
];

function renderInline(text) {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-white/10 text-primaryGlow font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

function FormattedMessage({ content }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-xs leading-relaxed space-y-2 break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const isLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = isLang ? firstLine : '';
          const code = (isLang ? lines.slice(1) : lines).join('\n');

          return (
            <div key={index} className="my-2 rounded-lg bg-black/60 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5 text-[11px] text-textDim">
                <span>{lang || 'код'}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} /> <span>Копировать</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-primaryGlow overflow-x-auto custom-scrollbar">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = part.split(/\n\n+/);
        return paragraphs.map((para, pIdx) => {
          if (!para.trim()) return null;

          if (para.startsWith('### ')) {
            return <h4 key={`${index}_${pIdx}`} className="font-semibold text-white text-xs pt-1">{para.slice(4)}</h4>;
          }
          if (para.startsWith('## ')) {
            return <h3 key={`${index}_${pIdx}`} className="font-bold text-white text-sm pt-1">{para.slice(3)}</h3>;
          }
          if (para.startsWith('# ')) {
            return <h2 key={`${index}_${pIdx}`} className="font-bold text-primaryGlow text-sm pt-1">{para.slice(2)}</h2>;
          }

          const lines = para.split('\n');
          const isList = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || /^\d+\.\s/.test(l.trim()));
          if (isList) {
            return (
              <ul key={`${index}_${pIdx}`} className="list-disc list-inside space-y-1 pl-1">
                {lines.map((l, lIdx) => (
                  <li key={lIdx} className="text-textMain">
                    {renderInline(l.replace(/^[-*]\s+|\d+\.\s+/, ''))}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={`${index}_${pIdx}`} className="text-textMain">
              {renderInline(para)}
            </p>
          );
        });
      })}
    </div>
  );
}

export default function AIInspector() {
  const { 
    apiKey, model, language, prompts, setSettingsOpen,
    customCommands, addCustomCommand, updateCustomCommand, deleteCustomCommand,
    inspectorWidth, setInspectorOpen,
    currentBook, currentBookId, activeChapterIdx, activeSectionIdx,
    highlights,
    aiInspectorTab, setAiInspectorTab,
    chatHistories, addChatMessage, clearChatHistory,
    savedCards, addSavedCard, deleteSavedCard, clearSavedCards, updateSavedCard,
    epubReaderText,
    ankiSettings,
  } = useStore();
  
  const [fullscreenDiagram, setFullscreenDiagram] = useState({ isOpen: false, svg: '', title: '' });
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);

  // Chat-specific local states
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  // Context derived from current book state
  const chapters = currentBook?.chapters || currentBook?.structure || [];
  const currentChapter = chapters[activeChapterIdx];
  const currentSection = currentChapter?.sections?.[activeSectionIdx];
  const sectionTitle = currentSection?.title || 'Раздел';
  const chapterTitle = currentChapter?.title || 'Глава';
  const rawHtml = currentSection?.html || currentSection?.content || '';
  const currentSectionText =
    currentBook?.format === 'epub'
      ? (epubReaderText || '').trim()
      : stripHtml(rawHtml);

  const secHighlights = (highlights[currentBookId] || []).filter(
    h => h.chapterIdx === activeChapterIdx && h.sectionIdx === activeSectionIdx
  );

  const chatKey = `${currentBookId}_${activeChapterIdx}_${activeSectionIdx}`;
  const currentChat = chatHistories[chatKey] || [];

  const [selectedText, setSelectedText] = useState('');

  // Scroll chat to bottom when new messages arrive or loading changes
  useEffect(() => {
    if (aiInspectorTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentChat, isChatLoading, aiInspectorTab]);

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

  // AI Card generator (Diagrams, Analogies, Summaries, Custom commands)
  const triggerAI = async (type, customCmd = null) => {
    if (!selectedText) return;

    if (!apiKey) {
      setSettingsOpen(true);
      alert('Пожалуйста, укажите ваш API-ключ OpenRouter в настройках.');
      return;
    }

    const isDiagram = customCmd ? customCmd.type === 'diagram' : type === 'diagram';
    const cardTitle = customCmd ? `${customCmd.icon} ${customCmd.title}` : null;

    const cardId = 'card_' + Date.now();
    const newCard = {
      id: cardId,
      type,
      title: cardTitle,
      isDiagram,
      quote: selectedText,
      loading: true,
      content: '',
      svg: null,
      chapterIdx: activeChapterIdx,
      sectionIdx: activeSectionIdx,
      sectionTitle: currentSection?.title || '',
      createdAt: Date.now()
    };

    addSavedCard(newCard);

    const targetLang = LANGUAGE_NAMES[language] || 'Russian';
    let systemPrompt = '';
    let userPrompt = '';

    if (customCmd) {
      if (isDiagram) {
        const baseDiagramPrompt = prompts?.diagram || '';
        systemPrompt = `${baseDiagramPrompt}\n\nTask: ${customCmd.prompt}\nLanguage note: Node labels and text inside the diagram should be in ${targetLang} unless specified otherwise in the task.`;
        userPrompt = `Generate a Mermaid diagram for this excerpt:\n\n"${selectedText}"`;
      } else {
        systemPrompt = `${customCmd.prompt}\n\nLanguage note: Respond in ${targetLang} unless specified otherwise in the instruction.`;
        userPrompt = `Text excerpt:\n\n"${selectedText}"`;
      }
    } else {
      const basePrompt = prompts?.[type] || '';
      if (type === 'diagram') {
        systemPrompt = `${basePrompt}\nLanguage note: Node labels and text inside the diagram should be in ${targetLang} unless specified otherwise.`;
        userPrompt = `Generate a Mermaid diagram for this excerpt:\n\n"${selectedText}"`;
      } else if (type === 'analogy') {
        systemPrompt = `${basePrompt}\nLanguage note: Respond in ${targetLang} unless specified otherwise.`;
        userPrompt = `Explain this excerpt with a simple analogy:\n\n"${selectedText}"`;
      } else if (type === 'summary') {
        systemPrompt = `${basePrompt}\nLanguage note: Respond in ${targetLang} unless specified otherwise.`;
        userPrompt = `Summarize the key takeaways (3 points):\n\n"${selectedText}"`;
      }
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
      if (isDiagram) {
        const cleanCode = rawOutput.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
        try {
          const { svg } = await mermaid.render('mermaid_' + cardId, cleanCode);
          renderedSvg = svg;
        } catch (mErr) {
          console.error('Mermaid render error:', mErr);
        }
      }

      updateSavedCard(cardId, { loading: false, content: rawOutput, svg: renderedSvg });
    } catch (err) {
      console.error('AI Request Error:', err);
      updateSavedCard(cardId, { loading: false, content: 'Ошибка при вызове ИИ: ' + err.message });
    }
  };

  // AI Chat Tutor handler
  const handleSendChatMessage = async (textOverride = null) => {
    const textToSend = (textOverride || chatInput).trim();
    if (!textToSend || isChatLoading) return;

    if (!apiKey) {
      setSettingsOpen(true);
      alert('Пожалуйста, укажите ваш API-ключ OpenRouter в настройках.');
      return;
    }

    const userMsgId = 'msg_user_' + Date.now();
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    addChatMessage(chatKey, userMsg);
    setChatInput('');
    setIsChatLoading(true);

    const targetLang = LANGUAGE_NAMES[language] || 'Russian';

    // Construct detailed context-aware system prompt
    let systemPrompt = `You are an expert technical tutor and interactive AI mentor. The reader is studying the technical book "${currentBook?.title || 'Book'}" by ${currentBook?.author || ''}.
Current context:
- Chapter: ${chapterTitle}
- Section: ${sectionTitle}

TEXT OF CURRENT SECTION:
"""
${currentSectionText.slice(0, 12000)}
"""`;

    if (secHighlights.length > 0) {
      systemPrompt += `\n\nTHE USER HIGHLIGHTED THESE KEY PARTS IN THIS SECTION:\n` +
        secHighlights.map((h, i) => `${i + 1}. "${h.text}"${h.note ? ` (Заметка: ${h.note})` : ''}`).join('\n');
    }

    systemPrompt += `\n\nINSTRUCTIONS:
1. Provide deep, technically accurate explanations based on the section text.
2. Clarify complex algorithms, trade-offs, architecture, and edge cases.
3. Be concise, structured, and pedagogical. Use markdown formatting with bold, lists, and code blocks where helpful.
4. Answer in ${targetLang}.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...currentChat.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: textToSend }
    ];

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Visual Reader React - Chat Tutor'
        },
        body: JSON.stringify({
          model: model || 'openrouter/free',
          messages: apiMessages,
          temperature: 0.35
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const botResponse = data.choices?.[0]?.message?.content || 'Не удалось получить ответ от ИИ.';

      const botMsg = {
        id: 'msg_bot_' + Date.now(),
        role: 'assistant',
        content: botResponse,
        timestamp: Date.now()
      };

      addChatMessage(chatKey, botMsg);
    } catch (err) {
      console.error('Chat AI Error:', err);
      const errorMsg = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `⚠️ Ошибка при запросе к ИИ: ${err.message}. Проверьте ваш API-ключ в настройках.`,
        timestamp: Date.now()
      };
      addChatMessage(chatKey, errorMsg);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeCard = (id) => {
    deleteSavedCard(id);
  };

  const [customText, setCustomText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [ankiCardSendingId, setAnkiCardSendingId] = useState(null);

  const sendAiCardToAnki = async (card) => {
    if (!card?.content && !card?.quote) return;
    setAnkiCardSendingId(card.id);
    try {
      const result = await pushSavedAiCardToAnki(card, currentBook?.title, ankiSettings);
      alert(
        result.added
          ? 'Карточка добавлена в Anki.'
          : 'Anki не добавил заметку (возможно, дубликат).'
      );
    } catch (err) {
      alert(`AnkiConnect: ${err.message}`);
    } finally {
      setAnkiCardSendingId(null);
    }
  };

  const cards = savedCards;

  return (
    <aside
      style={{ '--inspector-w': `${inspectorWidth}px` }}
      className="w-full min-w-0 max-w-full overflow-hidden bg-bgSidebar md:border-l border-borderColor flex flex-col md:shrink-0 md:w-[var(--inspector-w)] h-full pb-16 md:pb-0"
    >
      {/* Header with Mode Switcher (Cards / Chat) */}
      <div className="min-h-14 border-b border-borderColor flex flex-wrap items-center justify-between gap-2 px-3 md:px-4 py-2 shrink-0 font-semibold text-sm bg-black/20">
        {/* Tab switch buttons */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 min-w-0 max-w-full overflow-x-auto">
          <button
            onClick={() => setAiInspectorTab('cards')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              aiInspectorTab === 'cards'
                ? 'bg-primary text-white shadow-sm'
                : 'text-textDim hover:text-white hover:bg-white/5'
            }`}
          >
            <Network size={13} />
            <span>Схемы</span>
            {cards.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                aiInspectorTab === 'cards' ? 'bg-white/20 text-white' : 'bg-white/10 text-textDim'
              }`}>
                {cards.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAiInspectorTab('chat')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              aiInspectorTab === 'chat'
                ? 'bg-primary text-white shadow-sm'
                : 'text-textDim hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={13} />
            <span>Чат-тьютор</span>
            {currentChat.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                aiInspectorTab === 'chat' ? 'bg-white/20 text-white' : 'bg-primary/20 text-primaryGlow font-mono'
              }`}>
                {currentChat.length}
              </span>
            )}
          </button>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {aiInspectorTab === 'cards' ? (
            <>
              <button
                onClick={() => setShowInput(!showInput)}
                className="text-xs text-primaryGlow hover:text-white transition-colors bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded cursor-pointer"
              >
                {showInput ? 'Скрыть' : '+ Текст'}
              </button>
              {cards.length > 0 && (
                <button 
                  onClick={() => clearSavedCards()}
                  className="text-xs text-textDim hover:text-red-400 transition-colors px-1 cursor-pointer"
                  title="Очистить все карточки"
                >
                  Очистить
                </button>
              )}
            </>
          ) : (
            <>
              {currentChat.length > 0 && (
                <button
                  onClick={() => clearChatHistory(chatKey)}
                  className="text-xs text-textDim hover:text-red-400 transition-colors px-1.5 py-1 flex items-center gap-1 rounded hover:bg-white/5 cursor-pointer"
                  title="Очистить диалог по текущему разделу"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Очистить</span>
                </button>
              )}
            </>
          )}

          {/* Close/collapse button on desktop */}
          <button
            onClick={() => setInspectorOpen(false)}
            className="hidden md:flex p-1 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors cursor-pointer ml-1"
            title="Скрыть панель инспектора"
          >
            <PanelRightClose size={17} />
          </button>
        </div>
      </div>

      {/* VIEW 1: Cards & Visualizer Mode */}
      {aiInspectorTab === 'cards' && (
        <div className="flex-1 min-w-0 p-3 sm:p-4 overflow-y-auto overflow-x-hidden relative custom-scrollbar flex flex-col gap-4">
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
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primaryGlow disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer"
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
                  className="text-xs text-textDim hover:text-textMuted p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs italic text-textMuted border-l-2 border-primary/50 pl-3 py-1 max-h-28 overflow-y-auto custom-scrollbar">
                "{selectedText}"
              </div>

              <div className="flex flex-col gap-2 pt-1">
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

                {/* Quick jump to chat with this selection */}
                <button
                  onClick={() => {
                    setAiInspectorTab('chat');
                    setChatInput(`Поясни подробнее этот фрагмент: "${selectedText}"`);
                    setTimeout(() => chatInputRef.current?.focus(), 80);
                  }}
                  className="py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primaryGlow border border-primary/30 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare size={13} /> Обсудить этот фрагмент в чате →
                </button>

                {/* Custom Commands Section */}
                <div className="mt-1 pt-2 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider">
                      Мои команды ({customCommands.length})
                    </span>
                    <button
                      onClick={() => {
                        setEditingCommand(null);
                        setCommandModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-[11px] text-primaryGlow hover:text-white bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> + Команда
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {customCommands.map((cmd) => (
                      <div key={cmd.id} className="group relative flex items-center">
                        <button
                          onClick={() => triggerAI(cmd.id, cmd)}
                          className="w-full py-2 pl-2.5 pr-7 rounded-lg bg-white/5 hover:bg-primary/15 hover:border-primary/40 text-textMain border border-borderColor text-xs font-medium transition-all text-left flex items-center gap-1.5 truncate cursor-pointer shadow-sm"
                          title={cmd.prompt}
                        >
                          <span className="text-sm shrink-0">{cmd.icon || '⚡'}</span>
                          <span className="truncate">{cmd.title}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCommand(cmd);
                            setCommandModalOpen(true);
                          }}
                          title="Редактировать команду"
                          className="absolute right-1.5 p-1 rounded hover:bg-white/20 text-textDim hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
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
                Выделите фрагмент текста в книге или переключитесь в <strong>Чат-тьютор</strong> для интерактивного диалога по разделу.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInput(true)}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primaryGlow text-xs font-medium hover:bg-primary/30 transition-all cursor-pointer"
                >
                  Ввести фрагмент вручную
                </button>
                <button
                  onClick={() => setAiInspectorTab('chat')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-borderColor text-textMain text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare size={13} /> Открыть чат
                </button>
              </div>
            </div>
          )}

          {/* Generated Cards */}
          {cards.map((card) => (
            <div
              key={card.id}
              className="p-4 rounded-xl bg-bgCard border border-borderColor flex flex-col gap-3 shadow-md min-w-0 max-w-full overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-semibold text-primaryGlow uppercase tracking-wider flex items-center gap-1.5">
                  {card.title || (
                    card.type === 'diagram' ? '📊 Диаграмма' : 
                    card.type === 'analogy' ? '💡 Аналогия' : 
                    card.type === 'summary' ? '📝 Резюме' : '⚡ Ответ ИИ'
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {!card.loading && card.content && (
                    <button
                      type="button"
                      onClick={() => sendAiCardToAnki(card)}
                      disabled={ankiCardSendingId === card.id}
                      title="Отправить в Anki"
                      className="p-1 rounded hover:bg-primary/15 text-textDim hover:text-primaryGlow transition-colors cursor-pointer"
                    >
                      {ankiCardSendingId === card.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                    </button>
                  )}
                  {card.svg && (
                    <button 
                      onClick={() => setFullscreenDiagram({ isOpen: true, svg: card.svg, title: card.quote })}
                      title="На весь экран"
                      className="p-1 rounded hover:bg-white/10 text-textDim hover:text-white transition-colors cursor-pointer"
                    >
                      <Maximize2 size={13} />
                    </button>
                  )}
                  <button 
                    onClick={() => removeCard(card.id)}
                    title="Удалить карточку"
                    className="p-1 rounded hover:bg-red-500/20 text-textDim hover:text-red-400 transition-colors cursor-pointer"
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
                  {(card.isDiagram || card.type === 'diagram') && card.svg ? (
                    <div 
                      onClick={() => setFullscreenDiagram({ isOpen: true, svg: card.svg, title: card.quote })}
                      className="relative overflow-hidden bg-[#0a0d14] p-3 rounded-lg cursor-pointer border border-white/5 hover:border-primary/40 transition-colors flex items-center justify-center max-h-72 group/diag"
                    >
                      <div 
                        className="w-full flex items-center justify-center pointer-events-none [&_svg]:max-w-full [&_svg]:h-auto"
                        dangerouslySetInnerHTML={{ __html: card.svg }} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/diag:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-[11px] bg-primary/90 text-white font-medium px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-sm">
                          <Maximize2 size={12} /> На весь экран (интерактивно)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-textMain leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">
                      {card.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VIEW 2: AI Chat Tutor Mode */}
      {aiInspectorTab === 'chat' && (
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-bgMain/30">
          {/* Section Context Pill Banner */}
          <div className="px-3.5 py-2.5 bg-black/40 border-b border-borderColor flex flex-col gap-1 shrink-0">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-textDim min-w-0 flex-1 truncate">
                <BookOpen size={12} className="text-primaryGlow shrink-0" />
                <span className="truncate">{chapterTitle}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-accentEmerald">
                <span className="w-1.5 h-1.5 rounded-full bg-accentEmerald animate-pulse"></span>
                <span>Контекст активен</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white truncate min-w-0 flex-1">
                {sectionTitle}
              </span>
              {secHighlights.length > 0 && (
                <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  {secHighlights.length} {secHighlights.length === 1 ? 'хайлайт' : 'хайлайта'}
                </span>
              )}
            </div>
          </div>

          {/* Quick quote action if text selected in reader */}
          {selectedText && (
            <div className="mx-3 mt-2 p-2 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-primaryGlow truncate flex items-center gap-1">
                <Quote size={12} className="shrink-0" />
                <span className="truncate">"{selectedText.slice(0, 50)}..."</span>
              </div>
              <button
                onClick={() => {
                  setChatInput(`Поясни этот фрагмент: "${selectedText}"\n`);
                  setSelectedText('');
                  chatInputRef.current?.focus();
                }}
                className="text-[10px] bg-primary hover:bg-primaryGlow text-white px-2 py-1 rounded font-medium shrink-0 transition-colors cursor-pointer"
              >
                Вставить в вопрос
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar flex flex-col gap-3">
            {/* Empty state: welcome & suggestion chips */}
            {currentChat.length === 0 && (
              <div className="flex-1 flex flex-col justify-center items-center text-center my-auto py-6">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-accentPurple flex items-center justify-center text-white mb-3 shadow-lg shadow-primary/20">
                  <Bot size={22} />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">ИИ-тьютор по разделу</h4>
                <p className="text-xs text-textMuted max-w-xs leading-relaxed mb-4">
                  Задавайте любые вопросы по текущему параграфу: разбор алгоритмов, поиск неочевидных связей или сложные нюансы реализации.
                </p>

                {/* Prompt suggestions */}
                <div className="w-full flex flex-col gap-2 pt-2">
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-textDim text-left pl-1">
                    Быстрые вопросы:
                  </div>
                  {CHAT_PROMPT_SUGGESTIONS.map((item, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSendChatMessage(item.prompt)}
                      className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-primary/15 border border-white/10 hover:border-primary/40 text-xs text-textMain hover:text-white transition-all flex items-start gap-2 cursor-pointer group"
                    >
                      <span className="shrink-0 group-hover:scale-110 transition-transform">
                        {item.label.split(' ')[0]}
                      </span>
                      <span className="line-clamp-2">
                        {item.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {currentChat.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[90%] sm:max-w-[85%] ${
                    isUser ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-textDim px-1">
                    {isUser ? (
                      <>
                        <span>Вы</span>
                        <User size={11} className="text-primaryGlow" />
                      </>
                    ) : (
                      <>
                        <Bot size={11} className="text-primaryGlow" />
                        <span>ИИ-тьютор</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`p-3 rounded-2xl border transition-all ${
                      isUser
                        ? 'bg-primary/20 border-primary/40 text-white rounded-br-sm shadow-sm'
                        : 'bg-bgCard/90 border-borderColor text-textMain rounded-bl-sm shadow-md'
                    }`}
                  >
                    {isUser ? (
                      <div className="text-xs leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <FormattedMessage content={msg.content} />
                    )}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-2 pl-1">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="text-[10px] text-textDim hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Скопировать ответ"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={11} className="text-accentEmerald" />
                            <span className="text-accentEmerald">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator bubble */}
            {isChatLoading && (
              <div className="flex flex-col gap-1 mr-auto items-start max-w-[85%]">
                <div className="flex items-center gap-1.5 text-[10px] text-textDim px-1">
                  <Bot size={11} className="text-primaryGlow" />
                  <span>ИИ-тьютор</span>
                </div>
                <div className="p-3.5 rounded-2xl rounded-bl-sm bg-bgCard/90 border border-borderColor flex items-center gap-2.5 text-xs text-textMuted shadow-md">
                  <Loader2 size={15} className="animate-spin text-primaryGlow" />
                  <span>Анализирую контекст раздела и формирую ответ...</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-3 bg-black/50 border-t border-borderColor shrink-0 flex flex-col gap-2">
            <div className="flex items-end gap-2 bg-bgCard border border-borderColor focus-within:border-primary rounded-xl p-2 transition-colors">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder="Спросите о концепциях или формулах этого раздела..."
                rows={2}
                disabled={isChatLoading}
                className="flex-1 bg-transparent text-xs text-textMain placeholder:text-textDim outline-none resize-none custom-scrollbar max-h-32"
              />
              <button
                disabled={!chatInput.trim() || isChatLoading}
                onClick={() => handleSendChatMessage()}
                className="p-2 rounded-lg bg-primary hover:bg-primaryGlow disabled:opacity-40 disabled:hover:bg-primary text-white transition-all shadow-md shadow-primary/20 shrink-0 cursor-pointer"
                title="Отправить (Enter)"
              >
                <Send size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-textDim px-1">
              <span>Shift+Enter для новой строки</span>
              <span className="text-primaryGlow/70 truncate max-w-[180px]">Модель: {model || 'openrouter/free'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Diagram Modal */}
      <DiagramModal 
        isOpen={fullscreenDiagram.isOpen}
        onClose={() => setFullscreenDiagram({ isOpen: false, svg: '', title: '' })}
        svgContent={fullscreenDiagram.svg}
        title={fullscreenDiagram.title}
      />

      {/* Create / Edit Custom Command Modal */}
      <CommandModal
        isOpen={commandModalOpen}
        onClose={() => {
          setCommandModalOpen(false);
          setEditingCommand(null);
        }}
        editingCommand={editingCommand}
        onSave={(cmd) => {
          if (editingCommand) {
            updateCustomCommand(editingCommand.id, cmd);
          } else {
            addCustomCommand(cmd);
          }
        }}
      />
    </aside>
  );
}
