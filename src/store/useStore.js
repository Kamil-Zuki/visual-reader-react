import { create } from 'zustand';
import {
  setStoreValue,
  getStoreValue,
  getAllPromptsFromDB,
  saveSystemPromptsToDB,
  saveCommandToDB,
  deleteCommandFromDB,
  resetSystemPromptsInDB,
  resetCustomCommandsInDB
} from '../utils/db';
import { clearEpubSearchCache } from '../utils/epubSearchIndex';
import { invalidateSearchCache } from '../utils/searchIndex';

export const useStore = create((set) => ({
  apiKey: '',
  setApiKey: (key) => {
    setStoreValue('openrouter_api_key', key);
    set({ apiKey: key });
  },

  model: 'openrouter/free',
  setModel: (model) => {
    setStoreValue('openrouter_model', model);
    set({ model });
  },

  language: 'ru',
  setLanguage: (lang) => {
    setStoreValue('ddia_language', lang);
    set({ language: lang });
  },

  // --- Prompts (Stored in DB) ---
  prompts: {},
  setPrompts: async (newPrompts) => {
    await saveSystemPromptsToDB(newPrompts);
    set({ prompts: newPrompts });
  },
  resetPrompts: async () => {
    const reset = await resetSystemPromptsInDB();
    set({ prompts: reset });
    return reset;
  },

  currentBook: null,
  currentBookId: '',
  setCurrentBook: (book, id) => {
    const bookId = id || book?.id || '';
    if (bookId) setStoreValue('ddia_active_book_id', bookId);
    else setStoreValue('ddia_active_book_id', '');
    set({ currentBook: book, currentBookId: bookId });
  },

  /** Текст текущей EPUB-страницы для AI-инспектора */
  epubReaderText: '',
  setEpubReaderText: (text) => set({ epubReaderText: text }),

  epubReaderTheme: 'dark',
  setEpubReaderTheme: (theme) => {
    setStoreValue('epub_reader_theme', theme);
    set({ epubReaderTheme: theme });
  },

  /** Последняя позиция CFI по bookId */
  epubLocations: {},
  setEpubLocation: (bookId, cfi) => {
    if (!bookId || !cfi) return;
    set((state) => {
      const epubLocations = { ...state.epubLocations, [bookId]: cfi };
      setStoreValue('epub_locations', epubLocations);
      return { epubLocations };
    });
  },

  /** Одноразово открыть EPUB на сохранённом CFI вместо начала оглавления */
  epubResumeBookId: null,
  requestEpubResume: (bookId) => set({ epubResumeBookId: bookId || null }),
  clearEpubResume: () => set({ epubResumeBookId: null }),

  /** Очистка прогресса и данных книги при удалении из библиотеки */
  purgeBookUserData: (bookId) => {
    if (!bookId) return;
    clearEpubSearchCache(bookId);
    invalidateSearchCache(bookId);
    set((state) => {
      const dropBookKey = (obj) => {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, bookId)) return obj;
        const next = { ...obj };
        delete next[bookId];
        return next;
      };
      const filterChat = { ...state.chatHistories };
      Object.keys(filterChat).forEach((k) => {
        if (k.startsWith(`${bookId}_`)) delete filterChat[k];
      });
      const filterQuiz = dropBookKey(state.quizResults);
      const epubLocations = { ...state.epubLocations };
      delete epubLocations[bookId];
      const readSections = dropBookKey(state.readSections);
      const bookmarks = dropBookKey(state.bookmarks);
      const highlights = dropBookKey(state.highlights);
      const flashcards = dropBookKey(state.flashcards);
      const glossary = dropBookKey(state.glossary);

      setStoreValue('epub_locations', epubLocations);
      setStoreValue('ddia_read_sections', readSections);
      setStoreValue('ddia_bookmarks', bookmarks);
      setStoreValue('ddia_highlights', highlights);
      setStoreValue('ddia_flashcards', flashcards);
      setStoreValue('ddia_glossary', glossary);
      setStoreValue('ddia_quiz_results', filterQuiz);
      setStoreValue('ddia_chat_histories', filterChat);

      const clearedActive = state.currentBookId === bookId;
      let currentBook = state.currentBook;
      let currentBookId = state.currentBookId;
      if (clearedActive) {
        currentBook = null;
        currentBookId = '';
        setStoreValue('ddia_active_book_id', '');
      }

      return {
        epubLocations,
        readSections,
        bookmarks,
        highlights,
        flashcards,
        glossary,
        quizResults: filterQuiz,
        chatHistories: filterChat,
        currentBook,
        currentBookId,
        epubReaderText: clearedActive ? '' : state.epubReaderText,
      };
    });
  },

  mobileTab: 'reader', // 'sidebar' | 'reader' | 'ai'
  setMobileTab: (tab) => set({ mobileTab: tab }),

  activeChapterIdx: 0,
  activeSectionIdx: 0,
  setActiveChapter: (cIdx, sIdx = 0) => set({ activeChapterIdx: cIdx, activeSectionIdx: sIdx, mobileTab: 'reader' }),

  pendingScrollHighlightId: null,
  setPendingScrollHighlightId: (id) => set({ pendingScrollHighlightId: id }),
  
  isAiLoading: false,
  setAiLoading: (loading) => set({ isAiLoading: loading }),

  aiResult: null,
  setAiResult: (result) => set({ aiResult: result }),

  // --- Custom Commands (Cached in LocalStorage, Synced via Supabase) ---
  customCommands: [],
  deletedCommands: {},
  addCustomCommand: async (command) => {
    const cmdWithTime = {
      ...command,
      createdAt: command.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await saveCommandToDB(cmdWithTime);
    set((state) => {
      const updatedDeleted = { ...(state.deletedCommands || {}) };
      delete updatedDeleted[cmdWithTime.id];
      setStoreValue('ddia_deleted_commands', updatedDeleted);
      return { 
        customCommands: [...state.customCommands.filter(c => c.id !== cmdWithTime.id), cmdWithTime],
        deletedCommands: updatedDeleted
      };
    });
  },
  updateCustomCommand: async (id, updatedFields) => {
    let updatedCmd = null;
    const current = useStore.getState().customCommands;
    const updated = current.map(c => {
      if (c.id === id) {
        updatedCmd = { ...c, ...updatedFields, updatedAt: Date.now() };
        return updatedCmd;
      }
      return c;
    });
    if (updatedCmd) await saveCommandToDB(updatedCmd);
    set({ customCommands: updated });
  },
  deleteCustomCommand: async (id) => {
    await deleteCommandFromDB(id);
    set((state) => {
      const updatedDeleted = { ...(state.deletedCommands || {}), [id]: Date.now() };
      setStoreValue('ddia_deleted_commands', updatedDeleted);
      return { 
        customCommands: state.customCommands.filter(c => c.id !== id),
        deletedCommands: updatedDeleted
      };
    });
  },
  resetCustomCommands: async () => {
    const resetList = await resetCustomCommandsInDB();
    setStoreValue('ddia_deleted_commands', {});
    set({ customCommands: resetList, deletedCommands: {} });
    return resetList;
  },

  // --- Reading Progress (Per Book) ---
  readSections: {},
  unmarkedSections: {},
  markSectionAsRead: (bookId, sectionId) => set((state) => {
    const bookRead = state.readSections[bookId] || [];
    if (bookRead.includes(sectionId)) return state;
    const updated = { ...state.readSections, [bookId]: [...bookRead, sectionId] };
    const updatedUnmarked = { ...(state.unmarkedSections || {}) };
    delete updatedUnmarked[`${bookId}__${sectionId}`];
    setStoreValue('ddia_read_sections', updated);
    setStoreValue('ddia_unmarked_sections', updatedUnmarked);
    // Log reading activity for today
    const today = new Date().toISOString().slice(0, 10);
    const currentLog = useStore.getState().readingLog || {};
    const updatedLog = { ...currentLog, [today]: (currentLog[today] || 0) + 1 };
    setStoreValue('ddia_reading_log', updatedLog);
    return { readSections: updated, unmarkedSections: updatedUnmarked, readingLog: updatedLog };
  }),
  unmarkSectionAsRead: (bookId, sectionId) => set((state) => {
    const bookRead = state.readSections[bookId] || [];
    const updated = { ...state.readSections, [bookId]: bookRead.filter(id => id !== sectionId) };
    const updatedUnmarked = { ...(state.unmarkedSections || {}), [`${bookId}__${sectionId}`]: Date.now() };
    setStoreValue('ddia_read_sections', updated);
    setStoreValue('ddia_unmarked_sections', updatedUnmarked);
    return { readSections: updated, unmarkedSections: updatedUnmarked };
  }),

  // --- Bookmarks (Per Book) ---
  bookmarks: {},
  deletedBookmarks: {},
  addBookmark: (bookId, bookmark) => set((state) => {
    const bookBookmarks = state.bookmarks[bookId] || [];
    const updated = { ...state.bookmarks, [bookId]: [...bookBookmarks, bookmark] };
    const updatedDeleted = { ...(state.deletedBookmarks || {}) };
    const bKey = bookmark.id || `${bookmark.chapterIdx}_${bookmark.sectionIdx}`;
    delete updatedDeleted[bKey];
    setStoreValue('ddia_bookmarks', updated);
    setStoreValue('ddia_deleted_bookmarks', updatedDeleted);
    return { bookmarks: updated, deletedBookmarks: updatedDeleted };
  }),
  removeBookmark: (bookId, bookmarkId) => set((state) => {
    const bookBookmarks = state.bookmarks[bookId] || [];
    const target = bookBookmarks.find(b => b.id === bookmarkId || `${b.chapterIdx}_${b.sectionIdx}` === bookmarkId);
    const bKey = bookmarkId || (target ? `${target.chapterIdx}_${target.sectionIdx}` : bookmarkId);
    const updated = { ...state.bookmarks, [bookId]: bookBookmarks.filter(b => b.id !== bookmarkId && `${b.chapterIdx}_${b.sectionIdx}` !== bookmarkId) };
    const updatedDeleted = { ...(state.deletedBookmarks || {}), [bKey]: Date.now() };
    setStoreValue('ddia_bookmarks', updated);
    setStoreValue('ddia_deleted_bookmarks', updatedDeleted);
    return { bookmarks: updated, deletedBookmarks: updatedDeleted };
  }),

  // --- Highlights (Per Book) ---
  highlights: {},
  deletedHighlights: {},
  addHighlight: (bookId, highlight) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updated = { ...state.highlights, [bookId]: [...bookHighlights, highlight] };
    const updatedDeleted = { ...(state.deletedHighlights || {}) };
    delete updatedDeleted[highlight.id];
    setStoreValue('ddia_highlights', updated);
    setStoreValue('ddia_deleted_highlights', updatedDeleted);
    return { highlights: updated, deletedHighlights: updatedDeleted };
  }),
  removeHighlight: (bookId, highlightId) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updated = { ...state.highlights, [bookId]: bookHighlights.filter(h => h.id !== highlightId) };
    const updatedDeleted = { ...(state.deletedHighlights || {}), [highlightId]: Date.now() };
    setStoreValue('ddia_highlights', updated);
    setStoreValue('ddia_deleted_highlights', updatedDeleted);
    return { highlights: updated, deletedHighlights: updatedDeleted };
  }),
  updateHighlightNote: (bookId, highlightId, note) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updatedList = bookHighlights.map(h => h.id === highlightId ? { ...h, note, updatedAt: Date.now() } : h);
    const updated = { ...state.highlights, [bookId]: updatedList };
    setStoreValue('ddia_highlights', updated);
    return { highlights: updated };
  }),

  isLibraryOpen: false,
  setLibraryOpen: (isOpen) => set({ isLibraryOpen: isOpen }),

  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  isNotesOpen: false,
  setNotesOpen: (isOpen) => set({ isNotesOpen: isOpen }),

  isGraphOpen: false,
  setGraphOpen: (isOpen) => set({ isGraphOpen: isOpen }),

  // --- Full-text Book Search ---
  isSearchOpen: false,
  setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
  pendingSearchScroll: null,
  setPendingSearchScroll: (scrollData) => set({ pendingSearchScroll: scrollData }),

  // --- AI Inspector Mode & Chat Histories ---
  aiInspectorTab: 'cards', // 'cards' | 'chat'
  setAiInspectorTab: (tab) => set({ aiInspectorTab: tab }),
  chatHistories: {}, // key: `${bookId}_${cIdx}_${sIdx}` -> array of { id, role, content, timestamp }
  addChatMessage: (key, message) => set((state) => {
    const list = state.chatHistories[key] || [];
    const updated = { ...state.chatHistories, [key]: [...list, message] };
    setStoreValue('ddia_chat_histories', updated);
    return { chatHistories: updated };
  }),
  clearChatHistory: (key) => set((state) => {
    const updated = { ...state.chatHistories };
    delete updated[key];
    setStoreValue('ddia_chat_histories', updated);
    return { chatHistories: updated };
  }),

  // --- Quiz / Self-Test (Phase 2.1) ---
  isQuizOpen: false,
  setQuizOpen: (isOpen) => set({ isQuizOpen: isOpen }),
  quizTargetSection: null, // { chapterIdx, sectionIdx, title, text }
  setQuizTargetSection: (sec) => set({ quizTargetSection: sec }),
  quizResults: {}, // { [bookId]: { [sectionId]: { score, total, percentage, timestamp } } }
  saveQuizResult: (bookId, sectionId, result) => set((state) => {
    const bookResults = state.quizResults[bookId] || {};
    const updated = {
      ...state.quizResults,
      [bookId]: { ...bookResults, [sectionId]: result }
    };
    setStoreValue('ddia_quiz_results', updated);
    return { quizResults: updated };
  }),

  // --- Flashcards / Spaced Repetition (Phase 2.2) ---
  isFlashcardsOpen: false,
  setFlashcardsOpen: (isOpen) => set({ isFlashcardsOpen: isOpen }),
  flashcardModalTab: 'review', // 'review' | 'all' | 'create'
  setFlashcardModalTab: (tab) => set({ flashcardModalTab: tab }),
  flashcards: {}, // { [bookId]: [ ...cards ] }
  addFlashcard: (bookId, card) => set((state) => {
    const list = state.flashcards[bookId] || [];
    const newCard = {
      id: card.id || 'fc_' + Date.now(),
      front: card.front || '',
      back: card.back || '',
      sourceText: card.sourceText || '',
      chapterIdx: card.chapterIdx ?? 0,
      sectionIdx: card.sectionIdx ?? 0,
      sectionTitle: card.sectionTitle || '',
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: Date.now(),
      lastReviewed: null,
      createdAt: Date.now(),
      ...card
    };
    const updated = { ...state.flashcards, [bookId]: [newCard, ...list.filter(c => c.id !== newCard.id)] };
    setStoreValue('ddia_flashcards', updated);
    return { flashcards: updated };
  }),
  updateFlashcard: (bookId, cardId, fields) => set((state) => {
    const list = state.flashcards[bookId] || [];
    const updatedList = list.map(c => c.id === cardId ? { ...c, ...fields, updatedAt: Date.now() } : c);
    const updated = { ...state.flashcards, [bookId]: updatedList };
    setStoreValue('ddia_flashcards', updated);
    return { flashcards: updated };
  }),
  deleteFlashcard: (bookId, cardId) => set((state) => {
    const list = state.flashcards[bookId] || [];
    const updated = { ...state.flashcards, [bookId]: list.filter(c => c.id !== cardId) };
    setStoreValue('ddia_flashcards', updated);
    return { flashcards: updated };
  }),
  reviewFlashcard: (bookId, cardId, rating) => set((state) => {
    const list = state.flashcards[bookId] || [];
    const updatedList = list.map((card) => {
      if (card.id !== cardId) return card;
      let { repetitions = 0, interval = 1, easeFactor = 2.5 } = card;

      if (rating < 2) {
        // Again / Fail
        repetitions = 0;
        interval = 1;
      } else {
        // Hard, Good, Easy (ratings 2, 3, 4)
        repetitions += 1;
        if (repetitions === 1) {
          interval = 1;
        } else if (repetitions === 2) {
          interval = 3;
        } else {
          interval = Math.max(1, Math.round(interval * easeFactor));
        }
        easeFactor = Math.max(1.3, easeFactor + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02)));
      }

      const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;
      return {
        ...card,
        repetitions,
        interval,
        easeFactor,
        nextReviewDate,
        lastReviewed: Date.now()
      };
    });
    const updated = { ...state.flashcards, [bookId]: updatedList };
    setStoreValue('ddia_flashcards', updated);
    return { flashcards: updated };
  }),

  // --- Saved AI Cards (Phase 3.1) ---
  savedCards: [],
  deletedCards: {}, // { [id]: timestamp }
  addSavedCard: (card) => set((state) => {
    const cardWithTime = { ...card, updatedAt: card.updatedAt || Date.now() };
    const updatedDeleted = { ...(state.deletedCards || {}) };
    delete updatedDeleted[cardWithTime.id];
    const updated = [cardWithTime, ...state.savedCards.filter(c => c.id !== cardWithTime.id)];
    setStoreValue('ddia_saved_cards', updated);
    setStoreValue('ddia_deleted_cards', updatedDeleted);
    return { savedCards: updated, deletedCards: updatedDeleted };
  }),
  deleteSavedCard: (id) => set((state) => {
    const updated = state.savedCards.filter(c => c.id !== id);
    const updatedDeleted = { ...(state.deletedCards || {}), [id]: Date.now() };
    setStoreValue('ddia_saved_cards', updated);
    setStoreValue('ddia_deleted_cards', updatedDeleted);
    return { savedCards: updated, deletedCards: updatedDeleted };
  }),
  clearSavedCards: () => set(() => {
    setStoreValue('ddia_saved_cards', []);
    return { savedCards: [] };
  }),
  updateSavedCard: (id, fields) => set((state) => {
    const updated = state.savedCards.map(c => c.id === id ? { ...c, ...fields, updatedAt: Date.now() } : c);
    setStoreValue('ddia_saved_cards', updated);
    return { savedCards: updated };
  }),

  // --- Reading Activity Log (Phase 3.2) ---
  readingLog: {}, // { 'YYYY-MM-DD': count }
  logReadingActivity: (date) => set((state) => {
    const key = date || new Date().toISOString().slice(0, 10);
    const updated = { ...state.readingLog, [key]: (state.readingLog[key] || 0) + 1 };
    setStoreValue('ddia_reading_log', updated);
    return { readingLog: updated };
  }),

  // --- Stats Modal ---
  isStatsOpen: false,
  setStatsOpen: (isOpen) => set({ isStatsOpen: isOpen }),

  // --- Glossary (Phase 2.3) ---
  isGlossaryOpen: false,
  setGlossaryOpen: (isOpen) => set({ isGlossaryOpen: isOpen }),
  glossary: {}, // { [bookId]: [ ...terms ] }
  addGlossaryTerm: (bookId, termItem) => set((state) => {
    const list = state.glossary[bookId] || [];
    const newTerm = {
      id: termItem.id || 'term_' + Date.now(),
      term: termItem.term || '',
      definition: termItem.definition || '',
      chapterIdx: termItem.chapterIdx ?? 0,
      sectionIdx: termItem.sectionIdx ?? 0,
      sectionTitle: termItem.sectionTitle || '',
      createdAt: Date.now(),
      ...termItem
    };
    const filtered = list.filter(t => t.term.toLowerCase() !== newTerm.term.toLowerCase() && t.id !== newTerm.id);
    const updated = { ...state.glossary, [bookId]: [newTerm, ...filtered] };
    setStoreValue('ddia_glossary', updated);
    return { glossary: updated };
  }),
  updateGlossaryTerm: (bookId, termId, fields) => set((state) => {
    const list = state.glossary[bookId] || [];
    const updatedList = list.map(t => t.id === termId ? { ...t, ...fields, updatedAt: Date.now() } : t);
    const updated = { ...state.glossary, [bookId]: updatedList };
    setStoreValue('ddia_glossary', updated);
    return { glossary: updated };
  }),
  deleteGlossaryTerm: (bookId, termId) => set((state) => {
    const list = state.glossary[bookId] || [];
    const updated = { ...state.glossary, [bookId]: list.filter(t => t.id !== termId) };
    setStoreValue('ddia_glossary', updated);
    return { glossary: updated };
  }),

  // --- Supabase Cloud Sync State ---
  isSyncModalOpen: false,
  setSyncModalOpen: (isOpen) => set({ isSyncModalOpen: isOpen }),
  syncStatus: 'disconnected', // 'disconnected' | 'connecting' | 'synced' | 'syncing' | 'error'
  connectedPeers: [],
  lastSyncedAt: null,
  syncSettings: {
    enabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    syncKey: '',
    deviceName: ''
  },
  setSyncSettings: (newSettings) => set((state) => {
    const merged = { ...state.syncSettings, ...newSettings };
    setStoreValue('supabase_sync_settings', merged);
    return { syncSettings: merged };
  }),

  // Desktop Panels Visibility & Widths
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => {
    const next = !state.isSidebarOpen;
    setStoreValue('ddia_sidebar_open', next);
    return { isSidebarOpen: next };
  }),
  setSidebarOpen: (isOpen) => {
    setStoreValue('ddia_sidebar_open', isOpen);
    set({ isSidebarOpen: isOpen });
  },

  isInspectorOpen: true,
  toggleInspector: () => set((state) => {
    const next = !state.isInspectorOpen;
    setStoreValue('ddia_inspector_open', next);
    return { isInspectorOpen: next };
  }),
  setInspectorOpen: (isOpen) => {
    setStoreValue('ddia_inspector_open', isOpen);
    set({ isInspectorOpen: isOpen });
  },

  sidebarWidth: 300,
  setSidebarWidth: (width) => {
    const clamped = Math.max(180, Math.min(600, width));
    setStoreValue('ddia_sidebar_width', clamped);
    set({ sidebarWidth: clamped });
  },

  inspectorWidth: 420,
  setInspectorWidth: (width) => {
    const clamped = Math.max(280, Math.min(750, width));
    setStoreValue('ddia_inspector_width', clamped);
    set({ inspectorWidth: clamped });
  },
}));

