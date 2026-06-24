// src/services/sync.providers/supabase.ts

import type { SyncProvider, SyncResult } from '../../types'
import { habitsStore, addHabit } from '../../stores/habits'
import { entriesStore, addEntry } from '../../stores/entries'
import { identitiesStore, addIdentity } from '../../stores/identities'
import { get } from 'svelte/store'
import { supabase } from '../../lib/supabase'
import { user } from '../../stores/auth'

class SupabaseSyncProvider implements SyncProvider {
  providerId = 'supabase'

  private getUserId(): string | null {
    const u = get(user)
    return u?.id ?? null
  }

  async saveRecord(collection: string, id: string, data: any): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const { error } = await supabase.from('user_sync_data').upsert({
      user_id: uid,
      collection,
      record_id: id,
      data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,collection,record_id',
    })

    if (error) throw new Error(`Save failed: ${error.message}`)
  }

  async getRecord(collection: string, id: string): Promise<any> {
    const uid = this.getUserId()
    if (!uid) return undefined

    const { data, error } = await supabase
      .from('user_sync_data')
      .select('data')
      .eq('user_id', uid)
      .eq('collection', collection)
      .eq('record_id', id)
      .single()

    if (error || !data) return undefined
    return data.data
  }

  async uploadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('Not signed in')

      const habits = get(habitsStore)
      const entries = get(entriesStore)
      const identities = get(identitiesStore)

      const rows: any[] = []

      for (const h of habits) {
        rows.push({ user_id: uid, collection: 'habits', record_id: h.id, data: h, updated_at: new Date().toISOString() })
      }
      for (const e of entries) {
        rows.push({ user_id: uid, collection: 'entries', record_id: e.id, data: e, updated_at: new Date().toISOString() })
      }
      for (const i of identities) {
        rows.push({ user_id: uid, collection: 'identities', record_id: i.id, data: i, updated_at: new Date().toISOString() })
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('user_sync_data').upsert(rows, {
          onConflict: 'user_id,collection,record_id',
        })
        if (error) throw new Error(error.message)
      }

      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch (e: any) {
      return { lastSynced: start, status: 'error', conflicts: [] }
    }
  }

  async downloadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('user_sync_data')
        .select('*')
        .eq('user_id', uid)

      if (error) throw new Error(error.message)

      if (!data || data.length === 0) {
        return { lastSynced: start, status: 'success', conflicts: [] }
      }

      for (const row of data) {
        if (row.collection === 'habits') {
          addHabit(row.data)
        } else if (row.collection === 'entries') {
          addEntry(row.data)
        } else if (row.collection === 'identities') {
          addIdentity(row.data)
        }
      }

      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch (e: any) {
      return { lastSynced: start, status: 'error', conflicts: [] }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getUserId()
  }
}

export const supabaseSyncProvider = new SupabaseSyncProvider()
