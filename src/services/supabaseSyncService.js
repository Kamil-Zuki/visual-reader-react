import { createClient } from '@supabase/supabase-js';
import { useStore } from '../store/useStore';
import { setStoreValue } from '../utils/db';

let supabase = null;
let realtimeChannel = null;
let storeUnsubscribe = null;
let debounceTimeout = null;
let isApplyingRemoteUpdate = false;

/**
 * Generate a random memorable Sync Key (e.g. reader-4821)
 */
export function generateSyncKey() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `reader-${randomNum}`;
}

/**
 * Determine default device name based on platform
 */
export function getDefaultDeviceName() {
  const isTauri = typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined);
  if (isTauri) {
    return 'Desktop PC (Tauri)';
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'Android Device';
  if (/ipad|iphone|ipod/i.test(ua)) return 'Apple iOS';
  if (/mac/i.test(ua)) return 'Mac Web';
  return 'Web Reader';
}

/**
 * Normalize and sanitize Supabase Project URL:
 * - Strips accidental /rest/v1 suffixes (from Data API tab)
 * - Converts dashboard URLs to standard API URLs
 * - Trims whitespace and trailing slashes
 */
export function normalizeSupabaseUrl(inputUrl) {
  if (!inputUrl) return '';
  let url = inputUrl.trim().replace(/\/+$/, '');

  const dashMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashMatch) {
    return `https://${dashMatch[1]}.supabase.co`;
  }

  url = url.replace(/\/rest(\/v1)?\/?$/i, '');

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url;
}

/**
 * Initialize or get Supabase client instance
 */
export function initSupabaseClient(url, anonKey) {
  if (!url || !anonKey) return null;
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = anonKey.trim();

  try {
    supabase = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'vr_sync_auth'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    return supabase;
  } catch (err) {
    console.error('[SupabaseSync] Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test connection to Supabase and reader_sync table
 */
export async function testConnection(url, anonKey, syncKey) {
  if (!url || !anonKey) {
    return { success: false, error: 'Укажите URL проекта и Anon Key' };
  }
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = anonKey.trim();
  const testKey = (syncKey || 'test_probe').trim();

  try {
    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'vr_test_auth' }
    });

    const { error } = await testClient
      .from('reader_sync')
      .select('sync_key')
      .eq('sync_key', testKey)
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "reader_sync" does not exist') || error.message?.includes('table "reader_sync" does not exist')) {
        return { 
          success: false, 
          error: 'Таблица reader_sync не найдена в базе данных. Выполните SQL скрипт создания таблицы в Supabase SQL Editor.' 
        };
      }
      return { success: false, error: error.message || 'Ошибка доступа к таблице reader_sync' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Сетевая ошибка при подключении к Supabase' };
  }
}

/**
 * Pull remote sync data by sync_key
 */
export async function pullRemoteData(syncKey) {
  if (!supabase || !syncKey) return null;

  try {
    const { data, error } = await supabase
      .from('reader_sync')
      .select('data, updated_at')
      .eq('sync_key', syncKey.trim())
      .maybeSingle();

    if (error) {
      console.warn('[SupabaseSync] Error pulling remote data:', error);
      return null;
    }

    return data ? data.data : null;
  } catch (err) {
    console.error('[SupabaseSync] Pull failed:', err);
    return null;
  }
}

/**
 * Push current local state to Supabase
 */
