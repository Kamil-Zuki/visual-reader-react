/** Клиент AnkiConnect (локальный HTTP API аддона Anki) */

import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '../utils/db';

export const DEFAULT_ANKI_SETTINGS = {
  baseUrl: 'http://127.0.0.1:8765',
  deckName: 'Visual Reader',
  modelName: 'Basic',
  tags: ['visual-reader'],
  fieldFront: '',
  fieldBack: '',
  modelFields: ['Front', 'Back'],
};

function normalizeBaseUrl(url) {
  const trimmed = (url || DEFAULT_ANKI_SETTINGS.baseUrl).trim();
  return trimmed.replace(/\/+$/, '');
}

export async function ankiConnectRequest(baseUrl, action, params = {}) {
  const url = normalizeBaseUrl(baseUrl);
  const body = JSON.stringify({ action, version: 6, params });

  if (isTauriEnv()) {
    return invoke('anki_connect_request', { baseUrl: url, body });
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    throw new Error(
      `${err.message || err}. В браузере добавьте origin в AnkiConnect → webCorsOriginList ` +
        '(например http://localhost:5173). В приложении Tauri пересоберите после обновления.'
    );
  }
  if (!res.ok) {
    throw new Error(`AnkiConnect HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}

/** Угадывание полей «лицо» / «ответ» по именам полей типа заметок */
export function guessAnkiFieldMap(fields) {
  if (!fields?.length) {
    return { front: '', back: '' };
  }
  if (fields.length === 1) {
    return { front: fields[0], back: fields[0] };
  }
  const front =
    fields.find((f) => /^front$/i.test(f)) ||
    fields.find((f) => /question|term|word|expression/i.test(f)) ||
    fields[0];
  const back =
    fields.find((f) => /^back$/i.test(f)) ||
    fields.find((f) => /answer|definition|meaning|reading|translation/i.test(f)) ||
    fields.find((f) => f !== front) ||
    fields[1];
  return { front, back };
}

export async function fetchAnkiCatalog(settings) {
  const baseUrl = normalizeBaseUrl(settings?.baseUrl);
  const [version, deckNames, modelNames] = await Promise.all([
    ankiConnectRequest(baseUrl, 'version'),
    ankiConnectRequest(baseUrl, 'deckNames'),
    ankiConnectRequest(baseUrl, 'modelNames'),
  ]);
  return {
    version,
    deckNames: [...(deckNames || [])].sort((a, b) => a.localeCompare(b, 'ru')),
    modelNames: [...(modelNames || [])].sort((a, b) => a.localeCompare(b, 'ru')),
  };
}

export async function fetchAnkiModelFields(settings, modelName) {
  const baseUrl = normalizeBaseUrl(settings?.baseUrl);
  const fields = await ankiConnectRequest(baseUrl, 'modelFieldNames', { modelName });
  return [...(fields || [])];
}

export async function testAnkiConnection(settings) {
  return fetchAnkiCatalog(settings);
}

async function ensureDeck(baseUrl, deckName) {
  const names = await ankiConnectRequest(baseUrl, 'deckNames');
  if (!names.includes(deckName)) {
    await ankiConnectRequest(baseUrl, 'createDeck', { deck: deckName });
  }
}

export async function resolveAnkiFieldMap(baseUrl, modelName, settings) {
  if (settings?.fieldFront && settings?.fieldBack) {
    return { front: settings.fieldFront, back: settings.fieldBack };
  }
  const fields = await ankiConnectRequest(baseUrl, 'modelFieldNames', { modelName });
  if (!fields?.length) {
    throw new Error(`У типа заметок «${modelName}» нет полей`);
  }
  if (fields.length === 1) {
    return { front: fields[0], back: fields[0] };
  }
  return guessAnkiFieldMap(fields);
}

function toAnkiHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
}

function buildTags(settings, bookTitle) {
  const base = Array.isArray(settings?.tags) ? settings.tags : DEFAULT_ANKI_SETTINGS.tags;
  const fromBook = bookTitle
    ? bookTitle
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40)
    : '';
  const merged = [...base];
  if (fromBook) merged.push(fromBook);
  return [...new Set(merged.filter(Boolean))];
}

function buildNotesFromPairs(pairs, settings, fieldMap, bookTitle) {
  const tags = buildTags(settings, bookTitle);
  return pairs.map((c) => {
    let fields = {};
    if (c.ankiFields && Object.keys(c.ankiFields).length > 0) {
      // Dynamic fields mapping (new behavior)
      Object.entries(c.ankiFields).forEach(([key, val]) => {
        fields[key] = toAnkiHtml(val);
      });
    } else {
      // Legacy mapping behavior
      fields[fieldMap.front] = toAnkiHtml(c.front);
      fields[fieldMap.back] = toAnkiHtml(c.back);
    }

    return {
      deckName: settings.deckName,
      modelName: settings.modelName,
      fields,
      tags,
    };
  });
}

async function addNotesInBatches(baseUrl, notes) {
  let added = 0;
  let skipped = 0;
  for (let i = 0; i < notes.length; i += 100) {
    const chunk = notes.slice(i, i + 100);
    const ids = await ankiConnectRequest(baseUrl, 'addNotes', { notes: chunk });
    (ids || []).forEach((id) => {
      if (id === null || id === undefined) skipped += 1;
      else added += 1;
    });
  }
  return { added, skipped, total: notes.length };
}

/** Флешкарты книги → Anki */
export async function pushFlashcardsToAnki(flashcards, bookTitle, settings) {
  if (!flashcards?.length) {
    return { added: 0, skipped: 0, total: 0 };
  }
  const baseUrl = normalizeBaseUrl(settings?.baseUrl);
  await ankiConnectRequest(baseUrl, 'version');
  await ensureDeck(baseUrl, settings.deckName);
  const fieldMap = await resolveAnkiFieldMap(baseUrl, settings.modelName, settings);
  const pairs = flashcards.map((c) => ({
    front: c.front || '',
    back: c.back || '',
    ankiFields: c.ankiFields || null,
  }));
  const notes = buildNotesFromPairs(pairs, settings, fieldMap, bookTitle);
  return addNotesInBatches(baseUrl, notes);
}

/** Одна AI-карточка инспектора → Anki */
export async function pushSavedAiCardToAnki(card, bookTitle, settings) {
  const front = (card.quote || card.title || 'Фрагмент из Visual Reader').trim();
  let back = (card.content || '').trim();
  if (card.svg) {
    back = back ? `${back}\n\n[В приложении есть SVG-диаграмма]` : '[Диаграмма — см. Visual Reader]';
  }
  return pushFlashcardsToAnki([{ front, back }], bookTitle, settings);
}

/** Несколько AI-карточек */
export async function pushSavedAiCardsToAnki(cards, bookTitle, settings) {
  const pairs = (cards || []).map((card) => {
    const front = (card.quote || card.title || 'Visual Reader').trim();
    let back = (card.content || '').trim();
    if (card.svg && !back.includes('диаграмма')) {
      back = back ? `${back}\n\n[Диаграмма в Visual Reader]` : '[Диаграмма в Visual Reader]';
    }
    return { front, back };
  });
  if (!pairs.length) return { added: 0, skipped: 0, total: 0 };

  const baseUrl = normalizeBaseUrl(settings?.baseUrl);
  await ankiConnectRequest(baseUrl, 'version');
  await ensureDeck(baseUrl, settings.deckName);
  const fieldMap = await resolveAnkiFieldMap(baseUrl, settings.modelName, settings);
  const notes = buildNotesFromPairs(pairs, settings, fieldMap, bookTitle);
  return addNotesInBatches(baseUrl, notes);
}
