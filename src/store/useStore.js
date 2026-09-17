import { create } from 'zustand';

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

const getSavedPrompts = () => {
  try {
    const saved = localStorage.getItem('ddia_custom_prompts');
    return saved ? { ...DEFAULT_PROMPTS, ...JSON.parse(saved) } : DEFAULT_PROMPTS;
  } catch {
    return DEFAULT_PROMPTS;
  }
};

const getSavedCommands = () => {
  try {
    const saved = localStorage.getItem('ddia_custom_commands');
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_COMMANDS;
  } catch {
    return DEFAULT_CUSTOM_COMMANDS;
  }
};

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

  language: localStorage.getItem('ddia_language') || 'ru',
  setLanguage: (lang) => {
    localStorage.setItem('ddia_language', lang);
    set({ language: lang });
  },

  prompts: getSavedPrompts(),
  setPrompts: (newPrompts) => {
    localStorage.setItem('ddia_custom_prompts', JSON.stringify(newPrompts));
    set({ prompts: newPrompts });
  },
  resetPrompts: () => {
    localStorage.setItem('ddia_custom_prompts', JSON.stringify(DEFAULT_PROMPTS));
    set({ prompts: { ...DEFAULT_PROMPTS } });
  },

  currentBook: null,
  currentBookId: localStorage.getItem('ddia_active_book_id') || 'default_ddia',
  setCurrentBook: (book, id) => {
    if (id) localStorage.setItem('ddia_active_book_id', id);
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

  customCommands: getSavedCommands(),
  addCustomCommand: (command) => set((state) => {
    const updated = [...state.customCommands, command];
    localStorage.setItem('ddia_custom_commands', JSON.stringify(updated));
    return { customCommands: updated };
  }),
  updateCustomCommand: (id, updatedFields) => set((state) => {
    const updated = state.customCommands.map(c => c.id === id ? { ...c, ...updatedFields } : c);
    localStorage.setItem('ddia_custom_commands', JSON.stringify(updated));
    return { customCommands: updated };
  }),
  deleteCustomCommand: (id) => set((state) => {
    const updated = state.customCommands.filter(c => c.id !== id);
    localStorage.setItem('ddia_custom_commands', JSON.stringify(updated));
    return { customCommands: updated };
  }),
  resetCustomCommands: () => {
    localStorage.setItem('ddia_custom_commands', JSON.stringify(DEFAULT_CUSTOM_COMMANDS));
    set({ customCommands: [...DEFAULT_CUSTOM_COMMANDS] });
  },

  isLibraryOpen: false,
  setLibraryOpen: (isOpen) => set({ isLibraryOpen: isOpen }),

  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
