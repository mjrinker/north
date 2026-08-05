// src/services/sync.ts
import { apiSyncProvider } from './sync.providers/api'

let syncEnabled = true

export function setSyncEnabled(enabled: boolean) {
  syncEnabled = enabled
}

export async function pushRecord(collection: string, id: string, data: any) {
  if (!syncEnabled) return
  if (!(await apiSyncProvider.isAvailable())) return
  try {
    await apiSyncProvider.saveRecord(collection, id, data)
  } catch (e) {
    console.error(`Sync save ${collection}/${id} failed:`, e)
  }
}

export async function removeRecord(collection: string, id: string) {
  if (!syncEnabled) return
  if (!(await apiSyncProvider.isAvailable())) return
  try {
    await apiSyncProvider.deleteRecord(collection, id)
  } catch (e) {
    console.error(`Sync delete ${collection}/${id} failed:`, e)
  }
}
