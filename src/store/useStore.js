import { create } from 'zustand';

export const DEFAULT_PROMPTS = {
  diagram: `You are a System Design expert. Your job is to produce a clean, valid Mermaid.js diagram depicting the concept, architecture, or workflow in the provided text.
CRITICAL RULES:
- Output ONLY the mermaid code inside a \`\`\`mermaid codeblock or plain mermaid syntax.
- Do NOT output explanations or preamble.
- Use flowchart TD, sequenceDiagram, or graph LR.
- Keep node labels short and concise (under 4 words).
- Make sure brackets and syntax are 100% valid mermaid syntax.`,

  analogy: `You are an expert system design educator who explains complex distributed systems concepts using intuitive everyday analogies.
Structure:
1. Краткая суть (1-2 предложения).
2. Наглядная аналогия из жизни (библиотека, ресторан, почта, склады и т.д.).
3. Главный вывод.
Max 150 words.`,

  summary: `You are a technical editor. Summarize the key architectural takeaway of the text in 3 crisp bullet points.`
};

const getSavedPrompts = () => {
  try {
    const saved = localStorage.getItem('ddia_custom_prompts');
    return saved ? { ...DEFAULT_PROMPTS, ...JSON.parse(saved) } : DEFAULT_PROMPTS;
  } catch {
    return DEFAULT_PROMPTS;
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

  activeChapterIdx: 0,
  activeSectionIdx: 0,
  setActiveChapter: (cIdx, sIdx = 0) => set({ activeChapterIdx: cIdx, activeSectionIdx: sIdx }),
  
  isAiLoading: false,
  setAiLoading: (loading) => set({ isAiLoading: loading }),

  aiResult: null,
  setAiResult: (result) => set({ aiResult: result }),

  isLibraryOpen: false,
  setLibraryOpen: (isOpen) => set({ isLibraryOpen: isOpen }),

  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
