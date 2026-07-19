import { get } from 'svelte/store'
import { user } from '../stores/auth'
import { supabaseSyncProvider } from './sync.providers/supabase'

export async function pushRecord(collection: string, id: string, data: any) {
  const uid = get(user)?.id
  if (!uid) return
  try {
    await supabaseSyncProvider.saveRecord(collection, id, data)
  } catch (e) {
    console.error(`Sync save ${collection}/${id} failed:`, e)
  }
}

export async function removeRecord(collection: string, id: string) {
  const uid = get(user)?.id
  if (!uid) return
  try {
    await supabaseSyncProvider.deleteRecord(collection, id)
  } catch (e) {
    console.error(`Sync delete ${collection}/${id} failed:`, e)
  }
}
