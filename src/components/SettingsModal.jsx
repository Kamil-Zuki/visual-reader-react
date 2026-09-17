import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Key, Cpu, Sparkles } from 'lucide-react';

export default function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, apiKey, setApiKey, model, setModel } = useStore();
  
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(model);
  const [modelsList, setModelsList] = useState({ free: [], paid: [] });
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalApiKey(apiKey);
      setLocalModel(model || 'openrouter/free');
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
    setSettingsOpen(false);
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-bgSidebar border border-borderColor rounded-xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderColor pb-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Cpu className="text-primary" size={20} />
            Настройки OpenRouter AI
          </div>
          <button 
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-textMain flex items-center gap-1.5">
            <Key size={14} className="text-primaryGlow" /> API-ключ OpenRouter
          </label>
          <input 
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full bg-black/40 border border-borderColor rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-primary outline-none transition-colors"
          />
          <span className="text-xs text-textDim">
            Ключ хранится локально в браузере. Получить можно бесплатно на{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primaryGlow hover:underline">
              openrouter.ai
            </a>.
          </span>
        </div>

        {/* Model Select */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-textMain flex items-center gap-1.5">
              <Sparkles size={14} className="text-accentEmerald" /> Модель ИИ
            </label>
            {loadingModels && (
              <span className="text-xs text-accentEmerald animate-pulse">Загрузка каталога моделей...</span>
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
          <span className="text-xs text-textDim">
            По умолчанию используется <code>openrouter/free</code> — она автоматически подбирает наиболее свободную бесплатную модель.
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-borderColor">
          <button 
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primaryGlow text-white shadow-lg shadow-primary/20 transition-all"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
