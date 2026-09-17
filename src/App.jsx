import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { openDB, getAllBooksFromDB, getBookByIdFromDB, saveBookToDB } from './utils/db';
import { BOOK_DATA } from './data/book_data';
import { BookOpen, Settings, Library, List, Sparkles, BookOpenText, Download } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import AIInspector from './components/AIInspector';
import LibraryModal from './components/LibraryModal';
import SettingsModal from './components/SettingsModal';

function App() {
  const { 
    currentBook, setCurrentBook, currentBookId,
    setLibraryOpen, setSettingsOpen, apiKey,
    mobileTab, setMobileTab
  } = useStore();

  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

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

  useEffect(() => {
    const initApp = async () => {
      await openDB();
      const books = await getAllBooksFromDB();
      
      const defaultBookData = {
        id: 'default_ddia',
        title: BOOK_DATA?.title || 'Designing Data-Intensive Applications',
        author: BOOK_DATA?.author || 'Martin Kleppmann',
        chapters: BOOK_DATA?.chapters || [],
        isDefault: true
      };

      let defaultExists = books.find(b => b.id === 'default_ddia');
      // If doesn't exist or has empty/corrupted chapters, re-save
      if (!defaultExists || (!defaultExists.chapters && !defaultExists.structure)) {
        console.log('Saving DDIA book into DB...');
        await saveBookToDB(defaultBookData);
      }

      let targetId = currentBookId || 'default_ddia';
      let book = await getBookByIdFromDB(targetId);
      if (!book || (!book.chapters && !book.structure)) {
        book = defaultBookData;
      }
      setCurrentBook(book, book.id);
    };
    initApp();
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-bgMain">
      {/* Header */}
      <header className="h-14 bg-bgSidebar border-b border-borderColor flex items-center justify-between px-3 sm:px-4 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primaryGlow flex items-center justify-center text-white shrink-0 shadow-sm shadow-primary/20">
            <BookOpen size={18} />
          </div>
          <h1 className="font-semibold text-base sm:text-lg shrink-0 tracking-tight">Visual Reader</h1>
          {currentBook && (
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

          <button 
            onClick={() => setLibraryOpen(true)} 
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Библиотека книг"
          >
            <Library size={14} /> 
            <span className="hidden sm:inline">Библиотека</span>
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
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Настройки"
          >
            <Settings size={14} /> 
            <span className="hidden sm:inline">Настройки</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Desktop (3 columns) vs Mobile (active tab) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Layout */}
        <div className="hidden md:flex w-full h-full">
          <Sidebar />
          <Reader />
          <AIInspector />
        </div>

        {/* Mobile View: Render only active tab */}
        <div className="flex md:hidden w-full h-full pb-14">
          {mobileTab === 'sidebar' && <Sidebar />}
          {mobileTab === 'reader' && <Reader />}
          {mobileTab === 'ai' && <AIInspector />}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-bgSidebar/95 backdrop-blur-md border-t border-borderColor flex items-center justify-around px-2 z-30 safe-bottom">
        <button
          onClick={() => setMobileTab('sidebar')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            mobileTab === 'sidebar' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
          }`}
        >
          <List size={18} />
          <span className="text-[10px] mt-0.5">Главы</span>
        </button>

        <button
          onClick={() => setMobileTab('reader')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            mobileTab === 'reader' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
          }`}
        >
          <BookOpenText size={18} />
          <span className="text-[10px] mt-0.5">Книга</span>
        </button>

        <button
          onClick={() => setMobileTab('ai')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            mobileTab === 'ai' ? 'text-primaryGlow font-semibold' : 'text-textDim hover:text-textMain'
          }`}
        >
          <div className="relative">
            <Sparkles size={18} />
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-accentPurple animate-ping"></span>
          </div>
          <span className="text-[10px] mt-0.5">ИИ-схемы</span>
        </button>
      </nav>

      {/* Modals */}
      <LibraryModal />
      <SettingsModal />
    </div>
  );
}

export default App;
