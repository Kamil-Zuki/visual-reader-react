/**
 * conceptExtractionService.js
 * 
 * LightRAG Entity & Relationship Extractor.
 * Extracts key domain concepts and directional relationship triplets from book chapters/sections using OpenRouter AI.
 */

import { CONCEPT_CATEGORIES } from '../data/ddiaConceptGraph';

const EXTRACTION_SYSTEM_PROMPT = `Ты — ведущий архитектор распределённых систем и эксперт по построению графов знаний (Knowledge Graph / LightRAG).
Твоя задача — извлечь из переданного текста ключевые технические концепции (сущности/entities) и направленные смысловые связи между ними (отношения/relationships).

Правила:
1. Выдели от 4 до 10 наиболее важных архитектурных концептов (технологии, алгоритмы, гарантии, структуры данных).
2. Для каждого концепта определи:
   - id: уникальный короткий идентификатор латиницей в snake_case (например: lsm_tree, raft_consensus, write_skew)
   - name: человекочитаемое название (напр. "LSM-Tree", "Raft Консенсус")
   - category: одна из категорий: "storage", "replication", "transactions", "distributed", "processing", "models"
   - summary: 1-2 предложения с точным техническим объяснением: что это и какую проблему решает.
3. Выдели от 4 до 12 направленных связей (триплетов) между концептами (как новыми, так и известными фундаментальными):
   - source: id исходного концепта
   - target: id целевого концепта
   - label: короткий предикат латиницей (например: uses, alternative_to, solves, mitigates, requires, trades_off_with, prevents, implements)
   - description: 1 предложение на русском, объясняющее суть архитектурной связи.

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON без markdown блоков и лишних слов:
{
  "concepts": [
    {
      "id": "string",
      "name": "string",
      "category": "storage|replication|transactions|distributed|processing|models",
      "summary": "string"
    }
  ],
  "relationships": [
    {
      "source": "string",
      "target": "string",
      "label": "string",
      "description": "string"
    }
  ]
}`;

export async function extractConceptsWithAI({
  text,
  chapterTitle = '',
  chapterIdx = 0,
  sectionIdx = 0,
  apiKey,
  model = 'openrouter/free',
}) {
  if (!text || text.trim().length < 50) {
    throw new Error('Текст раздела слишком короткий для извлечения концептов.');
  }
  if (!apiKey) {
    throw new Error('Укажите OpenRouter API Key в Настройках для AI-извлечения концептов.');
  }

  // Truncate text to avoid token limits (~6000 chars is plenty for key concept extraction)
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6500);

  const userPrompt = `Текст из главы «${chapterTitle}»:\n\n${cleanText}\n\nИзвлеки концепты и связи в формате JSON.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/visual-reader',
      'X-Title': 'Visual Reader LightRAG',
    },
    body: JSON.stringify({
      model: model || 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка AI (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '{}';

  let parsed = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    // Attempt to extract JSON substring if wrapped in markdown
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Не удалось разобрать JSON-ответ от ИИ.');
    }
  }

  const rawConcepts = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
  const rawRelations = Array.isArray(parsed?.relationships) ? parsed.relationships : [];

  // Normalize and attach chapter reference
  const validCategories = Object.keys(CONCEPT_CATEGORIES);

  const concepts = rawConcepts
    .filter(c => c && c.id && c.name)
    .map(c => {
      const cleanId = String(c.id).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const cat = validCategories.includes(c.category) ? c.category : 'distributed';
      return {
        id: cleanId,
        name: String(c.name).trim(),
        category: cat,
        val: 14,
        summary: String(c.summary || '').trim(),
        chapters: [{ cIdx: chapterIdx, sIdx: sectionIdx, title: chapterTitle || `Раздел ${chapterIdx + 1}.${sectionIdx + 1}` }]
      };
    });

  const conceptIds = new Set(concepts.map(c => c.id));

  const relationships = rawRelations
    .filter(r => r && r.source && r.target && r.label)
    .map(r => ({
      source: String(r.source).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      target: String(r.target).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label: String(r.label).trim(),
      description: String(r.description || '').trim()
    }));

  return { concepts, relationships };
}

/**
 * Merges newly extracted concepts and relationships into an existing graph.
 */
export function mergeConceptGraphs(existingGraph, newNodes = [], newLinks = []) {
  const existingNodes = existingGraph?.nodes ? [...existingGraph.nodes] : [];
  const existingLinks = existingGraph?.links ? [...existingGraph.links] : [];

  const nodeMap = new Map();
  existingNodes.forEach(n => {
    nodeMap.set(n.id, { ...n, chapters: n.chapters ? [...n.chapters] : [] });
  });

  // Merge nodes
  newNodes.forEach(newNode => {
    if (nodeMap.has(newNode.id)) {
      const current = nodeMap.get(newNode.id);
      // Append chapters if not already there
      const existingChKeys = new Set(current.chapters.map(ch => `${ch.cIdx}_${ch.sIdx}`));
      (newNode.chapters || []).forEach(ch => {
        const key = `${ch.cIdx}_${ch.sIdx}`;
        if (!existingChKeys.has(key)) {
          current.chapters.push(ch);
          existingChKeys.add(key);
        }
      });
      // Slightly increment prominence
      current.val = Math.min((current.val || 12) + 2, 26);
      if (!current.summary && newNode.summary) {
        current.summary = newNode.summary;
      }
    } else {
      nodeMap.set(newNode.id, { ...newNode });
    }
  });

  // Merge links
  const linkKey = (src, tgt) => {
    const s = typeof src === 'object' ? src.id : src;
    const t = typeof tgt === 'object' ? tgt.id : tgt;
    return `${s}-->${t}`;
  };

  const existingLinkKeys = new Set(existingLinks.map(l => linkKey(l.source, l.target)));
  const mergedLinks = [...existingLinks];

  newLinks.forEach(newLink => {
    const srcId = typeof newLink.source === 'object' ? newLink.source.id : newLink.source;
    const tgtId = typeof newLink.target === 'object' ? newLink.target.id : newLink.target;

    // Only add link if both endpoints exist in nodeMap
    if (nodeMap.has(srcId) && nodeMap.has(tgtId) && srcId !== tgtId) {
      const key = `${srcId}-->${tgtId}`;
      if (!existingLinkKeys.has(key)) {
        mergedLinks.push({
          source: srcId,
          target: tgtId,
          label: newLink.label || 'relates_to',
          description: newLink.description || ''
        });
        existingLinkKeys.add(key);
      }
    }
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links: mergedLinks
  };
}
