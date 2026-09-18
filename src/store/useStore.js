import { create } from 'zustand';
import { setStoreValue, getStoreValue } from '../utils/db';

export const DEFAULT_PROMPTS = {
  diagram: `You are an expert visual communicator and diagram designer. Your job is to produce a clean, valid Mermaid.js diagram depicting the concept, process, workflow, or architecture in the provided text.
CRITICAL RULES:
- Output ONLY the mermaid code inside a \`\`\`mermaid codeblock or plain mermaid syntax.
- Do NOT output explanations or preamble.
- Use flowchart TD, sequenceDiagram, or graph LR.
- Keep node labels short and concise (under 4 words).
- Make sure brackets and syntax are 100% valid mermaid syntax.`,

  analogy: `You are an expert educator who explains complex ideas and concepts using intuitive everyday analogies.
Structure:
1. Краткая суть (1-2 предложения).
2. Наглядная аналогия из жизни.
3. Главный вывод.
Max 150 words.`,

  summary: `You are an editor. Summarize the key takeaways and ideas of the text in 3 crisp bullet points.`
};

export const DEFAULT_CUSTOM_COMMANDS = [
  {
    id: 'cmd_interview',
    title: 'Вопросы к тексту',
    icon: '🎯',
    type: 'text',
    prompt: 'Formulate 3 insightful, thought-provoking questions based on the key concepts in this text, with brief answers or hints.'
  },
  {
    id: 'cmd_eli5',
    title: 'Объясни как в 5 лет',
    icon: '🧸',
    type: 'text',
    prompt: 'Explain the core idea of the selected text in extremely simple, friendly terms suitable for a child, using a fun everyday analogy.'
  },
  {
    id: 'cmd_critique',
    title: 'Критика и риски',
    icon: '⚠️',
    type: 'text',
    prompt: 'Identify the main weaknesses, limitations, edge cases, or potential trade-offs and risks of the ideas described in the text.'
  }
];

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

  prompts: DEFAULT_PROMPTS,
  setPrompts: (newPrompts) => {
    setStoreValue('ddia_custom_prompts', newPrompts);
    set({ prompts: newPrompts });
  },
  resetPrompts: () => {
    setStoreValue('ddia_custom_prompts', DEFAULT_PROMPTS);
    set({ prompts: { ...DEFAULT_PROMPTS } });
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
  
  isAiLoading: false,
  setAiLoading: (loading) => set({ isAiLoading: loading }),

  aiResult: null,
  setAiResult: (result) => set({ aiResult: result }),

  customCommands: DEFAULT_CUSTOM_COMMANDS,
  addCustomCommand: (command) => set((state) => {
    const updated = [...state.customCommands, command];
    setStoreValue('ddia_custom_commands', updated);
    return { customCommands: updated };
  }),
  updateCustomCommand: (id, updatedFields) => set((state) => {
    const updated = state.customCommands.map(c => c.id === id ? { ...c, ...updatedFields } : c);
    setStoreValue('ddia_custom_commands', updated);
    return { customCommands: updated };
  }),
  deleteCustomCommand: (id) => set((state) => {
    const updated = state.customCommands.filter(c => c.id !== id);
    setStoreValue('ddia_custom_commands', updated);
    return { customCommands: updated };
  }),
  resetCustomCommands: () => {
    setStoreValue('ddia_custom_commands', DEFAULT_CUSTOM_COMMANDS);
    set({ customCommands: [...DEFAULT_CUSTOM_COMMANDS] });
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

  // --- P2P WebRTC / Yjs Sync State ---
  isSyncModalOpen: false,
  setSyncModalOpen: (isOpen) => set({ isSyncModalOpen: isOpen }),
  syncStatus: 'disconnected', // 'disconnected' | 'searching' | 'connected'
  connectedPeers: [],
  lastSyncedAt: null,
  syncSettings: {
    enabled: false,
    roomId: '',
    password: '',
    deviceName: ''
  },
  setSyncSettings: (newSettings) => set((state) => {
    const merged = { ...state.syncSettings, ...newSettings };
    setStoreValue('p2p_sync_settings', merged);
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
    apiKey, model, language, prompts, customCommands, activeBookId,
    readSections, bookmarks, highlights,
    sidebarOpen, inspectorOpen, sidebarWidth, inspectorWidth,
    syncSettings
  ] = await Promise.all([
    getStoreValue('openrouter_api_key', ''),
    getStoreValue('openrouter_model', 'openrouter/free'),
    getStoreValue('ddia_language', 'ru'),
    getStoreValue('ddia_custom_prompts', DEFAULT_PROMPTS),
    getStoreValue('ddia_custom_commands', DEFAULT_CUSTOM_COMMANDS),
    getStoreValue('ddia_active_book_id', 'default_ddia'),
    getStoreValue('ddia_read_sections', {}),
    getStoreValue('ddia_bookmarks', {}),
    getStoreValue('ddia_highlights', {}),
    getStoreValue('ddia_sidebar_open', true),
    getStoreValue('ddia_inspector_open', true),
    getStoreValue('ddia_sidebar_width', 300),
    getStoreValue('ddia_inspector_width', 420),
    getStoreValue('p2p_sync_settings', {
      enabled: false,
      roomId: '',
      password: '',
      deviceName: ''
    }),
  ]);

  useStore.setState({
    apiKey, model, language, 
    prompts: { ...DEFAULT_PROMPTS, ...prompts },
    customCommands, currentBookId: activeBookId,
    readSections, bookmarks, highlights,
    isSidebarOpen: sidebarOpen !== false && sidebarOpen !== 'false',
    isInspectorOpen: inspectorOpen !== false && inspectorOpen !== 'false',
    sidebarWidth: parseInt(sidebarWidth, 10) || 300,
    inspectorWidth: parseInt(inspectorWidth, 10) || 420,
    syncSettings: syncSettings || { enabled: false, roomId: '', password: '', deviceName: '' }
  });
}

