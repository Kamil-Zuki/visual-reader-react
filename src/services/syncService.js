import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { useStore } from '../store/useStore';
import { setStoreValue } from '../utils/db';

let ydoc = null;
let provider = null;
let storeUnsubscribe = null;
let isApplyingRemoteUpdate = false;

// Default signaling servers for WebRTC peer discovery
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
];

/**
 * Generate a random memorable Room ID (e.g. reader-sync-7382)
 */
export function generateRoomId() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `reader-sync-${randomNum}`;
}

/**
 * Generate a random secure passkey
 */
export function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
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
 * Connect to P2P sync room
 */
export function connectSync({ roomId, password = '', deviceName = '' }) {
  if (!roomId || !roomId.trim()) {
    console.warn('[Sync] Cannot connect: Room ID is empty');
    return;
  }

  // Clean up any existing connection
  disconnectSync();

  const cleanRoomId = roomId.trim();
  const cleanPassword = (password || '').trim();
  const finalDeviceName = (deviceName || '').trim() || getDefaultDeviceName();

  console.log(`[Sync] Connecting to room "${cleanRoomId}" with device "${finalDeviceName}"...`);
  useStore.setState({ syncStatus: 'searching' });

  ydoc = new Y.Doc();

  // Create WebRTC provider
  try {
    provider = new WebrtcProvider(cleanRoomId, ydoc, {
      signaling: SIGNALING_SERVERS,
      password: cleanPassword || null, // null if no password, or encrypted with password
      maxConns: 20 + Math.floor(Math.random() * 15),
      filterBcConns: true
    });
  } catch (err) {
    console.error('[Sync] Failed to initialize WebrtcProvider:', err);
    useStore.setState({ syncStatus: 'disconnected' });
    return;
  }

  // Configure local awareness (device info)
  const myClientId = ydoc.clientID;
  if (provider.awareness) {
    provider.awareness.setLocalStateField('user', {
      clientId: myClientId,
      name: finalDeviceName,
      joinedAt: Date.now()
    });

    // Listen for awareness changes (peers joining/leaving)
    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates();
      const peers = [];
      states.forEach((state, client) => {
        if (client !== myClientId && state?.user) {
          peers.push({
            clientId: client,
            name: state.user.name || `Device #${client}`,
            joinedAt: state.user.joinedAt
          });
        }
      });

      const currentStatus = peers.length > 0 ? 'connected' : 'searching';
      useStore.setState({
        connectedPeers: peers,
        syncStatus: currentStatus
      });
      console.log(`[Sync] Peers updated (${peers.length}):`, peers.map(p => p.name).join(', '));
    });
  }

  // Status updates
  provider.on('status', ({ connected }) => {
    console.log('[Sync] Provider status connected:', connected);
  });

  provider.on('synced', ({ synced }) => {
    console.log('[Sync] Yjs document synced:', synced);
    if (synced) {
      useStore.setState({ lastSyncedAt: Date.now() });
    }
  });

  // Seed local state into Yjs Doc initially
  seedLocalStateToDoc();

  // Listen for remote Yjs updates -> Apply to Zustand & SQLite
  ydoc.on('afterTransaction', (transaction) => {
    // If this transaction was made locally, do not re-apply to Zustand
    if (transaction.local) return;

    console.log('[Sync] Remote changes received, applying to store...');
    applyDocChangesToStore();
  });

  // Subscribe to Zustand store changes -> Push local updates to Yjs Doc
  setupStoreSubscription();
}

/**
 * Seed existing local Zustand data into the Yjs Doc
 */
