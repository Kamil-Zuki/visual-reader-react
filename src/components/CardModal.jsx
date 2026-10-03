import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Send, Loader2, Quote, Sparkles, ZoomIn, ZoomOut, Type } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { pushSavedAiCardToAnki } from '../services/ankiConnectService';
import { useStore } from '../store/useStore';

export default function CardModal({ isOpen, onClose, card }) {
  const { currentBook, ankiSettings } = useStore();
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState('text-sm'); // text-xs, text-sm, text-base, text-lg
  const [ankiSending, setAnkiSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;

  const handleCopy = () => {
    if (!card.content) return;
    navigator.clipboard.writeText(card.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToAnki = async () => {
    if (!card?.content && !card?.quote) return;
    setAnkiSending(true);
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
      setAnkiSending(false);
    }
  };

  const cycleFontSize = () => {
    const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg'];
    const idx = sizes.indexOf(fontSize);
    const nextIdx = (idx + 1) % sizes.length;
    setFontSize(sizes[nextIdx]);
  };

  const cardTitle =
    card.title ||
    (card.type === 'diagram'
      ? '📊 Диаграмма'
      : card.type === 'analogy'
      ? '💡 Аналогия'
      : card.type === 'summary'
      ? '📝 Резюме'
      : '⚡ Ответ ИИ');

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-borderColor bg-bgSidebar shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primaryGlow shrink-0">
              <Sparkles size={16} />
            </div>
            <span className="font-semibold text-white text-base sm:text-lg truncate">
              {cardTitle}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Font size toggle */}
            <button
              type="button"
              onClick={cycleFontSize}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textDim hover:text-white transition-colors flex items-center gap-1 text-xs cursor-pointer"
              title="Изменить размер шрифта"
            >
              <Type size={14} />
              <span className="hidden sm:inline uppercase text-[10px]">
                {fontSize === 'text-xs' ? 'XS' : fontSize === 'text-sm' ? 'S' : fontSize === 'text-base' ? 'M' : 'L'}
              </span>
            </button>

            {/* Anki Send */}
            {card.content && (
              <button
                type="button"
                onClick={handleSendToAnki}
                disabled={ankiSending}
                className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 text-textDim hover:text-primaryGlow transition-colors cursor-pointer"
                title="Отправить в Anki"
              >
                {ankiSending ? (
                  <Loader2 size={15} className="animate-spin text-primaryGlow" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            )}

            {/* Copy Button */}
            {card.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-textMain hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Скопировать весь ответ"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-accentEmerald" />
                    <span className="text-accentEmerald hidden sm:inline">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="hidden sm:inline">Копировать</span>
                  </>
                )}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors cursor-pointer ml-1"
              title="Закрыть (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area with scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar space-y-5 bg-bgMain/40">
          {/* Quote Block if available */}
          {card.quote && (
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 flex items-start gap-3">
              <Quote size={18} className="text-primaryGlow shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-textMuted italic leading-relaxed">
                «{card.quote}»
              </div>
            </div>
          )}

          {/* SVG Diagram or Markdown Body */}
          {card.svg ? (
            <div className="w-full flex items-center justify-center p-4 bg-black/40 rounded-xl border border-white/5 [&_svg]:max-w-full [&_svg]:h-auto overflow-x-auto">
              <div dangerouslySetInnerHTML={{ __html: card.svg }} />
            </div>
          ) : (
            <div className={`${fontSize} leading-relaxed`}>
              <MarkdownRenderer content={card.content} className="space-y-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
