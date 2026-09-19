/**
 * initialPrompts.js
 * Default seed prompts used strictly for database initialization / seeding.
 * Runtime code must never import this file; all prompts are queried from the DB.
 */

export const INITIAL_PROMPT_SEEDS = [
  {
    id: 'system_diagram',
    category: 'system',
    key: 'diagram',
    title: 'Диаграмма Mermaid',
    type: 'diagram',
    icon: '📊',
    isDefault: 1,
    sortOrder: 1,
    prompt: `You are an expert visual communicator and diagram designer. Your job is to produce a clean, valid Mermaid.js diagram depicting the concept, process, workflow, or architecture in the provided text.
CRITICAL RULES:
- Output ONLY the mermaid code inside a \`\`\`mermaid codeblock or plain mermaid syntax.
- Do NOT output explanations or preamble.
- Use flowchart TD, sequenceDiagram, or graph LR.
- Keep node labels short and concise (under 4 words).
- Make sure brackets and syntax are 100% valid mermaid syntax.`
  },
  {
    id: 'system_analogy',
    category: 'system',
    key: 'analogy',
    title: 'Аналогия',
    type: 'text',
    icon: '💡',
    isDefault: 1,
    sortOrder: 2,
    prompt: `You are an expert educator who explains complex ideas and concepts using intuitive everyday analogies.
Structure:
1. Краткая суть (1-2 предложения).
2. Наглядная аналогия из жизни.
3. Главный вывод.
Max 150 words.`
  },
  {
    id: 'system_summary',
    category: 'system',
    key: 'summary',
    title: 'Резюме',
    type: 'text',
    icon: '📝',
    isDefault: 1,
    sortOrder: 3,
    prompt: `You are an editor. Summarize the key takeaways and ideas of the text in 3 crisp bullet points.`
  },
  {
    id: 'cmd_interview',
    category: 'custom',
    key: 'cmd_interview',
    title: 'Вопросы к тексту',
    type: 'text',
    icon: '🎯',
    isDefault: 1,
    sortOrder: 10,
    prompt: 'Formulate 3 insightful, thought-provoking questions based on the key concepts in this text, with brief answers or hints.'
  },
  {
    id: 'cmd_eli5',
    category: 'custom',
    key: 'cmd_eli5',
    title: 'Объясни как в 5 лет',
    type: 'text',
    icon: '🧸',
    isDefault: 1,
    sortOrder: 11,
    prompt: 'Explain the core idea of the selected text in extremely simple, friendly terms suitable for a child, using a fun everyday analogy.'
  },
  {
    id: 'cmd_critique',
    category: 'custom',
    key: 'cmd_critique',
    title: 'Критика и риски',
    type: 'text',
    icon: '⚠️',
    isDefault: 1,
    sortOrder: 12,
    prompt: 'Identify the main weaknesses, limitations, edge cases, or potential trade-offs and risks of the ideas described in the text.'
  }
];
