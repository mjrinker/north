// src/services/sync.ts
import { get } from 'svelte/store'
import { user } from '../stores/auth'
import { isNewBackend } from '../lib/backend'
import type { SyncProvider } from '../types'

let syncEnabled = true

export function setSyncEnabled(enabled: boolean) {
  syncEnabled = enabled
}

export async function getActiveProvider(): Promise<SyncProvider> {
  if (isNewBackend()) {
    const { apiSyncProvider } = await import('./sync.providers/api')
    return apiSyncProvider
  }
  const { supabaseSyncProvider } = await import('./sync.providers/supabase')
  return supabaseSyncProvider
}

export async function pushRecord(collection: string, id: string, data: any) {
  if (!syncEnabled) return
  const uid = get(user)?.id
  if (!uid) return
  try {
    const provider = await getActiveProvider()
    await provider.saveRecord(collection, id, data)
  } catch (e) {
    console.error(`Sync save ${collection}/${id} failed:`, e)
  }
}

export async function removeRecord(collection: string, id: string) {
  if (!syncEnabled) return
  const uid = get(user)?.id
  if (!uid) return
  try {
    const provider = await getActiveProvider()
    await provider.deleteRecord(collection, id)
  } catch (e) {
    console.error(`Sync delete ${collection}/${id} failed:`, e)
  }
}
