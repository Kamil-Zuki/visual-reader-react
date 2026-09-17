import React, { useState, useEffect } from 'react';
import { useStore, DEFAULT_PROMPTS } from '../store/useStore';
import { X, Key, Cpu, Sparkles, Globe, MessageSquareCode, RotateCcw, Check } from 'lucide-react';

export default function SettingsModal() {
  const { 
    isSettingsOpen, setSettingsOpen, 
    apiKey, setApiKey, 
    model, setModel,
    language, setLanguage,
    prompts, setPrompts, resetPrompts
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'prompts'
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(model);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [localPrompts, setLocalPrompts] = useState(prompts);
  const [activePromptTab, setActivePromptTab] = useState('diagram'); // 'diagram' | 'analogy' | 'summary'

  const [modelsList, setModelsList] = useState({ free: [], paid: [] });
  const [loadingModels, setLoadingModels] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalApiKey(apiKey);
      setLocalModel(model || 'openrouter/free');
      setLocalLanguage(language || 'ru');
      setLocalPrompts(prompts);
      setSavedSuccess(false);
      loadModels();
    }
  }, [isSettingsOpen]);

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();
      if (data && data.data) {
        const free = data.data.filter(m => m.id.endsWith(':free') || m.id === 'openrouter/free');
        const paid = data.data.filter(m => !m.id.endsWith(':free') && m.id !== 'openrouter/free');
        setModelsList({ free, paid });
      }
    } catch (err) {
      console.error('Failed to load OpenRouter models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    setApiKey(localApiKey.trim());
    setModel(localModel || 'openrouter/free');
    setLanguage(localLanguage);
    setPrompts(localPrompts);
    setSavedSuccess(true);
    setTimeout(() => {
      setSettingsOpen(false);
    }, 400);
  };

  const handleResetPrompts = () => {
    if (window.confirm('Сбросить все промпты к начальным настройкам?')) {
      resetPrompts();
      setLocalPrompts({ ...DEFAULT_PROMPTS });
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-bgSidebar border border-borderColor rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col gap-5 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Cpu className="text-primary" size={20} />
            Настройки ИИ и Читалки
          </div>
          <button 
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-black/30 p-1 rounded-lg border border-borderColor">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'general' ? 'bg-primary text-white shadow-md' : 'text-textMuted hover:text-white'
            }`}
          >
            <Cpu size={14} /> Основные (Ключ, Модель, Язык)
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'prompts' ? 'bg-primary text-white shadow-md' : 'text-textMuted hover:text-white'
            }`}
          >
            <MessageSquareCode size={14} /> Промпты ИИ
          </button>
        </div>

        {/* Tab 1: General Settings */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-textMain flex items-center gap-1.5 uppercase tracking-wider">
                <Key size={13} className="text-primaryGlow" /> API-ключ OpenRouter
              </label>
              <input 
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-black/40 border border-borderColor rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-primary outline-none transition-colors"
              />
              <span className="text-[11px] text-textDim">
                Ключ сохраняется в локальной памяти браузера. Получить можно бесплатно на{' '}
                <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primaryGlow hover:underline">
                  openrouter.ai
                </a>.
              </span>
            </div>

            {/* Model Select */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-textMain flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={13} className="text-accentEmerald" /> Модель ИИ
                </label>
                {loadingModels && (
                  <span className="text-[11px] text-accentEmerald animate-pulse">Загрузка каталога моделей...</span>
                )}
              </div>

              <select
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="w-full bg-black/40 border border-borderColor rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-primary outline-none transition-colors"
              >
                <optgroup label="⚡ Автоматические (OpenRouter)" className="bg-[#1a1f2e] text-[#818cf8]">
                  <option value="openrouter/free" className="bg-[#1a1f2e] text-white">
                    OpenRouter Free (динамический выбор)
                  </option>
                </optgroup>

                {modelsList.free.length > 0 && (
                  <optgroup label="Бесплатные модели (Free Tier)" className="bg-[#1a1f2e] text-[#818cf8]">
                    {modelsList.free.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#1a1f2e] text-white">
                        {m.name || m.id} (Free)
                      </option>
                    ))}
                  </optgroup>
                )}

                {modelsList.paid.length > 0 && (
                  <optgroup label="Все остальные модели" className="bg-[#1a1f2e] text-[#818cf8]">
                    {modelsList.paid.slice(0, 100).map(m => (
                      <option key={m.id} value={m.id} className="bg-[#1a1f2e] text-white">
                        {m.name || m.id}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Language Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-textMain flex items-center gap-1.5 uppercase tracking-wider">
                <Globe size={13} className="text-accentCyan" /> Язык ответов ИИ
              </label>
              <select
                value={localLanguage}
                onChange={(e) => setLocalLanguage(e.target.value)}
                className="w-full bg-black/40 border border-borderColor rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-primary outline-none transition-colors"
              >
                <option value="ru" className="bg-[#1a1f2e] text-white">Русский (Russian)</option>
                <option value="en" className="bg-[#1a1f2e] text-white">English (Английский)</option>
                <option value="de" className="bg-[#1a1f2e] text-white">Deutsch (Немецкий)</option>
                <option value="es" className="bg-[#1a1f2e] text-white">Español (Испанский)</option>
                <option value="fr" className="bg-[#1a1f2e] text-white">Français (Французский)</option>
                <option value="zh" className="bg-[#1a1f2e] text-white">中文 (Китайский)</option>
              </select>
              <span className="text-[11px] text-textDim">
                На этом языке ИИ будет составлять объяснения, аналогии и краткие тезисы.
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Prompts */}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
            <div className="flex justify-between items-center">
              <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-borderColor">
                <button
                  onClick={() => setActivePromptTab('diagram')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                    activePromptTab === 'diagram' ? 'bg-primary/30 text-primaryGlow border border-primary/40' : 'text-textMuted hover:text-white'
                  }`}
                >
                  📊 Диаграммы
                </button>
                <button
                  onClick={() => setActivePromptTab('analogy')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                    activePromptTab === 'analogy' ? 'bg-primary/30 text-primaryGlow border border-primary/40' : 'text-textMuted hover:text-white'
                  }`}
                >
                  💡 Аналогии
                </button>
                <button
                  onClick={() => setActivePromptTab('summary')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                    activePromptTab === 'summary' ? 'bg-primary/30 text-primaryGlow border border-primary/40' : 'text-textMuted hover:text-white'
                  }`}
                >
                  📝 Резюме
                </button>
              </div>

              <button
                onClick={handleResetPrompts}
                title="Сбросить все промпты к оригинальным"
                className="flex items-center gap-1.5 text-xs text-textDim hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={12} /> Сбросить всё
              </button>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[11px] text-textDim">
                {activePromptTab === 'diagram' && 'Системный промпт для генерации синтаксиса Mermaid.js:'}
                {activePromptTab === 'analogy' && 'Системный промпт для простых жизненных аналогий:'}
                {activePromptTab === 'summary' && 'Системный промпт для кратких тезисов и выводов:'}
              </span>
              <textarea
                rows={8}
                value={localPrompts[activePromptTab] || ''}
                onChange={(e) => setLocalPrompts({
                  ...localPrompts,
                  [activePromptTab]: e.target.value
                })}
                className="w-full bg-black/50 border border-borderColor rounded-lg p-3 text-xs font-mono text-textMain focus:border-primary outline-none custom-scrollbar leading-relaxed resize-none"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-borderColor">
          <div>
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs text-accentEmerald font-medium animate-fade-in">
                <Check size={14} /> Настройки сохранены!
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
            <button 
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primaryGlow text-white shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5"
            >
              <Check size={14} /> Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