export async function pushLocalData(syncKey) {
  if (!supabase || !syncKey) return false;

  const state = useStore.getState();
  const payload = {
    bookmarks: state.bookmarks || {},
    highlights: state.highlights || {},
    readSections: state.readSections || {},
    apiKey: state.apiKey || '',
    model: state.model || 'openrouter/free',
    language: state.language || 'ru',
    deviceName: state.syncSettings?.deviceName || getDefaultDeviceName(),
    clientTimestamp: Date.now()
  };

  try {
    const { error } = await supabase
      .from('reader_sync')
      .upsert({
        sync_key: syncKey.trim(),
        data: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sync_key' });

    if (error) {
      console.error('[SupabaseSync] Push error:', error);
      return false;
    }

    useStore.setState({ lastSyncedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    console.error('[SupabaseSync] Push failed:', err);
    return false;
  }
}

/**
 * Smart merge remote data into local state
 */
export async function mergeRemoteIntoLocal(remoteData) {
  if (!remoteData || typeof remoteData !== 'object') return;

  isApplyingRemoteUpdate = true;

  try {
    const state = useStore.getState();
    const localBookmarks = state.bookmarks || {};
    const localHighlights = state.highlights || {};
    const localReadSections = state.readSections || {};

    const remoteBookmarks = remoteData.bookmarks || {};
    const remoteHighlights = remoteData.highlights || {};
    const remoteReadSections = remoteData.readSections || {};

    // 1. Merge bookmarks (union by id or fallback key)
    const mergedBookmarks = { ...localBookmarks };
    const allBookmarkBooks = new Set([...Object.keys(localBookmarks), ...Object.keys(remoteBookmarks)]);
    for (const bookId of allBookmarkBooks) {
      const localList = localBookmarks[bookId] || [];
      const remoteList = remoteBookmarks[bookId] || [];
      const bMap = new Map();
      localList.forEach(b => {
        const key = b.id || `${b.chapterIdx}_${b.sectionIdx}`;
        bMap.set(key, b);
      });
      remoteList.forEach(b => {
        const key = b.id || `${b.chapterIdx}_${b.sectionIdx}`;
        if (!bMap.has(key)) {
          bMap.set(key, b);
        }
      });
      mergedBookmarks[bookId] = Array.from(bMap.values());
    }

    // 2. Merge highlights (union by id, preserve newest note)
    const mergedHighlights = { ...localHighlights };
    const allHighlightBooks = new Set([...Object.keys(localHighlights), ...Object.keys(remoteHighlights)]);
    for (const bookId of allHighlightBooks) {
      const localList = localHighlights[bookId] || [];
      const remoteList = remoteHighlights[bookId] || [];
      const hMap = new Map();
      localList.forEach(h => hMap.set(h.id, h));
      remoteList.forEach(h => {
        if (!hMap.has(h.id)) {
          hMap.set(h.id, h);
        } else {
          const existing = hMap.get(h.id);
          const existingTime = existing.updatedAt || existing.createdAt || 0;
          const remoteTime = h.updatedAt || h.createdAt || 0;
          if (remoteTime > existingTime || (!existing.note && h.note)) {
            hMap.set(h.id, { ...existing, ...h });
          }
        }
      });
      mergedHighlights[bookId] = Array.from(hMap.values());
    }

    // 3. Merge readSections (union Set per book)
    const mergedReadSections = { ...localReadSections };
    const allReadBooks = new Set([...Object.keys(localReadSections), ...Object.keys(remoteReadSections)]);
    for (const bookId of allReadBooks) {
      const l = localReadSections[bookId] || [];
      const r = remoteReadSections[bookId] || [];
      mergedReadSections[bookId] = Array.from(new Set([...l, ...r]));
    }

    // 4. Merge OpenRouter settings (apiKey, model, language)
    const storeUpdates = {
      bookmarks: mergedBookmarks,
      highlights: mergedHighlights,
      readSections: mergedReadSections,
      lastSyncedAt: new Date().toISOString()
    };

    const dbPromises = [
      setStoreValue('ddia_bookmarks', mergedBookmarks),
      setStoreValue('ddia_highlights', mergedHighlights),
      setStoreValue('ddia_read_sections', mergedReadSections)
    ];

    // If remote has an API key and local doesn't (or remote key is newer), sync it
    if (remoteData.apiKey && remoteData.apiKey.trim()) {
      if (!state.apiKey || remoteData.apiKey.trim() !== state.apiKey.trim()) {
        storeUpdates.apiKey = remoteData.apiKey.trim();
        dbPromises.push(setStoreValue('openrouter_api_key', remoteData.apiKey.trim()));
      }
    }

    if (remoteData.model && remoteData.model !== state.model) {
      storeUpdates.model = remoteData.model;
      dbPromises.push(setStoreValue('openrouter_model', remoteData.model));
    }

    if (remoteData.language && remoteData.language !== state.language) {
      storeUpdates.language = remoteData.language;
      dbPromises.push(setStoreValue('ddia_language', remoteData.language));
    }

    // Persist to SQLite / IndexedDB
    await Promise.all(dbPromises);

    // Update Zustand store
    useStore.setState(storeUpdates);
  } catch (err) {
    console.error('[SupabaseSync] Merge failed:', err);
  } finally {
    // Reset flag after microtask to avoid immediate echo push
    setTimeout(() => {
      isApplyingRemoteUpdate = false;
    }, 200);
  }
}

/**
 * Setup Realtime subscription on reader_sync table for current sync_key
 */
function subscribeToRealtime(syncKey) {
  if (!supabase || !syncKey) return;

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  const cleanKey = syncKey.trim();

  realtimeChannel = supabase
    .channel(`reader_sync_${cleanKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reader_sync',
        filter: `sync_key=eq.${cleanKey}`
      },
      async (payload) => {
        if (isApplyingRemoteUpdate) return;
        const newRecord = payload.new;
        if (!newRecord || !newRecord.data) return;

        console.log('[SupabaseSync] Realtime change received from remote');
        useStore.setState({ syncStatus: 'syncing' });
        await mergeRemoteIntoLocal(newRecord.data);
        useStore.setState({ syncStatus: 'synced' });
      }
    )
    .subscribe((status) => {
      console.log('[SupabaseSync] Realtime channel status:', status);
      if (status === 'SUBSCRIBED') {
        useStore.setState({ syncStatus: 'synced' });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        const currentStatus = useStore.getState().syncStatus;
        if (currentStatus !== 'disconnected') {
          useStore.setState({ syncStatus: 'error' });
        }
      }
    });
}

/**
 * Setup Zustand store listener to automatically push changes with debounce
 */
function setupStoreAutoSync(syncKey) {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  let prevBookmarks = useStore.getState().bookmarks;
  let prevHighlights = useStore.getState().highlights;
  let prevReadSections = useStore.getState().readSections;
  let prevApiKey = useStore.getState().apiKey;
  let prevModel = useStore.getState().model;

  storeUnsubscribe = useStore.subscribe((state) => {
    if (isApplyingRemoteUpdate) return;
    if (!state.syncSettings?.enabled || !syncKey) return;

    const bChanged = state.bookmarks !== prevBookmarks;
    const hChanged = state.highlights !== prevHighlights;
    const rChanged = state.readSections !== prevReadSections;
    const kChanged = state.apiKey !== prevApiKey;
    const mChanged = state.model !== prevModel;

    prevBookmarks = state.bookmarks;
    prevHighlights = state.highlights;
    prevReadSections = state.readSections;
    prevApiKey = state.apiKey;
    prevModel = state.model;

    if (bChanged || hChanged || rChanged || kChanged || mChanged) {
      if (debounceTimeout) clearTimeout(debounceTimeout);

      useStore.setState({ syncStatus: 'syncing' });

      debounceTimeout = setTimeout(async () => {
        const ok = await pushLocalData(syncKey);
        useStore.setState({ syncStatus: ok ? 'synced' : 'error' });
      }, 1000);
    }
  });
}

/**
 * Connect and start Supabase sync
 */
export async function connectSync(settings) {
  const { supabaseUrl, supabaseAnonKey, syncKey } = settings || {};

  if (!supabaseUrl || !supabaseAnonKey || !syncKey) {
    console.warn('[SupabaseSync] Cannot connect: missing credentials or syncKey');
    useStore.setState({ syncStatus: 'error' });
    return false;
  }

  const cleanUrl = normalizeSupabaseUrl(supabaseUrl);
  const cleanKey = supabaseAnonKey.trim();

  useStore.setState({ syncStatus: 'connecting' });

  try {
    const client = initSupabaseClient(cleanUrl, cleanKey);
    if (!client) {
      useStore.setState({ syncStatus: 'error' });
      return false;
    }

    // 1. Pull existing remote data
    const remoteData = await pullRemoteData(syncKey);
    if (remoteData) {
      await mergeRemoteIntoLocal(remoteData);
    }

    // 2. Push unified local state back to Supabase
    const pushOk = await pushLocalData(syncKey);
    if (!pushOk) {
      console.warn('[SupabaseSync] Initial push returned error, checking subscription anyway');
    }

    // 3. Subscribe to Realtime changes
    subscribeToRealtime(syncKey);

    // 4. Setup auto-push on local changes
    setupStoreAutoSync(syncKey);

    useStore.setState({ syncStatus: 'synced' });
    return true;
  } catch (err) {
    console.error('[SupabaseSync] Connection failed:', err);
    useStore.setState({ syncStatus: 'error' });
    return false;
  }
}

/**
 * Disconnect and cleanup Supabase sync
 */
export function disconnectSync() {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }

  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  useStore.setState({ syncStatus: 'disconnected' });
}

/**
 * Force manual sync: pull remote, merge, then push local
 */
export async function forceSyncNow() {
  const state = useStore.getState();
  const syncKey = state.syncSettings?.syncKey;
  if (!syncKey || !supabase) return false;

  useStore.setState({ syncStatus: 'syncing' });
  try {
    const remoteData = await pullRemoteData(syncKey);
    if (remoteData) {
      await mergeRemoteIntoLocal(remoteData);
    }
    const ok = await pushLocalData(syncKey);
    useStore.setState({ syncStatus: ok ? 'synced' : 'error' });
    return ok;
  } catch (err) {
    console.error('[SupabaseSync] Force sync error:', err);
    useStore.setState({ syncStatus: 'error' });
    return false;
  }
}

/**
 * Initialize sync service on app startup from stored settings
 */
export function initSyncServiceFromSettings(settings) {
  if (!settings || !settings.enabled) return;
  if (!settings.supabaseUrl || !settings.supabaseAnonKey || !settings.syncKey) return;

  console.log('[SupabaseSync] Initializing auto-sync from saved settings...');
  connectSync(settings);
}
