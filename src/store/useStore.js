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
  currentBookId: 'default_ddia',
  setCurrentBook: (book, id) => {
    if (id) setStoreValue('ddia_active_book_id', id);
    set({ currentBook: book, currentBookId: id || 'default_ddia' });
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
    return { readSections: updated, unmarkedSections: updatedUnmarked };
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
    supabaseSyncSettings, p2pSyncSettings
  ] = await Promise.all([
    getStoreValue('openrouter_api_key', ''),
    getStoreValue('openrouter_model', 'openrouter/free'),
    getStoreValue('ddia_language', 'ru'),
    getAllPromptsFromDB(),
    getStoreValue('ddia_active_book_id', 'default_ddia'),
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
    getStoreValue('p2p_sync_settings', null)
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
    syncSettings: resolvedSyncSettings
  });
}