function seedLocalStateToDoc() {
  if (!ydoc) return;
  const state = useStore.getState();

  ydoc.transact(() => {
    const yBookmarks = ydoc.getMap('bookmarks');
    const yHighlights = ydoc.getMap('highlights');
    const yReadSections = ydoc.getMap('readSections');
    const yCommands = ydoc.getMap('customCommands');
    const yPrompts = ydoc.getMap('customPrompts');

    // Seed bookmarks
    if (state.bookmarks) {
      Object.entries(state.bookmarks).forEach(([bookId, list]) => {
        if (Array.isArray(list)) {
          list.forEach(b => {
            const key = `${bookId}::${b.id}`;
            if (!yBookmarks.has(key)) {
              yBookmarks.set(key, b);
            }
          });
        }
      });
    }

    // Seed highlights
    if (state.highlights) {
      Object.entries(state.highlights).forEach(([bookId, list]) => {
        if (Array.isArray(list)) {
          list.forEach(h => {
            const key = `${bookId}::${h.id}`;
            if (!yHighlights.has(key)) {
              yHighlights.set(key, h);
            }
          });
        }
      });
    }

    // Seed read sections
    if (state.readSections) {
      Object.entries(state.readSections).forEach(([bookId, secList]) => {
        if (Array.isArray(secList)) {
          secList.forEach(secId => {
            const key = `${bookId}::${secId}`;
            if (!yReadSections.has(key)) {
              yReadSections.set(key, true);
            }
          });
        }
      });
    }

    // Seed custom commands
    if (Array.isArray(state.customCommands)) {
      state.customCommands.forEach(cmd => {
        if (cmd?.id && !yCommands.has(cmd.id)) {
          yCommands.set(cmd.id, cmd);
        }
      });
    }

    // Seed prompts
    if (state.prompts) {
      Object.entries(state.prompts).forEach(([pk, pv]) => {
        if (!yPrompts.has(pk)) {
          yPrompts.set(pk, pv);
        }
      });
    }
  });
}

/**
 * Read current data from Yjs Doc and update Zustand store + SQLite
 */
function applyDocChangesToStore() {
  if (!ydoc) return;
  isApplyingRemoteUpdate = true;

  try {
    const yBookmarks = ydoc.getMap('bookmarks');
    const yHighlights = ydoc.getMap('highlights');
    const yReadSections = ydoc.getMap('readSections');
    const yCommands = ydoc.getMap('customCommands');
    const yPrompts = ydoc.getMap('customPrompts');

    // 1. Bookmarks: group by bookId
    const newBookmarks = {};
    yBookmarks.forEach((bookmark, key) => {
      const [bookId] = key.split('::');
      if (bookId && bookmark) {
        if (!newBookmarks[bookId]) newBookmarks[bookId] = [];
        newBookmarks[bookId].push(bookmark);
      }
    });

    // 2. Highlights: group by bookId
    const newHighlights = {};
    yHighlights.forEach((highlight, key) => {
      const [bookId] = key.split('::');
      if (bookId && highlight) {
        if (!newHighlights[bookId]) newHighlights[bookId] = [];
        newHighlights[bookId].push(highlight);
      }
    });

    // 3. Read Sections: group by bookId
    const newReadSections = {};
    yReadSections.forEach((val, key) => {
      if (val) {
        const [bookId, secId] = key.split('::');
        if (bookId && secId) {
          if (!newReadSections[bookId]) newReadSections[bookId] = [];
          newReadSections[bookId].push(secId);
        }
      }
    });

    // 4. Custom Commands
    const newCustomCommands = [];
    yCommands.forEach((cmd) => {
      if (cmd?.id) newCustomCommands.push(cmd);
    });

    // 5. Custom Prompts
    const newPrompts = {};
    yPrompts.forEach((pv, pk) => {
      newPrompts[pk] = pv;
    });

    // Update Zustand store
    const updates = { lastSyncedAt: Date.now() };
    if (Object.keys(newBookmarks).length > 0) updates.bookmarks = newBookmarks;
    if (Object.keys(newHighlights).length > 0) updates.highlights = newHighlights;
    if (Object.keys(newReadSections).length > 0) updates.readSections = newReadSections;
    if (newCustomCommands.length > 0) updates.customCommands = newCustomCommands;
    if (Object.keys(newPrompts).length > 0) updates.prompts = { ...useStore.getState().prompts, ...newPrompts };

    useStore.setState(updates);

    // Persist changes to SQLite
    if (updates.bookmarks) setStoreValue('ddia_bookmarks', updates.bookmarks);
    if (updates.highlights) setStoreValue('ddia_highlights', updates.highlights);
    if (updates.readSections) setStoreValue('ddia_read_sections', updates.readSections);
    if (updates.customCommands) setStoreValue('ddia_custom_commands', updates.customCommands);
    if (updates.prompts) setStoreValue('ddia_custom_prompts', updates.prompts);

  } catch (err) {
    console.error('[Sync] Error applying remote doc changes:', err);
  } finally {
    isApplyingRemoteUpdate = false;
  }
}

