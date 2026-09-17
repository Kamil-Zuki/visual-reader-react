import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { openDB, getAllBooksFromDB, getBookByIdFromDB, saveBookToDB } from './utils/db';
import { BOOK_DATA } from './data/book_data';
import { BookOpen, Settings, Library } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import AIInspector from './components/AIInspector';
// import LibraryModal from './components/LibraryModal';
// import SettingsModal from './components/SettingsModal';

function App() {
  const { 
    currentBook, setCurrentBook, currentBookId,
    setLibraryOpen, setSettingsOpen, apiKey
  } = useStore();

  useEffect(() => {
    const initApp = async () => {
      await openDB();
      const books = await getAllBooksFromDB();
      
      let defaultExists = books.find(b => b.id === 'default_ddia');
      if (!defaultExists) {
        console.log('Loading default DDIA book into DB...');
        await saveBookToDB({
          id: 'default_ddia',
          title: 'DDIA (Martin Kleppmann)',
          structure: BOOK_DATA.structure
        });
      }

      if (currentBookId) {
        const book = await getBookByIdFromDB(currentBookId);
        if (book) {
          setCurrentBook(book, book.id);
        } else {
          const defaultBook = await getBookByIdFromDB('default_ddia');
          setCurrentBook(defaultBook, 'default_ddia');
        }
      }
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
          <div className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${apiKey ? 'border-accentEmerald/30 bg-accentEmerald/10 text-accentEmerald' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-accentEmerald' : 'bg-red-500'}`}></div>
            {apiKey ? 'API Key Active' : 'No API Key'}
          </div>
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
      {/* <LibraryModal /> */}
      {/* <SettingsModal /> */}
    </div>
  );
}

export default App;
