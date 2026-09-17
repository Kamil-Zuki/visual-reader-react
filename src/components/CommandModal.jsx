import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, HelpCircle } from 'lucide-react';

const SUGGESTED_ICONS = ['🎯', '💡', '📝', '⚠️', '🧸', '🔍', '🚀', '💻', '🧠', '⚡', '❓', '🧪', '📊', '🛡️', '📚'];

export default function CommandModal({ isOpen, onClose, onSave, editingCommand = null }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [type, setType] = useState('text'); // 'text' | 'diagram'
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingCommand) {
        setTitle(editingCommand.title || '');
        setIcon(editingCommand.icon || '🎯');
        setType(editingCommand.type || 'text');
        setPrompt(editingCommand.prompt || '');
      } else {
        setTitle('');
        setIcon('🎯');
        setType('text');
        setPrompt('');
      }
    }
  }, [isOpen, editingCommand]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    onSave({
      id: editingCommand?.id || 'cmd_' + Date.now(),
      title: title.trim(),
      icon: icon || '✨',
      type,
      prompt: prompt.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-md shadow-2xl p-5 relative flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="text-primaryGlow" size={18} />
            {editingCommand ? 'Редактировать команду' : 'Создать свою команду'}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title & Icon */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Иконка</label>
              <input
                type="text"
                value={icon}
                maxLength={4}
                onChange={(e) => setIcon(e.target.value)}
                className="w-14 h-10 text-center text-xl bg-black/40 border border-borderColor rounded-lg focus:border-primary outline-none"
              />
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Название команды</label>
              <input
                type="text"
                required
                placeholder="напр. Вопросы к интервью"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 bg-black/40 border border-borderColor rounded-lg px-3 text-sm text-white focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Quick icon picker */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-textDim mr-1">Быстрый выбор:</span>
            {SUGGESTED_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition-transform hover:scale-110 ${
                  icon === emoji ? 'bg-primary/30 border border-primary/50' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Type Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Формат результата</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('text')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  type === 'text' 
                    ? 'border-primary bg-primary/20 text-white shadow-sm' 
                    : 'border-borderColor bg-black/30 text-textMuted hover:text-white'
                }`}
              >
                📝 Текст / Ответ
              </button>
              <button
                type="button"
                onClick={() => setType('diagram')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  type === 'diagram' 
                    ? 'border-primary bg-primary/20 text-white shadow-sm' 
                    : 'border-borderColor bg-black/30 text-textMuted hover:text-white'
                }`}
              >
                📊 Схема (Mermaid)
              </button>
            </div>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Инструкция / Промпт для ИИ</label>
              <span className="text-[10px] text-textDim flex items-center gap-1">
                <HelpCircle size={10} /> Текст книги передается автоматически
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Напишите, что именно должна сделать модель с выделенным фрагментом..."
              className="w-full bg-black/50 border border-borderColor rounded-lg p-3 text-xs text-textMain focus:border-primary outline-none custom-scrollbar leading-relaxed resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-borderColor">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primaryGlow text-white shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} /> Сохранить команду
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
