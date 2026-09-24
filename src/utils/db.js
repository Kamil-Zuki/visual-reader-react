/**
 * db.js - Robust SQLite & LocalStorage Manager for Tauri & Web
 */
import Database from '@tauri-apps/plugin-sql';
import { INITIAL_PROMPT_SEEDS } from '../data/initialPrompts';

let dbInstance = null;
let dbInitPromise = null; // singleton promise to prevent race conditions
let dbReady = false;
let writeQueue = []; // buffer writes that arrive before DB is ready

export function isTauriEnv() {
  if (typeof window === 'undefined') return false;
  return window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined;
}

async function flushWriteQueue() {
  while (writeQueue.length > 0) {
    const fn = writeQueue.shift();
    try { 
      await fn(); 
    } catch (e) { 
      console.error('[DB] Write queue flush error:', e); 
    }
  }
}

export async function openDB() {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  if (!isTauriEnv()) {
    console.log('[DB] Running outside Tauri. Using localStorage fallback.');
    try {
      if (!localStorage.getItem('app_prompts')) {
        let legacyPrompts = null;
        let legacyCommands = null;
        try {
          const lp = localStorage.getItem('ddia_custom_prompts');
          if (lp) legacyPrompts = JSON.parse(lp);
          const lc = localStorage.getItem('ddia_custom_commands');
          if (lc) legacyCommands = JSON.parse(lc);
        } catch {}

        const seeds = INITIAL_PROMPT_SEEDS.map(item => {
          let p = item.prompt;
          if (item.category === 'system' && legacyPrompts && legacyPrompts[item.key]) {
            p = legacyPrompts[item.key];
          }
          return { ...item, prompt: p, createdAt: Date.now(), updatedAt: Date.now() };
        });

        if (Array.isArray(legacyCommands)) {
          const defaultIds = new Set(INITIAL_PROMPT_SEEDS.map(s => s.id));
          legacyCommands.forEach(cmd => {
            if (!defaultIds.has(cmd.id)) {
              seeds.push({
                id: cmd.id,
                category: 'custom',
                key: cmd.id,
                title: cmd.title || 'Команда',
                prompt: cmd.prompt || '',
                type: cmd.type || 'text',
                icon: cmd.icon || '⚡',
                isDefault: 0,
                sortOrder: 20,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            }
          });
        }
        localStorage.setItem('app_prompts', JSON.stringify(seeds));
      }
    } catch (e) {
      console.warn('[DB] Web fallback prompts init error:', e);
    }

    dbInstance = {
      execute: async () => [],
      select: async () => [],
    };
    dbReady = true;
    return dbInstance;
  }

  dbInitPromise = (async () => {
    try {
      console.log('[DB] Loading SQLite database (visual-reader.db)...');
      const db = await Database.load('sqlite:visual-reader.db');
      console.log('[DB] Database loaded. Verifying schema...');

      await db.execute(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY,
          title TEXT,
          author TEXT,
          data TEXT NOT NULL,
          isDefault INTEGER,
          createdAt INTEGER
        );
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      console.log('[DB] SQLite schema (books & key_value_store) ready.');
      dbInstance = db;
      dbReady = true;
      await flushWriteQueue();
      return dbInstance;
    } catch (error) {
      dbInitPromise = null; // allow retry on next call
      console.error('[DB] Failed to initialize SQLite:', error);
      throw error;
    }
  })();

  return dbInitPromise;
}

export async function saveBookToDB(book) {
  if (!book?.id) return book;
  if (!isTauriEnv()) {
    try { localStorage.setItem(`book_${book.id}`, JSON.stringify(book)); } catch {}
    return book;
  }

  try {
    const db = await openDB();
    const dataStr = JSON.stringify(book);
    await db.execute(
      'INSERT OR REPLACE INTO books (id, title, author, data, isDefault, createdAt) VALUES ($1, $2, $3, $4, $5, $6)',
      [book.id, book.title || '', book.author || '', dataStr, book.isDefault ? 1 : 0, Date.now()]
    );
    console.log(`[DB] Book "${book.title || book.id}" saved to SQLite.`);
  } catch (err) {
    console.error('[DB] Failed to save book to SQLite:', err);
  }
  return book;
}

export async function getAllBooksFromDB() {
  if (!isTauriEnv()) return [];
  try {
    const db = await openDB();
    const result = await db.select('SELECT data FROM books');
    return result.map(row => JSON.parse(row.data));
  } catch (err) {
    console.error('[DB] Failed to get all books:', err);
    return [];
  }
}

export async function getBookByIdFromDB(id) {
  if (!isTauriEnv()) {
    const saved = localStorage.getItem(`book_${id}`);
    return saved ? JSON.parse(saved) : null;
  }
  try {
    const db = await openDB();
    const result = await db.select('SELECT data FROM books WHERE id = $1', [id]);
    if (result.length > 0) {
      return JSON.parse(result[0].data);
    }
  } catch (err) {
    console.error(`[DB] Failed to get book ${id}:`, err);
  }
  return null;
}

export async function deleteBookFromDB(id) {
  if (!isTauriEnv()) {
    localStorage.removeItem(`book_${id}`);
    return true;
  }
  try {
    const db = await openDB();
    await db.execute('DELETE FROM books WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error(`[DB] Failed to delete book ${id}:`, err);
    return false;
  }
}

// Key-Value store functions for Zustand persistence
export async function setStoreValue(key, value) {
  const strVal = JSON.stringify(value);
  
  // 1. Always update localStorage as instant mirror
  try {
    localStorage.setItem(key, strVal);
  } catch (e) {
    console.warn('[DB] localStorage write error:', e);
  }

  // 2. If running in Tauri, persist to SQLite
  if (!isTauriEnv()) return;

  try {
    const db = await openDB();
    if (!db || !db.execute) {
      writeQueue.push(() => setStoreValue(key, value));
      return;
    }
    await db.execute(
      'INSERT OR REPLACE INTO key_value_store (key, value) VALUES ($1, $2)',
      [key, strVal]
    );
    console.log(`[DB] Persisted "${key}" to SQLite.`);
  } catch (err) {
    console.error(`[DB] Error persisting "${key}" to SQLite:`, err);
  }
}

export async function getStoreValue(key, defaultValue = null) {
  if (!isTauriEnv()) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  }
  
  try {
    const db = await openDB();
    const result = await db.select('SELECT value FROM key_value_store WHERE key = $1', [key]);
    if (result.length > 0) {
      try {
        return JSON.parse(result[0].value);
      } catch {
        return result[0].value;
      }
    }
  } catch (err) {
    console.warn(`[DB] Error fetching "${key}" from SQLite, checking localStorage:`, err);
    const saved = localStorage.getItem(key);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
  }
  return defaultValue;
}

// ==========================================
// Prompts & Custom Commands Management
// (Cached in LocalStorage, Synced via Supabase)
// ==========================================

export async function getAllPromptsFromDB() {
  let rows = [];
  try {
    const saved = localStorage.getItem('app_prompts');
    if (saved) {
      rows = JSON.parse(saved);
    } else {
      // First-time fallback: seed defaults into LocalStorage
      rows = INITIAL_PROMPT_SEEDS.map(item => ({
        ...item,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
      localStorage.setItem('app_prompts', JSON.stringify(rows));
    }
  } catch {
    rows = INITIAL_PROMPT_SEEDS;
  }

  const systemPrompts = {};
  const customCommands = [];

  for (const r of rows) {
    if (r.category === 'system') {
      systemPrompts[r.key] = r.prompt;
    } else if (r.category === 'custom') {
      customCommands.push({
        id: r.id,
        title: r.title,
        icon: r.icon,
        type: r.type || 'text',
        prompt: r.prompt,
        createdAt: r.createdAt || Date.now(),
        updatedAt: r.updatedAt || Date.now()
      });
    }
  }

  return { systemPrompts, customCommands, rawPrompts: rows };
}

export async function saveSystemPromptsToDB(promptsMap) {
  if (!promptsMap) return;

  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    for (const [k, val] of Object.entries(promptsMap)) {
      const idx = list.findIndex(p => p.category === 'system' && p.key === k);
      if (idx >= 0) {
        list[idx].prompt = val;
        list[idx].updatedAt = Date.now();
      } else {
        list.push({
          id: `system_${k}`,
          category: 'system',
          key: k,
          title: k,
          prompt: val,
          type: k === 'diagram' ? 'diagram' : 'text',
          isDefault: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }
    localStorage.setItem('app_prompts', JSON.stringify(list));
    localStorage.setItem('ddia_custom_prompts', JSON.stringify(promptsMap));
  } catch (e) {
    console.warn('[DB] LocalStorage save system prompts error:', e);
  }
}

export async function saveCommandToDB(cmd) {
  if (!cmd || !cmd.id) return cmd;

  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === cmd.id);
    const item = {
      id: cmd.id,
      category: 'custom',
      key: cmd.id,
      title: cmd.title,
      icon: cmd.icon || '⚡',
      type: cmd.type || 'text',
      prompt: cmd.prompt,
      isDefault: idx >= 0 ? list[idx].isDefault : 0,
      sortOrder: idx >= 0 ? list[idx].sortOrder : 20,
      createdAt: cmd.createdAt || (idx >= 0 ? list[idx].createdAt : Date.now()),
      updatedAt: Date.now()
    };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    localStorage.setItem('app_prompts', JSON.stringify(list));
  } catch (e) {
    console.warn('[DB] LocalStorage save command error:', e);
  }

  return cmd;
}

export async function deleteCommandFromDB(id) {
  if (!id) return;

  try {
    const raw = localStorage.getItem('app_prompts');
    if (raw) {
      const list = JSON.parse(raw).filter(p => p.id !== id);
      localStorage.setItem('app_prompts', JSON.stringify(list));
    }
  } catch (e) {
    console.warn('[DB] LocalStorage delete command error:', e);
  }
}

export async function resetSystemPromptsInDB() {
  const defaultSystemSeeds = INITIAL_PROMPT_SEEDS.filter(p => p.category === 'system');

  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    for (const seed of defaultSystemSeeds) {
      const idx = list.findIndex(p => p.key === seed.key && p.category === 'system');
      if (idx >= 0) {
        list[idx].prompt = seed.prompt;
        list[idx].updatedAt = Date.now();
      } else {
        list.push({ ...seed, createdAt: Date.now(), updatedAt: Date.now() });
      }
    }
    localStorage.setItem('app_prompts', JSON.stringify(list));
    const promptsMap = {};
    defaultSystemSeeds.forEach(s => { promptsMap[s.key] = s.prompt; });
    localStorage.setItem('ddia_custom_prompts', JSON.stringify(promptsMap));
  } catch (e) {
    console.warn('[DB] LocalStorage reset system prompts error:', e);
  }

  const res = {};
  defaultSystemSeeds.forEach(s => { res[s.key] = s.prompt; });
  return res;
}

export async function resetCustomCommandsInDB() {
  const defaultCmdSeeds = INITIAL_PROMPT_SEEDS.filter(p => p.category === 'custom');

  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(p => p.category !== 'custom');
    defaultCmdSeeds.forEach(s => list.push({ ...s, createdAt: Date.now(), updatedAt: Date.now() }));
    localStorage.setItem('app_prompts', JSON.stringify(list));
  } catch (e) {
    console.warn('[DB] LocalStorage reset commands error:', e);
  }

  return defaultCmdSeeds.map(s => ({
    id: s.id,
    title: s.title,
    icon: s.icon,
    type: s.type,
    prompt: s.prompt
  }));
}


