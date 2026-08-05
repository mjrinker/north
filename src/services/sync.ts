// src/services/sync.ts
import { writable, get } from 'svelte/store'
import { ApiError } from '../lib/api';
import { apiSyncProvider } from './sync.providers/api';
import { enqueue, dequePending, dequeue, hasPending, pendingCount } from './outbox';

export interface SyncStatus {
  online: boolean
  syncing: boolean
  pending: number
}

export const syncStatus = writable<SyncStatus>({ online: true, syncing: false, pending: 0 })

async function refreshStatus() {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  const pending = await pendingCount()
  const prev = get(syncStatus)
  syncStatus.set({ ...prev, online, pending })
}

function setSyncing(syncing: boolean) {
  syncStatus.update(s => ({ ...s, syncing }))
}

let syncEnabled = true
let retryTimer: ReturnType<typeof setTimeout> | null = null

export function setSyncEnabled(enabled: boolean) {
  syncEnabled = enabled
  if (enabled) scheduleFlush()
}

function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 0
}

export async function pushRecord(collection: string, id: string, data: any) {
  if (!syncEnabled) return
  if (!(await apiSyncProvider.isAvailable())) return
  try {
    await apiSyncProvider.saveRecord(collection, id, data)
  } catch (e) {
    if (isNetworkError(e)) {
      await enqueue({ collection, id, data, delete: false })
      console.warn(`Sync save ${collection}/${id} queued for retry (offline)`)
      scheduleFlush()
    } else {
      console.error(`Sync save ${collection}/${id} failed:`, e)
    }
  }
  await refreshStatus()
}

export async function removeRecord(collection: string, id: string) {
  if (!syncEnabled) return
  if (!(await apiSyncProvider.isAvailable())) return
  try {
    await apiSyncProvider.deleteRecord(collection, id)
  } catch (e) {
    if (isNetworkError(e)) {
      await enqueue({ collection, id, delete: true })
      console.warn(`Sync delete ${collection}/${id} queued for retry (offline)`)
      scheduleFlush()
    } else {
      console.error(`Sync delete ${collection}/${id} failed:`, e)
    }
  }
  await refreshStatus()
}

export async function flushOutbox(): Promise<void> {
  if (!syncEnabled) return
  if (!(await apiSyncProvider.isAvailable())) return
  const pending = await dequePending()
  if (pending.length === 0) return

  setSyncing(true)
  try {
    for (const item of pending) {
      const seq = item.seq
      try {
        if (item.delete) {
          await apiSyncProvider.deleteRecord(item.collection, item.id)
        } else {
          await apiSyncProvider.saveRecord(item.collection, item.id, item.data)
        }
        if (seq != null) await dequeue(seq)
        await refreshStatus()
      } catch (e) {
        if (isNetworkError(e)) {
          scheduleFlush()
          return
        }
        console.error(`Outbox ${item.collection}/${item.id} permanently failed, dropping:`, e)
        if (seq != null) await dequeue(seq)
        await refreshStatus()
      }
    }
  } finally {
    setSyncing(false)
  }
}

function scheduleFlush() {
  if (typeof window === 'undefined') return
  if (retryTimer != null) return
  retryTimer = setTimeout(async () => {
    retryTimer = null
    if (await hasPending()) await flushOutbox()
  }, 10_000)
}

function initOnlineRetry() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void refreshStatus()
    void flushOutbox()
  })
  window.addEventListener('offline', () => {
    void refreshStatus()
  })
  void refreshStatus()
}

initOnlineRetry()