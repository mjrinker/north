import { get } from 'svelte/store'
import { user } from '../stores/auth'
import { supabaseSyncProvider } from './sync.providers/supabase'

let syncEnabled = true

export function setSyncEnabled(enabled: boolean) {
  syncEnabled = enabled
}

export async function pushRecord(collection: string, id: string, data: any) {
  if (!syncEnabled) return
  const uid = get(user)?.id
  if (!uid) return
  try {
    await supabaseSyncProvider.saveRecord(collection, id, data)
  } catch (e) {
    console.error(`Sync save ${collection}/${id} failed:`, e)
  }
}

export async function removeRecord(collection: string, id: string) {
  if (!syncEnabled) return
  const uid = get(user)?.id
  if (!uid) return
  try {
    await supabaseSyncProvider.deleteRecord(collection, id)
  } catch (e) {
    console.error(`Sync delete ${collection}/${id} failed:`, e)
  }
}
