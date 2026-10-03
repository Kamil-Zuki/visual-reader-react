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

  const handleResumeReading = async () => {
    try {
      const all = await getAllBooksFromDB();
      if (!all || all.length === 0) return;
      const savedBookId = useStore.getState().currentBookId;
      let target = (savedBookId && all.find((b) => b.id === savedBookId)) || all[0];
      if (target) {
        if (target.format === 'epub') {
          target = await prepareEpubBookForReading(target, saveBookToDB);
        }
        const locs = useStore.getState().epubLocations;
        if (target.format === 'epub' && locs[target.id]) {
          requestEpubResume(target.id);
        }
        setCurrentBook(target, target.id);
      }
    } catch (e) {
      console.error('[App] Failed to resume reading:', e);
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bgMain">
      
      {/* GLOBAL SIDEBAR (Navigation) */}
      <nav className="w-16 md:w-[72px] bg-bgSidebar border-r border-borderColor flex flex-col items-center py-4 gap-4 z-40 shrink-0">
        <div 
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primaryGlow flex items-center justify-center text-white shadow-sm shadow-primary/20 mb-2 cursor-pointer"
          onClick={() => setLibraryOpen(true)}
          title="На главную"
        >
          <BookOpen size={20} />
        </div>

        {/* Main Actions */}
        <div className="flex flex-col gap-2 w-full px-2">
          <button onClick={() => setLibraryOpen(true)} className="p-3 rounded-xl text-textDim hover:text-white hover:bg-white/5 transition-colors flex justify-center w-full" title="Библиотека">
            <Library size={20} />
          </button>
          <button onClick={() => hasBook && setSearchOpen(true)} disabled={!hasBook} className={`p-3 rounded-xl flex justify-center w-full transition-colors ${hasBook ? 'text-textDim hover:text-white hover:bg-white/5' : 'text-textDim/30'}`} title="Поиск (Ctrl+K)">
            <Search size={20} />
          </button>
          <button onClick={() => hasBook && setNotesOpen(true)} disabled={!hasBook} className={`p-3 rounded-xl flex justify-center w-full transition-colors ${hasBook ? 'text-textDim hover:text-white hover:bg-white/5' : 'text-textDim/30'}`} title="Заметки">
            <PenTool size={20} />
          </button>
          <button onClick={() => hasBook && setGraphOpen(true)} disabled={!hasBook} className={`p-3 rounded-xl flex justify-center w-full transition-colors ${hasBook ? 'text-textDim hover:text-white hover:bg-white/5' : 'text-textDim/30'}`} title="Связи (Граф)">
            <Network size={20} />
          </button>
          <button onClick={() => hasBook && setFlashcardsOpen(true)} disabled={!hasBook} className={`p-3 rounded-xl flex justify-center w-full transition-colors relative ${hasBook ? 'text-textDim hover:text-white hover:bg-white/5' : 'text-textDim/30'}`} title="Карточки">
            <Layers size={20} />
            {dueCardsCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>}
          </button>
          <button onClick={() => setGlossaryOpen(true)} className="p-3 rounded-xl text-textDim hover:text-white hover:bg-white/5 transition-colors flex justify-center w-full" title="Глоссарий">
            <BookMarked size={20} />
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto flex flex-col gap-2 w-full px-2">
          <button onClick={() => setStatsOpen(true)} className="p-3 rounded-xl text-textDim hover:text-white hover:bg-white/5 transition-colors flex justify-center w-full" title="Прогресс чтения">
            <BarChart2 size={20} />
          </button>
          <button onClick={() => setSyncModalOpen(true)} className={`p-3 rounded-xl flex justify-center w-full transition-colors ${syncStatus === 'synced' ? 'text-accentEmerald bg-accentEmerald/10' : syncStatus === 'error' ? 'text-red-400 bg-red-400/10' : 'text-textDim hover:text-white hover:bg-white/5'}`} title="Синхронизация (Supabase)">
            <Cloud size={20} />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-3 rounded-xl text-textDim hover:text-white hover:bg-white/5 transition-colors flex justify-center w-full relative" title="Настройки">
            <Settings size={20} />
            <div className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-accentEmerald' : 'bg-red-500'}`}></div>
          </button>
        </div>
      </nav>

      {/* MAIN APP CONTENT */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        
        {/* CLEAN HEADER */}
        <header className="mobile-safe-top bg-bgMain border-b border-borderColor flex items-center justify-between px-4 shrink-0 z-30 h-12">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${isSidebarOpen ? 'bg-primary/15 text-primaryGlow' : 'bg-transparent text-textDim hover:text-white hover:bg-white/5'}`}
              title={isSidebarOpen ? 'Скрыть оглавление (Ctrl+B)' : 'Показать оглавление (Ctrl+B)'}
            >
              <PanelLeft size={16} />
            </button>
            
            {hasBook && currentBook ? (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md text-white">
                  {currentBook.title}
                </span>
                <button
                  onClick={() => { clearEpubResume(); setCurrentBook(null, ''); }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 text-[10px] sm:text-xs text-textDim transition-colors uppercase font-bold tracking-wider"
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <h1 className="font-semibold text-base tracking-tight text-textDim">Visual Reader</h1>
            )}
          </div>

          <div className="flex items-center gap-3">
            {installPrompt && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary/20 text-primaryGlow hover:bg-primary hover:text-white transition-colors border border-primary/30"
              >
                <Download size={14} /> <span className="hidden sm:inline">Установить</span>
              </button>
            )}
            
            <button
              onClick={toggleInspector}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0 ${isInspectorOpen ? 'bg-primary/15 text-primaryGlow' : 'bg-transparent text-textDim hover:text-white hover:bg-white/5'}`}
              title={isInspectorOpen ? 'Скрыть ИИ-инспектор (Ctrl+I)' : 'Показать ИИ-инспектор (Ctrl+I)'}
            >
              <PanelRight size={16} />
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
    </div>
  );
}

export default App;
