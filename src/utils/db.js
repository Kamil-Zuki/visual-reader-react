/**
 * db.js - Robust SQLite & LocalStorage Manager for Tauri & Web
 */
import Database from '@tauri-apps/plugin-sql';

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

      console.log('[DB] SQLite schema ready.');
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
