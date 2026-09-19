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

      await db.execute(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          key TEXT UNIQUE,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          icon TEXT,
          isDefault INTEGER DEFAULT 0,
          sortOrder INTEGER DEFAULT 0,
          createdAt INTEGER,
          updatedAt INTEGER
        );
      `);

      // Seed prompts table if empty
      const promptCountRes = await db.select('SELECT COUNT(*) as count FROM prompts');
      const promptCount = promptCountRes && promptCountRes[0] ? (promptCountRes[0].count || 0) : 0;
      if (promptCount === 0) {
        console.log('[DB] Seeding prompts table with initial database records...');
        let legacyPrompts = null;
        let legacyCommands = null;
        try {
          const pRow = await db.select('SELECT value FROM key_value_store WHERE key = $1', ['ddia_custom_prompts']);
          if (pRow.length > 0) legacyPrompts = JSON.parse(pRow[0].value);
          const cRow = await db.select('SELECT value FROM key_value_store WHERE key = $1', ['ddia_custom_commands']);
          if (cRow.length > 0) legacyCommands = JSON.parse(cRow[0].value);
        } catch (e) {
          console.warn('[DB] Migration check warning:', e);
        }

        for (const item of INITIAL_PROMPT_SEEDS) {
          let promptText = item.prompt;
          if (item.category === 'system' && legacyPrompts && legacyPrompts[item.key]) {
            promptText = legacyPrompts[item.key];
          }
          await db.execute(`
            INSERT INTO prompts (id, category, key, title, prompt, type, icon, isDefault, sortOrder, createdAt, updatedAt)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            item.id, item.category, item.key, item.title, promptText, item.type, item.icon,
            item.isDefault, item.sortOrder, Date.now(), Date.now()
          ]);
        }

        if (Array.isArray(legacyCommands)) {
          const defaultIds = new Set(INITIAL_PROMPT_SEEDS.map(s => s.id));
          for (const cmd of legacyCommands) {
            if (!defaultIds.has(cmd.id)) {
              await db.execute(`
                INSERT INTO prompts (id, category, key, title, prompt, type, icon, isDefault, sortOrder, createdAt, updatedAt)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              `, [
                cmd.id, 'custom', cmd.id, cmd.title || 'Команда', cmd.prompt || '', cmd.type || 'text', cmd.icon || '⚡',
                0, 20, Date.now(), Date.now()
              ]);
            }
          }
        }
      }

      console.log('[DB] SQLite schema & prompts ready.');
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
// Prompts & Custom Commands Database Methods
// ==========================================

export async function getAllPromptsFromDB() {
  let rows = [];
  if (!isTauriEnv()) {
    try {
      const saved = localStorage.getItem('app_prompts');
      rows = saved ? JSON.parse(saved) : [];
    } catch {
      rows = [];
    }
  } else {
    try {
      const db = await openDB();
      rows = await db.select('SELECT * FROM prompts ORDER BY sortOrder ASC, createdAt ASC');
    } catch (err) {
      console.error('[DB] Failed to get prompts from SQLite, checking localStorage fallback:', err);
      try {
        const saved = localStorage.getItem('app_prompts');
        rows = saved ? JSON.parse(saved) : [];
      } catch {}
    }
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
        prompt: r.prompt
      });
    }
  }

  return { systemPrompts, customCommands, rawPrompts: rows };
}

