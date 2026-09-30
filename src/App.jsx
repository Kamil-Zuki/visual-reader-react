import React, { useEffect, useState } from 'react';
import { useStore, initStoreFromDB } from './store/useStore';
import { openDB, getBookByIdFromDB, getAllBooksFromDB, saveBookToDB } from './utils/db';
import { prepareEpubBookForReading } from './utils/epubImport';
import {
  BookOpen,
  Settings,
  Library,
  List,
  Sparkles,
  BookOpenText,
  Download,
  PanelLeft,
  PanelLeftOpen,
  PanelRight,
  PanelRightOpen,
  PenTool,
  Network,
  Cloud,
  Search,
  Layers,
  BookMarked,
  BarChart2,
  Award
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import EpubReader from './components/EpubReader';
import AIInspector from './components/AIInspector';
import LibraryModal from './components/LibraryModal';
import LibraryPanel from './components/LibraryPanel';
import SettingsModal from './components/SettingsModal';
import NotesModal from './components/NotesModal';
import ConceptGraphModal from './components/ConceptGraphModal';
import SyncModal from './components/SyncModal';
import SearchModal from './components/SearchModal';
import QuizModal from './components/QuizModal';
import FlashcardModal from './components/FlashcardModal';
import GlossaryModal from './components/GlossaryModal';
import StatsModal from './components/StatsModal';
import PanelResizer from './components/PanelResizer';
import { initSyncServiceFromSettings, connectSync } from './services/supabaseSyncService';

function App() {
  const {
    currentBook, setCurrentBook, currentBookId, requestEpubResume, clearEpubResume,
    setLibraryOpen, setSettingsOpen, setNotesOpen, setGraphOpen, apiKey,
    setSearchOpen,
    setFlashcardsOpen, setGlossaryOpen, setStatsOpen, flashcards,
    mobileTab, setMobileTab,
    isSidebarOpen, toggleSidebar, setSidebarOpen, setSidebarWidth,
    isInspectorOpen, toggleInspector, setInspectorOpen, setInspectorWidth,
    setSyncModalOpen, syncStatus, syncSettings
  } = useStore();

  const bookCards = flashcards[currentBookId] || [];
  const dueCardsCount = bookCards.filter(c => !c.nextReviewDate || c.nextReviewDate <= Date.now()).length;

  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Keyboard shortcuts: Ctrl+B (sidebar), Ctrl+I (inspector), Ctrl+K / Ctrl+F (search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInspector();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleInspector, setSearchOpen]);

  useEffect(() => {
    // Check if already in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const isEpub = currentBook?.format === 'epub';
  const hasBook = Boolean(
    currentBook && ((currentBook.chapters?.length || 0) > 0 || (currentBook.structure?.length || 0) > 0)
  );

  useEffect(() => {
    const initApp = async () => {
      try {
        await openDB();
        await initStoreFromDB();

        // Проверяем, передан ли ключ синхронизации через URL/Hash для сопряжения по QR-коду
        let urlParams = null;
        try {
          if (window.location.hash && (window.location.hash.includes('sync_key=') || window.location.hash.includes('sync_room='))) {
            urlParams = new URLSearchParams(window.location.hash.substring(1));
          } else if (window.location.search && (window.location.search.includes('sync_key=') || window.location.search.includes('sync_room='))) {
            urlParams = new URLSearchParams(window.location.search);
          }
        } catch (e) {
          console.warn('[App] URL parse error:', e);
        }

        const incomingSyncKey = urlParams ? (urlParams.get('sync_key') || urlParams.get('sync_room')) : null;
        if (incomingSyncKey) {
          console.log('[App] Received sync_key from URL:', incomingSyncKey);
          const currentSettings = useStore.getState().syncSettings || {};
          const newSettings = {
            ...currentSettings,
            syncKey: incomingSyncKey
          };
          useStore.getState().setSyncSettings(newSettings);
          if (newSettings.enabled && newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
            connectSync(newSettings);
          } else {
            useStore.getState().setSyncModalOpen(true);
          }
        } else {
          // Инициализируем Supabase синхронизацию, если была включена в настройках
          const savedSyncSettings = useStore.getState().syncSettings;
          if (savedSyncSettings?.enabled && savedSyncSettings?.supabaseUrl && savedSyncSettings?.supabaseAnonKey && savedSyncSettings?.syncKey) {
            initSyncServiceFromSettings(savedSyncSettings);
          }
        }

        const savedBookId = useStore.getState().currentBookId;
        let loaded = null;
        if (savedBookId) {
          loaded = await getBookByIdFromDB(savedBookId);
        }
        if (!loaded) {
          const all = await getAllBooksFromDB();
          loaded = all[0] || null;
        }
        if (loaded?.chapters?.length || loaded?.structure?.length) {
          if (loaded.format === 'epub') {
            loaded = await prepareEpubBookForReading(loaded, saveBookToDB);
          }
          const locs = useStore.getState().epubLocations;
          if (loaded.format === 'epub' && locs[loaded.id]) {
            requestEpubResume(loaded.id);
          } else {
            clearEpubResume();
          }
          setCurrentBook(loaded, loaded.id);
        } else {
          clearEpubResume();
          setCurrentBook(null, '');
        }
      } catch (e) {
        console.error('[App] DB init failed in background:', e);
        setCurrentBook(null, '');
      }
    };
    initApp();
  }, [setCurrentBook, setLibraryOpen]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-bgMain">
      {/* Header with Android/Mobile Status Bar Safe Area Padding */}
      <header className="mobile-safe-top bg-bgSidebar border-b border-borderColor flex items-center justify-between px-3 sm:px-4 shrink-0 z-30 h-auto md:h-14 pb-2.5 md:pb-0">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          {/* Sidebar toggle button on desktop */}
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${isSidebarOpen
                ? 'bg-primary/15 border-primary/40 text-primaryGlow'
                : 'bg-white/5 border-white/10 text-textDim hover:text-white'
              }`}
            title={isSidebarOpen ? 'Скрыть оглавление (Ctrl+B)' : 'Показать оглавление (Ctrl+B)'}
          >
            <PanelLeft size={16} />
          </button>

          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primaryGlow flex items-center justify-center text-white shrink-0 shadow-sm shadow-primary/20">
            <BookOpen size={18} />
          </div>
          <h1 className="font-semibold text-base sm:text-lg shrink-0 tracking-tight">Visual Reader</h1>
          {hasBook && currentBook && (
            <span className="text-xs text-textMuted bg-white/5 px-2 py-1 rounded border border-white/10 ml-1 truncate max-w-[120px] sm:max-w-xs hidden xs:inline-block">
              {currentBook.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* PWA install button if prompt available */}
          {installPrompt && !isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs rounded-md bg-primary hover:bg-primaryGlow text-white font-medium shadow-md shadow-primary/20 transition-all cursor-pointer"
              title="Установить как PWA приложение"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Установить</span>
            </button>
          )}

          {/* Inspector toggle button on desktop */}
          <button
            onClick={toggleInspector}
            className={`px-2 sm:px-2.5 py-1.5 text-xs rounded-md border transition-colors cursor-pointer hidden md:flex items-center gap-1.5 ${isInspectorOpen
                ? 'bg-primary/15 border-primary/40 text-primaryGlow font-medium'
                : 'bg-white/5 border-white/10 text-textDim hover:text-white'
              }`}
            title={isInspectorOpen ? 'Скрыть ИИ-инспектор (Ctrl+I)' : 'Показать ИИ-инспектор (Ctrl+I)'}
          >
            <PanelRight size={14} />
            <span className="hidden lg:inline">Инспектор</span>
          </button>

          {/* Full-text Book Search Button */}
          <button
            onClick={() => hasBook && setSearchOpen(true)}
            disabled={!hasBook}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-colors group ${
              hasBook
                ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-primary/40 cursor-pointer'
                : 'bg-white/[0.02] border-white/5 text-textDim opacity-50 cursor-not-allowed'
            }`}
            title="Полнотекстовый поиск по книге (Ctrl+K или Ctrl+F)"
          >
            <Search size={14} className="text-primaryGlow group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Поиск</span>
            <span className="hidden xl:inline text-[10px] text-textDim font-mono bg-white/5 border border-white/10 px-1 py-0.5 rounded ml-0.5">
              Ctrl+K
            </span>
          </button>

          {hasBook ? (
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              title="Сменить книгу"
            >
              <Library size={14} />
              <span className="hidden sm:inline">Библиотека</span>
            </button>
          ) : null}
          {hasBook && (
            <button
              onClick={() => {
                clearEpubResume();
                setCurrentBook(null, '');
              }}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              title="Закрыть книгу и вернуться на главный экран"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">В библиотеку</span>
            </button>
          )}

          <button
            onClick={() => hasBook && setNotesOpen(true)}
            disabled={!hasBook}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-colors ${
              hasBook
                ? 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                : 'opacity-50 cursor-not-allowed border-white/5'
            }`}
            title="Ваши заметки и хайлайты"
          >
            <PenTool size={14} />
            <span className="hidden sm:inline">Заметки</span>
          </button>

          <button
            onClick={() => hasBook && setGraphOpen(true)}
            disabled={!hasBook}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-colors ${
              hasBook
                ? 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                : 'opacity-50 cursor-not-allowed border-white/5'
            }`}
            title="Граф концепций"
          >
            <Network size={14} />
            <span className="hidden sm:inline">Связи</span>
          </button>

          {/* Flashcards & Spaced Repetition Button */}
          <button
            onClick={() => hasBook && setFlashcardsOpen(true)}
            disabled={!hasBook}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer relative"
            title="Флешкарты и интервальное повторение"
          >
            <Layers size={14} className="text-primaryGlow" />
            <span className="hidden sm:inline">Карточки</span>
            {dueCardsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-mono font-semibold shadow-sm">
                {dueCardsCount}
              </span>
            )}
          </button>

          {/* Glossary Button */}
          <button
            onClick={() => setGlossaryOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="Глоссарий терминов книги"
          >
            <BookMarked size={14} className="text-accentEmerald" />
            <span className="hidden sm:inline">Глоссарий</span>
          </button>

          {/* Stats / Progress Dashboard Button */}
          <button
            onClick={() => setStatsOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="Статистика чтения и прогресс"
          >
            <BarChart2 size={14} className="text-violet-400" />
            <span className="hidden sm:inline">Прогресс</span>
          </button>

          {/* Supabase Cloud Sync Status Button */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-all cursor-pointer ${
              !syncSettings?.enabled
                ? 'bg-white/5 border-white/10 text-textDim hover:text-white'
                : syncStatus === 'synced'
                  ? 'border-accentEmerald/40 bg-accentEmerald/10 text-accentEmerald hover:bg-accentEmerald/20'
                  : syncStatus === 'error'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
            title={
              !syncSettings?.enabled
                ? 'Облачная синхронизация выключена (нажмите для настройки)'
                : syncStatus === 'synced'
                  ? 'Облако: синхронизировано'
                  : syncStatus === 'syncing'
                    ? 'Облако: отправка изменений...'
                    : syncStatus === 'connecting'
                      ? 'Облако: подключение...'
                      : 'Облако: ошибка синхронизации'
            }
          >
            {/* Status indicator dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              !syncSettings?.enabled
                ? 'bg-white/20'
                : syncStatus === 'synced'
                  ? 'bg-accentEmerald shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : syncStatus === 'error'
                    ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-ping'
            }`}></div>

            <Cloud size={14} className={syncStatus === 'synced' ? 'text-accentEmerald' : syncStatus === 'syncing' ? 'text-blue-400 animate-spin' : ''} />

            <span className="hidden sm:inline">
              {!syncSettings?.enabled
                ? 'Облако (выкл)'
                : syncStatus === 'synced'
                  ? 'В сети'
                  : syncStatus === 'syncing'
                    ? 'Синхр...'
                    : syncStatus === 'error'
                      ? 'Ошибка'
                      : 'Подключение...'}
            </span>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-colors cursor-pointer ${apiKey ? 'border-accentEmerald/30 bg-accentEmerald/10 text-accentEmerald hover:bg-accentEmerald/20' : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
            title={apiKey ? 'OpenRouter API Key настроен' : 'Ключ API отсутствует'}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${apiKey ? 'bg-accentEmerald' : 'bg-red-500'}`}></div>
            <span className="hidden md:inline">{apiKey ? 'API Active' : 'No API Key'}</span>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="Настройки"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Настройки</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Desktop (3 columns with resizers) vs Mobile (active tab) */}
      <div className="flex flex-1 overflow-hidden relative">
        {!hasBook ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 md:p-12 bg-bgMain">
            <LibraryPanel layout="embedded" />
          </div>
        ) : (
        <>
        {/* Desktop Layout */}
        <div className="hidden md:flex w-full h-full relative overflow-hidden">
          {/* Left Sidebar */}
          {isSidebarOpen && <Sidebar />}

          {/* Left Splitter */}
          {isSidebarOpen && (
            <PanelResizer
              direction="left"
              minWidth={180}
              maxWidth={600}
              defaultWidth={300}
              onResize={setSidebarWidth}
              onDoubleClick={() => setSidebarWidth(300)}
            />
          )}

          {/* Floating tab to reopen sidebar if collapsed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 py-3.5 px-1 rounded-r-lg bg-bgSidebar border-y border-r border-borderColor hover:bg-primary/20 text-textDim hover:text-white transition-all shadow-lg flex items-center justify-center group cursor-pointer"
              title="Показать оглавление (Ctrl+B)"
            >
              <PanelLeftOpen size={15} className="group-hover:scale-110 text-primaryGlow transition-transform" />
            </button>
          )}

          {/* Central Reader */}
          {isEpub ? <EpubReader /> : <Reader />}

          {/* Floating tab to reopen inspector if collapsed */}
          {!isInspectorOpen && (
            <button
              onClick={() => setInspectorOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 py-3.5 px-1 rounded-l-lg bg-bgSidebar border-y border-l border-borderColor hover:bg-primary/20 text-textDim hover:text-white transition-all shadow-lg flex items-center justify-center group cursor-pointer"
              title="Показать ИИ-инспектор (Ctrl+I)"
            >
              <PanelRightOpen size={15} className="group-hover:scale-110 text-primaryGlow transition-transform" />
            </button>
          )}

          {/* Right Splitter */}
          {isInspectorOpen && (
            <PanelResizer
              direction="right"
              minWidth={280}
              maxWidth={750}
              defaultWidth={420}
              onResize={setInspectorWidth}
              onDoubleClick={() => setInspectorWidth(420)}
            />
          )}

          {/* Right AI Inspector */}
          {isInspectorOpen && <AIInspector />}
        </div>


        {/* Mobile View: Render only active tab */}
        <div className="flex md:hidden w-full min-w-0 max-w-full h-full pb-14 overflow-x-hidden">
          {mobileTab === 'sidebar' && <Sidebar />}
          {mobileTab === 'reader' && (isEpub ? <EpubReader /> : <Reader />)}
          {mobileTab === 'ai' && <AIInspector />}
        </div>
        </>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {hasBook && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-bgSidebar/95 backdrop-blur-md border-t border-borderColor flex items-center justify-around px-2 z-30 safe-bottom">
        <button
          onClick={() => setMobileTab('sidebar')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${mobileTab === 'sidebar' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
            }`}
        >
          <List size={18} />
          <span className="text-[10px] mt-0.5">Главы</span>
        </button>

        <button
          onClick={() => setMobileTab('reader')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${mobileTab === 'reader' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
            }`}
        >
          <BookOpenText size={18} />
          <span className="text-[10px] mt-0.5">Книга</span>
        </button>

        <button
          onClick={() => setMobileTab('ai')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${mobileTab === 'ai' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
            }`}
        >
          <div className="relative">
            <Sparkles size={18} />
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-accentPurple animate-ping"></span>
          </div>
          <span className="text-[10px] mt-0.5">ИИ-схемы</span>
        </button>
      </nav>
      )}

      {/* Modals */}
      <SearchModal />
      <QuizModal />
      <FlashcardModal />
      <GlossaryModal />
      <StatsModal />
      <LibraryModal />
      <SettingsModal />
      <NotesModal />
      <ConceptGraphModal />
      <SyncModal />
    </div>
  );
}

export default App;