export async function initStoreFromDB() {
  const [
    apiKey, model, language, promptsData, activeBookId,
    readSections, bookmarks, highlights,
    deletedHighlights, deletedBookmarks, unmarkedSections,
    deletedCommands,
    sidebarOpen, inspectorOpen, sidebarWidth, inspectorWidth,
    supabaseSyncSettings, p2pSyncSettings,
    chatHistories,
    quizResults,
    flashcards,
    glossary,
    savedCards,
    deletedCards,
    readingLog,
    epubLocations,
    epubReaderTheme
  ] = await Promise.all([
    getStoreValue('openrouter_api_key', ''),
    getStoreValue('openrouter_model', 'openrouter/free'),
    getStoreValue('ddia_language', 'ru'),
    getAllPromptsFromDB(),
    getStoreValue('ddia_active_book_id', ''),
    getStoreValue('ddia_read_sections', {}),
    getStoreValue('ddia_bookmarks', {}),
    getStoreValue('ddia_highlights', {}),
    getStoreValue('ddia_deleted_highlights', {}),
    getStoreValue('ddia_deleted_bookmarks', {}),
    getStoreValue('ddia_unmarked_sections', {}),
    getStoreValue('ddia_deleted_commands', {}),
    getStoreValue('ddia_sidebar_open', true),
    getStoreValue('ddia_inspector_open', true),
    getStoreValue('ddia_sidebar_width', 300),
    getStoreValue('ddia_inspector_width', 420),
    getStoreValue('supabase_sync_settings', null),
    getStoreValue('p2p_sync_settings', null),
    getStoreValue('ddia_chat_histories', {}),
    getStoreValue('ddia_quiz_results', {}),
    getStoreValue('ddia_flashcards', {}),
    getStoreValue('ddia_glossary', {}),
    getStoreValue('ddia_saved_cards', []),
    getStoreValue('ddia_deleted_cards', {}),
    getStoreValue('ddia_reading_log', {}),
    getStoreValue('epub_locations', {}),
    getStoreValue('epub_reader_theme', 'dark')
  ]);

  const defaultSyncSettings = {
    enabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    syncKey: '',
    deviceName: ''
  };

  let resolvedSyncSettings = supabaseSyncSettings;
  if (!resolvedSyncSettings) {
    if (p2pSyncSettings) {
      resolvedSyncSettings = {
        ...defaultSyncSettings,
        deviceName: p2pSyncSettings.deviceName || ''
      };
    } else {
      resolvedSyncSettings = defaultSyncSettings;
    }
  }

  useStore.setState({
    apiKey, model, language, 
    prompts: promptsData?.systemPrompts || {},
    customCommands: promptsData?.customCommands || [],
    deletedCommands: deletedCommands || {},
    currentBookId: activeBookId,
    readSections, bookmarks, highlights,
    deletedHighlights: deletedHighlights || {},
    deletedBookmarks: deletedBookmarks || {},
    unmarkedSections: unmarkedSections || {},
    isSidebarOpen: sidebarOpen !== false && sidebarOpen !== 'false',
    isInspectorOpen: inspectorOpen !== false && inspectorOpen !== 'false',
    sidebarWidth: parseInt(sidebarWidth, 10) || 300,
    inspectorWidth: parseInt(inspectorWidth, 10) || 420,
    syncSettings: resolvedSyncSettings,
    chatHistories: chatHistories || {},
    quizResults: quizResults || {},
    flashcards: flashcards || {},
    glossary: glossary || {},
    savedCards: Array.isArray(savedCards) ? savedCards : [],
    deletedCards: deletedCards || {},
    readingLog: readingLog || {},
    epubLocations: epubLocations || {},
    epubReaderTheme:
      ['dark', 'light', 'sepia', 'book'].includes(epubReaderTheme) ? epubReaderTheme : 'dark',
  });

  // Migrate old localStorage-only saved cards if the store is empty
  try {
    const migrateRaw = localStorage.getItem('ddia_saved_cards');
    if (migrateRaw) {
      const migrated = JSON.parse(migrateRaw);
      if (Array.isArray(migrated) && migrated.length > 0 && useStore.getState().savedCards.length === 0) {
        const withTime = migrated.map(c => ({ ...c, updatedAt: c.updatedAt || Date.now() }));
        setStoreValue('ddia_saved_cards', withTime);
        useStore.setState({ savedCards: withTime });
        localStorage.removeItem('ddia_saved_cards');
      }
    }
  } catch (_) { /* ignore */ }
}