export async function saveSystemPromptsToDB(promptsMap) {
  if (!promptsMap) return;

  // 1. Update localStorage mirror
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
          updatedAt: Date.now()
        });
      }
    }
    localStorage.setItem('app_prompts', JSON.stringify(list));
    localStorage.setItem('ddia_custom_prompts', JSON.stringify(promptsMap));
  } catch (e) {
    console.warn('[DB] LocalStorage save system prompts error:', e);
  }

  if (!isTauriEnv()) return;

  // 2. Persist to SQLite
  try {
    const db = await openDB();
    for (const [k, val] of Object.entries(promptsMap)) {
      const existing = await db.select('SELECT id FROM prompts WHERE key = $1 AND category = $2', [k, 'system']);
      if (existing.length > 0) {
        await db.execute('UPDATE prompts SET prompt = $1, updatedAt = $2 WHERE key = $3 AND category = $4', [
          val, Date.now(), k, 'system'
        ]);
      } else {
        await db.execute(`
          INSERT INTO prompts (id, category, key, title, prompt, type, isDefault, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          `system_${k}`, 'system', k, k, val, k === 'diagram' ? 'diagram' : 'text', 0, Date.now(), Date.now()
        ]);
      }
    }
  } catch (err) {
    console.error('[DB] Failed to save system prompts to SQLite:', err);
  }
}

export async function saveCommandToDB(cmd) {
  if (!cmd || !cmd.id) return cmd;

  // 1. LocalStorage mirror
  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === cmd.id);
    const item = {
      id: cmd.id,
      category: 'custom',
      key: cmd.id,
      title: cmd.title,
      icon: cmd.icon,
      type: cmd.type || 'text',
      prompt: cmd.prompt,
      isDefault: idx >= 0 ? list[idx].isDefault : 0,
      sortOrder: idx >= 0 ? list[idx].sortOrder : 20,
      updatedAt: Date.now()
    };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push({ ...item, createdAt: Date.now() });
    }
    localStorage.setItem('app_prompts', JSON.stringify(list));
  } catch (e) {
    console.warn('[DB] LocalStorage save command error:', e);
  }

  if (!isTauriEnv()) return cmd;

  // 2. SQLite
  try {
    const db = await openDB();
    const existing = await db.select('SELECT id, isDefault, sortOrder FROM prompts WHERE id = $1', [cmd.id]);
    const isDef = existing.length > 0 ? existing[0].isDefault : 0;
    const sort = existing.length > 0 ? existing[0].sortOrder : 20;

    await db.execute(`
      INSERT OR REPLACE INTO prompts (id, category, key, title, prompt, type, icon, isDefault, sortOrder, createdAt, updatedAt)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      cmd.id, 'custom', cmd.id, cmd.title, cmd.prompt, cmd.type || 'text', cmd.icon || '⚡',
      isDef, sort, Date.now(), Date.now()
    ]);
  } catch (err) {
    console.error('[DB] Failed to save command to SQLite:', err);
  }

  return cmd;
}

export async function deleteCommandFromDB(id) {
  if (!id) return;

  // 1. LocalStorage
  try {
    const raw = localStorage.getItem('app_prompts');
    if (raw) {
      const list = JSON.parse(raw).filter(p => p.id !== id);
      localStorage.setItem('app_prompts', JSON.stringify(list));
    }
  } catch (e) {
    console.warn('[DB] LocalStorage delete command error:', e);
  }

  if (!isTauriEnv()) return;

  // 2. SQLite
  try {
    const db = await openDB();
    await db.execute('DELETE FROM prompts WHERE id = $1 AND category = $2', [id, 'custom']);
  } catch (err) {
    console.error('[DB] Failed to delete command from SQLite:', err);
  }
}

export async function resetSystemPromptsInDB() {
  const defaultSystemSeeds = INITIAL_PROMPT_SEEDS.filter(p => p.category === 'system');

  // 1. LocalStorage
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

  // 2. SQLite
  if (isTauriEnv()) {
    try {
      const db = await openDB();
      for (const seed of defaultSystemSeeds) {
        await db.execute('UPDATE prompts SET prompt = $1, updatedAt = $2 WHERE key = $3 AND category = $4', [
          seed.prompt, Date.now(), seed.key, 'system'
        ]);
      }
    } catch (err) {
      console.error('[DB] Failed to reset system prompts in SQLite:', err);
    }
  }

  const res = {};
  defaultSystemSeeds.forEach(s => { res[s.key] = s.prompt; });
  return res;
}

export async function resetCustomCommandsInDB() {
  const defaultCmdSeeds = INITIAL_PROMPT_SEEDS.filter(p => p.category === 'custom');

  // 1. LocalStorage
  try {
    const raw = localStorage.getItem('app_prompts');
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(p => p.category !== 'custom');
    defaultCmdSeeds.forEach(s => list.push({ ...s, createdAt: Date.now(), updatedAt: Date.now() }));
    localStorage.setItem('app_prompts', JSON.stringify(list));
  } catch (e) {
    console.warn('[DB] LocalStorage reset commands error:', e);
  }

  // 2. SQLite
  if (isTauriEnv()) {
    try {
      const db = await openDB();
      await db.execute('DELETE FROM prompts WHERE category = $1', ['custom']);
      for (const s of defaultCmdSeeds) {
        await db.execute(`
          INSERT INTO prompts (id, category, key, title, prompt, type, icon, isDefault, sortOrder, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          s.id, 'custom', s.key, s.title, s.prompt, s.type, s.icon, s.isDefault, s.sortOrder, Date.now(), Date.now()
        ]);
      }
    } catch (err) {
      console.error('[DB] Failed to reset commands in SQLite:', err);
    }
  }

  return defaultCmdSeeds.map(s => ({
    id: s.id,
    title: s.title,
    icon: s.icon,
    type: s.type,
    prompt: s.prompt
  }));
}

