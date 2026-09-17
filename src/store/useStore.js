import { create } from 'zustand';

export const useStore = create((set) => ({
  apiKey: localStorage.getItem('openrouter_api_key') || '',
  setApiKey: (key) => {
    localStorage.setItem('openrouter_api_key', key);
    set({ apiKey: key });
  },

  model: localStorage.getItem('openrouter_model') || 'openrouter/free',
  setModel: (model) => {
    localStorage.setItem('openrouter_model', model);
    set({ model });
  },

  currentBook: null,
  currentBookId: localStorage.getItem('ddia_active_book_id') || 'default_ddia',
  setCurrentBook: (book, id) => {
    if (id) localStorage.setItem('ddia_active_book_id', id);
    set({ currentBook: book, currentBookId: id || 'default_ddia' });
  },

  activeChapterIdx: 0,
  activeSectionIdx: 0,
  setActiveChapter: (cIdx, sIdx = 0) => set({ activeChapterIdx: cIdx, activeSectionIdx: sIdx }),
  
  isAiLoading: false,
  setAiLoading: (loading) => set({ isAiLoading: loading }),

  aiResult: null,
  setAiResult: (result) => set({ aiResult: result }), // { type: 'diagram' | 'analogy', content: '...', title: '...' }

  isLibraryOpen: false,
  setLibraryOpen: (isOpen) => set({ isLibraryOpen: isOpen }),

  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
