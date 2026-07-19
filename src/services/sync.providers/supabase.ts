import type { SyncProvider, SyncResult } from '../../types'
import { habitsStore } from '../../stores/habits'
import { entriesStore } from '../../stores/entries'
import { identitiesStore } from '../../stores/identities'
import { notesStore } from '../../stores/notes'
import { appSettings } from '../../lib/settings'
import { clearAllHabits, saveHabit } from '../storage'
import { clearAllEntries, saveEntry } from '../storage'
import { clearAllIdentities, saveIdentity } from '../storage'
import { clearAllNotes, saveNote } from '../storage'
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

  async deleteRecord(collection: string, id: string): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const { error } = await supabase
      .from('user_sync_data')
      .delete()
      .eq('user_id', uid)
      .eq('collection', collection)
      .eq('record_id', id)

    if (error) throw new Error(`Delete failed: ${error.message}`)
  }

  async uploadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('Not signed in')

      const habits = get(habitsStore)
      const entries = get(entriesStore)
      const identities = get(identitiesStore)
      const notes = get(notesStore)

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
      for (const n of notes) {
        rows.push({ user_id: uid, collection: 'notes', record_id: n.id, data: n, updated_at: new Date().toISOString() })
      }

      const settings = get(appSettings)
      rows.push({ user_id: uid, collection: 'settings', record_id: 'app_settings', data: settings, updated_at: new Date().toISOString() })

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

      const habits: any[] = []
      const entries: any[] = []
      const identities: any[] = []
      const notes: any[] = []

      for (const row of data) {
        if (row.collection === 'habits') habits.push(row.data)
        else if (row.collection === 'entries') entries.push(row.data)
        else if (row.collection === 'identities') identities.push(row.data)
        else if (row.collection === 'notes') notes.push(row.data)
        else if (row.collection === 'settings' && row.record_id === 'app_settings') {
          appSettings.set(row.data)
        }
      }

      if (habits.length > 0) {
        await clearAllHabits()
        for (const h of habits) await saveHabit(h)
        habitsStore.set(habits)
      }
      if (entries.length > 0) {
        await clearAllEntries()
        for (const e of entries) await saveEntry(e)
        entriesStore.set(entries)
      }
      if (identities.length > 0) {
        await clearAllIdentities()
        for (const i of identities) await saveIdentity(i)
        identitiesStore.set(identities)
      }
      if (notes.length > 0) {
        await clearAllNotes()
        for (const n of notes) await saveNote(n)
        notesStore.set(notes)
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

export type { SyncProvider }
