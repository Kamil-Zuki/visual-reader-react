import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Key, Cpu, Sparkles, Globe, MessageSquareCode, RotateCcw, Check, Plus, Edit2, Trash2, Cloud, Layers, Loader2 } from 'lucide-react';
import {
  testAnkiConnection,
  fetchAnkiCatalog,
  fetchAnkiModelFields,
  guessAnkiFieldMap,
  DEFAULT_ANKI_SETTINGS,
} from '../services/ankiConnectService';
import CommandModal from './CommandModal';

export default function SettingsModal() {
  const { 
    isSettingsOpen, setSettingsOpen, 
    apiKey, setApiKey, 
    model, setModel,
    language, setLanguage,
    prompts, setPrompts, resetPrompts,
    customCommands, addCustomCommand, updateCustomCommand, deleteCustomCommand, resetCustomCommands,
    setSyncModalOpen, syncStatus, syncSettings,
    ankiSettings, setAnkiSettings,
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'prompts'
  const [promptCategory, setPromptCategory] = useState('custom'); // 'custom' | 'builtin'
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(model);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [localPrompts, setLocalPrompts] = useState(prompts);
  const [activePromptTab, setActivePromptTab] = useState('diagram'); // 'diagram' | 'analogy' | 'summary'

  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);

  const [modelsList, setModelsList] = useState({ free: [], paid: [] });
  const [loadingModels, setLoadingModels] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [localAnkiSettings, setLocalAnkiSettings] = useState({ ...DEFAULT_ANKI_SETTINGS });
  const [ankiTesting, setAnkiTesting] = useState(false);
  const [ankiTestMessage, setAnkiTestMessage] = useState('');
  const [ankiCatalogLoading, setAnkiCatalogLoading] = useState(false);
  const [ankiDeckNames, setAnkiDeckNames] = useState([]);
  const [ankiModelNames, setAnkiModelNames] = useState([]);
  const [ankiModelFields, setAnkiModelFields] = useState([]);
  const [ankiFieldsLoading, setAnkiFieldsLoading] = useState(false);
  const [ankiCustomDeck, setAnkiCustomDeck] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalApiKey(apiKey);
      setLocalModel(model || 'openrouter/free');
      setLocalLanguage(language || 'ru');
      setLocalPrompts(prompts);
      setSavedSuccess(false);
      setLocalAnkiSettings({ ...DEFAULT_ANKI_SETTINGS, ...ankiSettings });
      setAnkiTestMessage('');
      setAnkiDeckNames([]);
      setAnkiModelNames([]);
      setAnkiModelFields([]);
      setAnkiCustomDeck(false);
      loadModels();
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen || activeTab !== 'anki') return;
    loadAnkiCatalog();
  }, [isSettingsOpen, activeTab, localAnkiSettings.baseUrl]);

  useEffect(() => {
    if (!isSettingsOpen || activeTab !== 'anki' || !localAnkiSettings.modelName) return;
    loadAnkiModelFields(localAnkiSettings.modelName);
  }, [isSettingsOpen, activeTab, localAnkiSettings.baseUrl, localAnkiSettings.modelName]);

  const applyFieldMapToSettings = (fields, prev, autoOnly) => {
    const guessed = guessAnkiFieldMap(fields);
    const frontValid = prev.fieldFront && fields.includes(prev.fieldFront);
    const backValid = prev.fieldBack && fields.includes(prev.fieldBack);
    if (autoOnly && frontValid && backValid) {
      return prev;
    }
    return {
      ...prev,
      fieldFront: frontValid ? prev.fieldFront : guessed.front,
      fieldBack: backValid ? prev.fieldBack : guessed.back,
    };
  };

  const loadAnkiCatalog = async () => {
    setAnkiCatalogLoading(true);
    try {
      const { deckNames, modelNames } = await fetchAnkiCatalog(localAnkiSettings);
      setAnkiDeckNames(deckNames);
      setAnkiModelNames(modelNames);
      setLocalAnkiSettings((prev) => {
        let next = { ...prev };
        if (modelNames.length && !modelNames.includes(prev.modelName)) {
          const fallback = modelNames.includes('Basic') ? 'Basic' : modelNames[0];
          next = { ...next, modelName: fallback };
        }
        if (deckNames.length && !deckNames.includes(prev.deckName) && !ankiCustomDeck) {
          setAnkiCustomDeck(true);
        }
        return next;
      });
    } catch (err) {
      setAnkiDeckNames([]);
      setAnkiModelNames([]);
      setAnkiTestMessage((msg) =>
        msg || `Не удалось загрузить списки: ${err.message}. Запустите Anki с AnkiConnect.`
      );
    } finally {
      setAnkiCatalogLoading(false);
    }
  };

  const loadAnkiModelFields = async (modelName) => {
    setAnkiFieldsLoading(true);
    try {
      const fields = await fetchAnkiModelFields(localAnkiSettings, modelName);
      setAnkiModelFields(fields);
      setLocalAnkiSettings((prev) => {
        const next = applyFieldMapToSettings(fields, prev, true);
        return { ...next, modelFields: fields };
      });
    } catch {
      setAnkiModelFields([]);
    } finally {
      setAnkiFieldsLoading(false);
    }
  };

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
    setAnkiSettings(localAnkiSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSettingsOpen(false);
    }, 400);
  };

  const handleResetPrompts = async () => {
    if (window.confirm('Сбросить стандартные промпты к начальным настройкам из базы данных?')) {
      const reset = await resetPrompts();
      if (reset) setLocalPrompts({ ...reset });
    }
  };

  const handleResetCommands = async () => {
    if (window.confirm('Сбросить пользовательские команды к начальному списку из базы данных?')) {
      await resetCustomCommands();
    }
  };

  const handleTestAnki = async () => {
    setAnkiTesting(true);
    setAnkiTestMessage('');
    try {
      const { version, deckNames, modelNames } = await testAnkiConnection(localAnkiSettings);
      setAnkiDeckNames(deckNames);
      setAnkiModelNames(modelNames);
      const hasDeck = deckNames.includes(localAnkiSettings.deckName);
      const hasModel = modelNames.includes(localAnkiSettings.modelName);
      if (localAnkiSettings.modelName && hasModel) {
        await loadAnkiModelFields(localAnkiSettings.modelName);
      }
      setAnkiTestMessage(
        `AnkiConnect v${version}. Колод: ${deckNames.length}, типов заметок: ${modelNames.length}.` +
          (hasDeck ? '' : ` Колода «${localAnkiSettings.deckName}» будет создана при импорте.`) +
          (hasModel ? '' : ` ⚠ Тип «${localAnkiSettings.modelName}» не найден — выберите другой.`)
      );
    } catch (err) {
      setAnkiTestMessage(
        `Не удалось подключиться: ${err.message}. Запустите Anki с аддоном AnkiConnect (порт 8765).`
      );
    } finally {
      setAnkiTesting(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top,24px))] pb-[max(1rem,env(safe-area-inset-bottom,16px))] animate-fade-in">
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
            <MessageSquareCode size={14} /> Команды
          </button>
          <button
            onClick={() => setActiveTab('anki')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'anki' ? 'bg-primary text-white shadow-md' : 'text-textMuted hover:text-white'
            }`}
          >
            <Layers size={14} /> Anki
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
                На этом языке ИИ будет составлять объяснения, схемы и ответы на ваши команды.
              </span>
            </div>

            {/* Supabase Cloud Sync shortcut */}
            <div className="p-3 bg-white/[0.02] border border-borderColor rounded-xl flex items-center justify-between mt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Cloud size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    Облачная синхронизация (Supabase)
                    <span className={`w-2 h-2 rounded-full ${
                      syncSettings?.enabled 
                        ? (syncStatus === 'synced' ? 'bg-accentEmerald' : syncStatus === 'error' ? 'bg-red-400' : 'bg-amber-400') 
                        : 'bg-textMuted/40'
                    }`}></span>
                  </div>
                  <div className="text-[11px] text-textMuted">
                    {!syncSettings?.enabled 
                      ? 'Выключена' 
                      : syncStatus === 'synced'
                        ? 'Синхронизировано'
                        : syncStatus === 'syncing'
                          ? 'Обновление данных...'
                          : syncStatus === 'connecting'
                            ? 'Подключение...'
                            : syncStatus === 'error'
                              ? 'Ошибка подключения'
                              : 'Готово к работе'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setSyncModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white border border-white/10 transition-colors cursor-pointer"
              >
                Настроить Supabase
              </button>
            </div>
          </div>
        )}

        {activeTab === 'anki' && (
          <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
            <p className="text-[11px] text-textDim leading-relaxed">
              Отправка карточек через{' '}
              <a
                href="https://foosoft.net/projects/anki-connect/"
                target="_blank"
                rel="noreferrer"
                className="text-primaryGlow hover:underline"
              >
                AnkiConnect
              </a>
              . Anki должен быть запущен на этом же компьютере. В десктоп-приложении запрос идёт
              через Rust (CORS не мешает). В браузере добавьте в конфиг AnkiConnect в{' '}
              <code className="text-primaryGlow">webCorsOriginList</code> ваш origin, например{' '}
              <code className="text-primaryGlow">http://localhost:5173</code>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-textMain uppercase tracking-wider">URL AnkiConnect</label>
              <input
                value={localAnkiSettings.baseUrl}
                onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, baseUrl: e.target.value }))}
                className="w-full bg-black/40 border border-borderColor rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-primary outline-none"
                placeholder="http://127.0.0.1:8765"
              />
            </div>
            {(ankiCatalogLoading || ankiDeckNames.length > 0) && (
              <div className="flex items-center gap-2 text-[11px] text-textDim">
                {ankiCatalogLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-primaryGlow" />
                    Загрузка колод и типов заметок из Anki…
                  </>
                ) : (
                  <span>
                    Из Anki: {ankiDeckNames.length} колод, {ankiModelNames.length} типов заметок
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Колода</label>
                {ankiDeckNames.length > 0 && !ankiCustomDeck ? (
                  <select
                    value={
                      ankiDeckNames.includes(localAnkiSettings.deckName)
                        ? localAnkiSettings.deckName
                        : '__new__'
                    }
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setAnkiCustomDeck(true);
                        return;
                      }
                      setLocalAnkiSettings((s) => ({ ...s, deckName: e.target.value }));
                    }}
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  >
                    {ankiDeckNames.map((name) => (
                      <option key={name} value={name} className="bg-[#1a1f2e]">
                        {name}
                      </option>
                    ))}
                    <option value="__new__" className="bg-[#1a1f2e]">
                      + Новая колода…
                    </option>
                  </select>
                ) : (
                  <div className="flex flex-col gap-1">
                    <input
                      value={localAnkiSettings.deckName}
                      onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, deckName: e.target.value }))}
                      className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                      placeholder="Visual Reader"
                    />
                    {ankiDeckNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAnkiCustomDeck(false)}
                        className="text-[10px] text-primaryGlow hover:underline text-left"
                      >
                        Выбрать из списка Anki
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Тип заметок</label>
                {ankiModelNames.length > 0 ? (
                  <select
                    value={localAnkiSettings.modelName}
                    onChange={(e) => {
                      const modelName = e.target.value;
                      setLocalAnkiSettings((s) => ({
                        ...s,
                        modelName,
                        fieldFront: '',
                        fieldBack: '',
                      }));
                    }}
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  >
                    {ankiModelNames.map((name) => (
                      <option key={name} value={name} className="bg-[#1a1f2e]">
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={localAnkiSettings.modelName}
                    onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, modelName: e.target.value }))}
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                    placeholder="Basic"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-textMain uppercase tracking-wider">
                  Поле «лицо»
                  {ankiFieldsLoading && (
                    <Loader2 size={11} className="inline ml-1 animate-spin text-textDim" />
                  )}
                </label>
                {ankiModelFields.length > 0 ? (
                  <select
                    value={localAnkiSettings.fieldFront || ankiModelFields[0]}
                    onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, fieldFront: e.target.value }))}
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  >
                    {ankiModelFields.map((name) => (
                      <option key={name} value={name} className="bg-[#1a1f2e]">
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={localAnkiSettings.fieldFront}
                    onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, fieldFront: e.target.value }))}
                    placeholder="Front (авто)"
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-textMain uppercase tracking-wider">
                  Поле «ответ»
                  {ankiFieldsLoading && (
                    <Loader2 size={11} className="inline ml-1 animate-spin text-textDim" />
                  )}
                </label>
                {ankiModelFields.length > 0 ? (
                  <select
                    value={localAnkiSettings.fieldBack || ankiModelFields[1] || ankiModelFields[0]}
                    onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, fieldBack: e.target.value }))}
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  >
                    {ankiModelFields.map((name) => (
                      <option key={name} value={name} className="bg-[#1a1f2e]">
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={localAnkiSettings.fieldBack}
                    onChange={(e) => setLocalAnkiSettings((s) => ({ ...s, fieldBack: e.target.value }))}
                    placeholder="Back (авто)"
                    className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  />
                )}
              </div>
            </div>
            {ankiModelFields.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLocalAnkiSettings((prev) => applyFieldMapToSettings(ankiModelFields, prev, false))
                }
                className="text-[11px] text-primaryGlow hover:underline text-left w-fit"
              >
                Подставить поля автоматически (Front/Back, Question/Answer…)
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-textMain uppercase tracking-wider">Теги (через запятую)</label>
              <input
                value={(localAnkiSettings.tags || []).join(', ')}
                onChange={(e) =>
                  setLocalAnkiSettings((s) => ({
                    ...s,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  }))
                }
                className="w-full bg-black/40 border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleTestAnki}
              disabled={ankiTesting}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-sm text-primaryGlow font-medium transition-colors disabled:opacity-50"
            >
              {ankiTesting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Проверить подключение
            </button>
            {ankiTestMessage && (
              <p className="text-[11px] text-textMuted leading-relaxed border border-white/10 rounded-lg p-2.5 bg-black/30">
                {ankiTestMessage}
              </p>
            )}
          </div>
        )}

        {/* Tab 2: Commands & Prompts */}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
            {/* Sub-tabs: My Commands vs Built-in Prompts */}
            <div className="flex gap-2 border-b border-borderColor pb-2">
              <button
                onClick={() => setPromptCategory('custom')}
                className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
                  promptCategory === 'custom' 
                    ? 'border-primary text-primaryGlow' 
                    : 'border-transparent text-textMuted hover:text-white'
                }`}
              >
                ✨ Мои команды ({customCommands.length})
              </button>
              <button
                onClick={() => setPromptCategory('builtin')}
                className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
                  promptCategory === 'builtin' 
                    ? 'border-primary text-primaryGlow' 
                    : 'border-transparent text-textMuted hover:text-white'
                }`}
              >
                ⚙️ Базовые системные промпты
              </button>
            </div>

            {promptCategory === 'custom' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-textDim">
                    Создавайте любые быстрые команды для выделенного текста:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetCommands}
                      title="Сбросить к начальным примерам"
                      className="flex items-center gap-1 text-[11px] text-textDim hover:text-white px-2 py-1 rounded hover:bg-white/5"
                    >
                      <RotateCcw size={11} /> Сбросить
                    </button>
                    <button
                      onClick={() => {
                        setEditingCommand(null);
                        setCommandModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold bg-primary hover:bg-primaryGlow text-white px-2.5 py-1 rounded-lg shadow-sm"
                    >
                      <Plus size={13} /> Новая команда
                    </button>
                  </div>
                </div>

                {/* List of custom commands */}
                <div className="flex flex-col gap-2">
                  {customCommands.length === 0 ? (
                    <div className="text-center py-8 text-xs text-textDim bg-black/20 rounded-xl border border-dashed border-borderColor">
                      Нет пользовательских команд. Создайте первую!
                    </div>
                  ) : (
                    customCommands.map((cmd) => (
                      <div 
                        key={cmd.id}
                        className="p-3 rounded-xl bg-black/30 border border-borderColor hover:border-primary/40 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="text-xl p-1.5 rounded-lg bg-white/5 shrink-0">
                            {cmd.icon || '⚡'}
                          </span>
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">
                                {cmd.title}
                              </span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-textDim border border-white/5 shrink-0">
                                {cmd.type === 'diagram' ? '📊 Схема' : '📝 Текст'}
                              </span>
                            </div>
                            <p className="text-[11px] text-textMuted line-clamp-2 leading-relaxed">
                              {cmd.prompt}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCommand(cmd);
                              setCommandModalOpen(true);
                            }}
                            title="Редактировать команду"
                            className="p-1.5 rounded hover:bg-white/10 text-textDim hover:text-white transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Удалить команду "${cmd.title}"?`)) {
                                deleteCustomCommand(cmd.id);
                              }
                            }}
                            title="Удалить команду"
                            className="p-1.5 rounded hover:bg-red-500/20 text-textDim hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
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
                    title="Сбросить базовые промпты к оригинальным"
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

      {/* Command Modal for creating/editing from Settings */}
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
    </div>
  );
}
