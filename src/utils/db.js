/**
 * db.js - SQLite Manager for Tauri
 */
import Database from '@tauri-apps/plugin-sql';

let dbInstance = null;
let isTauri = false;

try {
  isTauri = window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined;
} catch (e) {}

export async function openDB() {
  if (dbInstance) return dbInstance;
  
  if (!isTauri) {
    console.warn('Running outside Tauri. SQLite is not available. Using in-memory mock for now.');
    // Mock DB for browser dev
    dbInstance = {
      execute: async () => [],
      select: async () => [],
    };
    return dbInstance;
  }

  try {
    dbInstance = await Database.load('sqlite:visual-reader.db');
    
    // Initialize schema
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT,
        author TEXT,
        data TEXT NOT NULL,
        isDefault INTEGER,
        createdAt INTEGER
      );
    `);
    
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS key_value_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    return dbInstance;
  } catch (error) {
    console.error('Failed to load SQLite db:', error);
    throw error;
  }
}

export async function saveBookToDB(book) {
  const db = await openDB();
  if (!isTauri) return book; // mock
  
  const dataStr = JSON.stringify(book);
  await db.execute(
    'INSERT OR REPLACE INTO books (id, title, author, data, isDefault, createdAt) VALUES ($1, $2, $3, $4, $5, $6)',
    [book.id, book.title || '', book.author || '', dataStr, book.isDefault ? 1 : 0, Date.now()]
  );
  return book;
}

export async function getAllBooksFromDB() {
  const db = await openDB();
  if (!isTauri) return []; // mock
  
  const result = await db.select('SELECT data FROM books');
  return result.map(row => JSON.parse(row.data));
}

export async function getBookByIdFromDB(id) {
  const db = await openDB();
  if (!isTauri) return null; // mock
  
  const result = await db.select('SELECT data FROM books WHERE id = $1', [id]);
  if (result.length > 0) {
    return JSON.parse(result[0].data);
  }
  return null;
}

export async function deleteBookFromDB(id) {
  const db = await openDB();
  if (!isTauri) return true;
  
  await db.execute('DELETE FROM books WHERE id = $1', [id]);
  return true;
}

// Key-Value store functions for Zustand persistence
export async function setStoreValue(key, value) {
  const db = await openDB();
  if (!isTauri) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  await db.execute(
    'INSERT OR REPLACE INTO key_value_store (key, value) VALUES ($1, $2)',
    [key, JSON.stringify(value)]
  );
}

export async function getStoreValue(key, defaultValue = null) {
  const db = await openDB();
  if (!isTauri) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  }
  
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
