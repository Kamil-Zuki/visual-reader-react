/**
 * db.js - SQLite Manager for Tauri
 */
import Database from '@tauri-apps/plugin-sql';

let dbInstance = null;
let dbInitPromise = null; // singleton promise to prevent race conditions
let isTauri = false;
let dbReady = false;
let writeQueue = []; // buffer writes that arrive before DB is ready

try {
  isTauri = window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined;
} catch (e) {}

async function flushWriteQueue() {
  while (writeQueue.length > 0) {
    const fn = writeQueue.shift();
    try { await fn(); } catch (e) { console.error('[DB] Write queue flush error:', e); }
  }
}

export async function openDB() {
  if (dbInstance) return dbInstance;

  // If already initializing, return the same promise (no duplicate connections)
  if (dbInitPromise) return dbInitPromise;

  if (!isTauri) {
    console.warn('Running outside Tauri. SQLite is not available. Using localStorage mock.');
    dbInstance = {
      execute: async () => [],
      select: async () => [],
    };
    dbReady = true;
    return dbInstance;
  }

  dbInitPromise = (async () => {
    try {
      console.log('[DB] Loading SQLite database...');
      const db = await Database.load('sqlite:visual-reader.db');
      console.log('[DB] Database loaded. Creating schema...');

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

      console.log('[DB] Schema ready.');
      dbInstance = db;
      dbReady = true;
      await flushWriteQueue();
      return dbInstance;
    } catch (error) {
      dbInitPromise = null; // allow retry on next call
      console.error('[DB] Failed to initialize:', error);
      throw error;
    }
  })();

  return dbInitPromise;
}

export async function saveBookToDB(book) {
  if (!isTauri) return book; // mock
  if (!dbReady) {
    writeQueue.push(() => saveBookToDB(book));
    return book;
  }
  const db = await openDB();
  const dataStr = JSON.stringify(book);
  await db.execute(
    'INSERT OR REPLACE INTO books (id, title, author, data, isDefault, createdAt) VALUES ($1, $2, $3, $4, $5, $6)',
    [book.id, book.title || '', book.author || '', dataStr, book.isDefault ? 1 : 0, Date.now()]
  );
  return book;
}

export async function getAllBooksFromDB() {
  if (!isTauri) return []; // mock
  const db = await openDB();
  const result = await db.select('SELECT data FROM books');
  return result.map(row => JSON.parse(row.data));
}

export async function getBookByIdFromDB(id) {
  if (!isTauri) return null; // mock
  const db = await openDB();
  const result = await db.select('SELECT data FROM books WHERE id = $1', [id]);
  if (result.length > 0) {
    return JSON.parse(result[0].data);
  }
  return null;
}

export async function deleteBookFromDB(id) {
  if (!isTauri) return true;
  const db = await openDB();
  await db.execute('DELETE FROM books WHERE id = $1', [id]);
  return true;
}

// Key-Value store functions for Zustand persistence
export async function setStoreValue(key, value) {
  if (!isTauri) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  // If DB not ready yet, queue the write
  if (!dbReady) {
    writeQueue.push(() => setStoreValue(key, value));
    return;
  }
  const db = await openDB();
  await db.execute(
    'INSERT OR REPLACE INTO key_value_store (key, value) VALUES ($1, $2)',
    [key, JSON.stringify(value)]
  );
}

export async function getStoreValue(key, defaultValue = null) {
  if (!isTauri) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  }
  const db = await openDB();
  const result = await db.select('SELECT value FROM key_value_store WHERE key = $1', [key]);
  if (result.length > 0) {
    try {
      return JSON.parse(result[0].value);
    } catch {
      return result[0].value;
    }
  }
  return defaultValue;
}
