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

  // --- Custom Commands (Stored in DB) ---
  customCommands: [],
  addCustomCommand: async (command) => {
    await saveCommandToDB(command);
    set((state) => ({ customCommands: [...state.customCommands, command] }));
  },
  updateCustomCommand: async (id, updatedFields) => {
    let updatedCmd = null;
    const current = useStore.getState().customCommands;
    const updated = current.map(c => {
      if (c.id === id) {
        updatedCmd = { ...c, ...updatedFields };
        return updatedCmd;
      }
      return c;
    });
    if (updatedCmd) await saveCommandToDB(updatedCmd);
    set({ customCommands: updated });
  },
  deleteCustomCommand: async (id) => {
    await deleteCommandFromDB(id);
    set((state) => ({ customCommands: state.customCommands.filter(c => c.id !== id) }));
  },
  resetCustomCommands: async () => {
    const resetList = await resetCustomCommandsInDB();
    set({ customCommands: resetList });
    return resetList;
  },

  // --- Reading Progress (Per Book) ---
  readSections: {},
  markSectionAsRead: (bookId, sectionId) => set((state) => {
    const bookRead = state.readSections[bookId] || [];
    if (bookRead.includes(sectionId)) return state;
    const updated = { ...state.readSections, [bookId]: [...bookRead, sectionId] };
    setStoreValue('ddia_read_sections', updated);
    return { readSections: updated };
  }),
  unmarkSectionAsRead: (bookId, sectionId) => set((state) => {
    const bookRead = state.readSections[bookId] || [];
    const updated = { ...state.readSections, [bookId]: bookRead.filter(id => id !== sectionId) };
    setStoreValue('ddia_read_sections', updated);
    return { readSections: updated };
  }),

  // --- Bookmarks (Per Book) ---
  bookmarks: {},
  addBookmark: (bookId, bookmark) => set((state) => {
    const bookBookmarks = state.bookmarks[bookId] || [];
    const updated = { ...state.bookmarks, [bookId]: [...bookBookmarks, bookmark] };
    setStoreValue('ddia_bookmarks', updated);
    return { bookmarks: updated };
  }),
  removeBookmark: (bookId, bookmarkId) => set((state) => {
    const bookBookmarks = state.bookmarks[bookId] || [];
    const updated = { ...state.bookmarks, [bookId]: bookBookmarks.filter(b => b.id !== bookmarkId) };
    setStoreValue('ddia_bookmarks', updated);
    return { bookmarks: updated };
  }),

  // --- Highlights (Per Book) ---
  highlights: {},
  addHighlight: (bookId, highlight) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updated = { ...state.highlights, [bookId]: [...bookHighlights, highlight] };
    setStoreValue('ddia_highlights', updated);
    return { highlights: updated };
  }),
  removeHighlight: (bookId, highlightId) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updated = { ...state.highlights, [bookId]: bookHighlights.filter(h => h.id !== highlightId) };
    setStoreValue('ddia_highlights', updated);
    return { highlights: updated };
  }),
  updateHighlightNote: (bookId, highlightId, note) => set((state) => {
    const bookHighlights = state.highlights[bookId] || [];
    const updatedList = bookHighlights.map(h => h.id === highlightId ? { ...h, note } : h);
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
    currentBookId: activeBookId,
    readSections, bookmarks, highlights,
    isSidebarOpen: sidebarOpen !== false && sidebarOpen !== 'false',
    isInspectorOpen: inspectorOpen !== false && inspectorOpen !== 'false',
    sidebarWidth: parseInt(sidebarWidth, 10) || 300,
    inspectorWidth: parseInt(inspectorWidth, 10) || 420,
    syncSettings: resolvedSyncSettings
  });
}