/**
 * Setup subscription to local Zustand store changes
 */
function setupStoreSubscription() {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  storeUnsubscribe = useStore.subscribe((state, prevState) => {
    if (!ydoc || isApplyingRemoteUpdate) return;

    ydoc.transact(() => {
      // Sync bookmarks changes
      if (state.bookmarks !== prevState.bookmarks) {
        const yBookmarks = ydoc.getMap('bookmarks');
        // Track current keys in state
        const currentKeys = new Set();
        Object.entries(state.bookmarks || {}).forEach(([bookId, list]) => {
          (list || []).forEach(b => {
            const key = `${bookId}::${b.id}`;
            currentKeys.add(key);
            if (JSON.stringify(yBookmarks.get(key)) !== JSON.stringify(b)) {
              yBookmarks.set(key, b);
            }
          });
        });
        // Check for deletions
        yBookmarks.forEach((_, key) => {
          if (!currentKeys.has(key)) {
            yBookmarks.delete(key);
          }
        });
      }

      // Sync highlights changes
      if (state.highlights !== prevState.highlights) {
        const yHighlights = ydoc.getMap('highlights');
        const currentKeys = new Set();
        Object.entries(state.highlights || {}).forEach(([bookId, list]) => {
          (list || []).forEach(h => {
            const key = `${bookId}::${h.id}`;
            currentKeys.add(key);
            if (JSON.stringify(yHighlights.get(key)) !== JSON.stringify(h)) {
              yHighlights.set(key, h);
            }
          });
        });
        yHighlights.forEach((_, key) => {
          if (!currentKeys.has(key)) {
            yHighlights.delete(key);
          }
        });
      }

      // Sync readSections changes
      if (state.readSections !== prevState.readSections) {
        const yReadSections = ydoc.getMap('readSections');
        const currentKeys = new Set();
        Object.entries(state.readSections || {}).forEach(([bookId, list]) => {
          (list || []).forEach(secId => {
            const key = `${bookId}::${secId}`;
            currentKeys.add(key);
            if (!yReadSections.has(key)) {
              yReadSections.set(key, true);
            }
          });
        });
        yReadSections.forEach((_, key) => {
          if (!currentKeys.has(key)) {
            yReadSections.delete(key);
          }
        });
      }

      // Sync customCommands changes
      if (state.customCommands !== prevState.customCommands) {
        const yCommands = ydoc.getMap('customCommands');
        const currentIds = new Set((state.customCommands || []).map(c => c.id));
        (state.customCommands || []).forEach(cmd => {
          if (JSON.stringify(yCommands.get(cmd.id)) !== JSON.stringify(cmd)) {
            yCommands.set(cmd.id, cmd);
          }
        });
        yCommands.forEach((_, id) => {
          if (!currentIds.has(id)) {
            yCommands.delete(id);
          }
        });
      }

      // Sync prompts changes
      if (state.prompts !== prevState.prompts) {
        const yPrompts = ydoc.getMap('customPrompts');
        Object.entries(state.prompts || {}).forEach(([pk, pv]) => {
          if (yPrompts.get(pk) !== pv) {
            yPrompts.set(pk, pv);
          }
        });
      }
    });
  });
}

/**
 * Disconnect and clean up P2P sync
 */
export function disconnectSync() {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  if (provider) {
    try {
      provider.destroy();
    } catch (e) {
      console.error('[Sync] Error destroying provider:', e);
    }
    provider = null;
  }

  if (ydoc) {
    try {
      ydoc.destroy();
    } catch (e) {
      console.error('[Sync] Error destroying ydoc:', e);
    }
    ydoc = null;
  }

  useStore.setState({
    syncStatus: 'disconnected',
    connectedPeers: []
  });
  console.log('[Sync] Disconnected.');
}

/**
 * Force manual push of local state to all peers
 */
export function forcePushLocalToDoc() {
  if (!ydoc) return;
  console.log('[Sync] Forcing push of local state to Yjs Doc...');
  seedLocalStateToDoc();
  useStore.setState({ lastSyncedAt: Date.now() });
}

/**
 * Initialize sync service based on settings saved in SQLite
 */
export async function initSyncServiceFromSettings(settings) {
  if (!settings) return;
  const { enabled, roomId, password, deviceName } = settings;
  if (enabled && roomId) {
    connectSync({ roomId, password, deviceName });
  }
}
