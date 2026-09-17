import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { openDB, getAllBooksFromDB, getBookByIdFromDB, saveBookToDB } from './utils/db';
import { BOOK_DATA } from './data/book_data';
import { BookOpen, Settings, Library } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import AIInspector from './components/AIInspector';
import LibraryModal from './components/LibraryModal';
import SettingsModal from './components/SettingsModal';

function App() {
  const { 
    currentBook, setCurrentBook, currentBookId,
    setLibraryOpen, setSettingsOpen, apiKey
  } = useStore();

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-bgSidebar border-b border-borderColor flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primaryGlow flex items-center justify-center text-white">
            <BookOpen size={18} />
          </div>
          <h1 className="font-semibold text-lg">Visual Reader</h1>
          {currentBook && (
            <span className="text-sm text-textMuted bg-white/5 px-2 py-1 rounded border border-white/10 ml-2 truncate max-w-xs">
              {currentBook.title}
            </span>
          )}
        </div>
        
        <div className="flex gap-3">
          <button onClick={() => setLibraryOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <Library size={14} /> Библиотека
          </button>
          <button 
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer ${apiKey ? 'border-accentEmerald/30 bg-accentEmerald/10 text-accentEmerald hover:bg-accentEmerald/20' : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
          >
            <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-accentEmerald' : 'bg-red-500'}`}></div>
            {apiKey ? 'API Key Active' : 'No API Key'}
          </button>
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <Settings size={14} /> Настройки
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Reader />
        <AIInspector />
      </div>

      {/* Modals */}
      <LibraryModal />
      <SettingsModal />
    </div>
  );
}

export default App;
