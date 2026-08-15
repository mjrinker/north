// src/services/dataLoader.ts
// Network-first data loading. Whenever the app is online + authenticated, reads
// are pulled fresh from the API and the IndexedDB cache is rewritten as the
// server snapshot (cache eviction). IndexedDB remains the offline fallback.
import { get } from 'svelte/store';
import { getToken } from '../lib/api';
import { syncStatus } from './sync';
import { setLastSyncedAt } from './syncState';

let refreshing = false;
let lastRefreshAt = 0;
let evictionTimer: ReturnType<typeof setInterval> | null = null;

function setSyncing(syncing: boolean) {
  syncStatus.update(s => ({ ...s, syncing }));
}

async function doRefresh(): Promise<boolean> {
  if (refreshing) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!getToken()) return false;
  const now = Date.now();
  if (now - lastRefreshAt < 30_000) return false;
  lastRefreshAt = now;
  refreshing = true;
  setSyncing(true);
  try {
    const { apiSyncProvider } = await import('./sync.providers/api');
    const { flushOutbox } = await import('./sync');
    // Push any offline-queued writes before replacing the cache with the
    // server snapshot, so those changes survive the eviction.
    await flushOutbox();
    const result = await apiSyncProvider.replaceAll();
    if (result.status === 'success') setLastSyncedAt(new Date().toISOString());
    return result.status === 'success';
  } catch (e) {
    console.error('refreshFromServer error:', e);
    return false;
  } finally {
    refreshing = false;
    setSyncing(false);
  }
}

// Pull fresh data from the API (server wins). Returns false when offline,
// unauthenticated, or the fetch failed so the cache remains the fallback.
export async function refreshFromServer(): Promise<boolean> {
  return doRefresh();
}

// Register listeners + a periodic timer so the cache is re-fetched and evicted
// whenever the app is online: on reconnect, on focus, on visibility, and every
// 5 minutes while visible.
export function initOnlineRefresh() {
  if (typeof window === 'undefined' || evictionTimer != null) return;
  const trigger = () => {
    void doRefresh();
  };
  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trigger();
  });
  evictionTimer = setInterval(() => {
    if (document.visibilityState === 'visible') trigger();
  }, 5 * 60 * 1000);
}