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
import { toDbRow, fromDbRow, tableForCollection, dateFieldsForTable } from '../../lib/dbMapping'

class SupabaseSyncProvider implements SyncProvider {
  providerId = 'supabase'

  private getUserId(): string | null {
    const u = get(user)
    return u?.id ?? null
  }

  async saveRecord(collection: string, id: string, data: any): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const table = tableForCollection[collection]
    if (!table) throw new Error(`Unknown collection: ${collection}`)

    if (collection === 'settings') {
      const row = toDbRow(data, uid)
      const { error } = await supabase.from(table).upsert(row, { onConflict: 'user_id' })
      if (error) throw new Error(`Save failed: ${error.message}`)
      return
    }

    const row = toDbRow({ ...data, id }, uid)
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw new Error(`Save failed: ${error.message}`)
  }

  async getRecord(collection: string, id: string): Promise<any> {
    const uid = this.getUserId()
    if (!uid) return undefined

    const table = tableForCollection[collection]
    if (!table) return undefined

    const dates = dateFieldsForTable[collection] || []

    if (collection === 'settings') {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', uid)
        .single()
      if (error || !data) return undefined
      return fromDbRow(data, dates)
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', uid)
      .eq('id', id)
      .single()
    if (error || !data) return undefined
    return fromDbRow(data, dates)
  }

  async deleteRecord(collection: string, id: string): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const table = tableForCollection[collection]
    if (!table) throw new Error(`Unknown collection: ${collection}`)

    if (collection === 'settings') {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', uid)
      if (error) throw new Error(`Delete failed: ${error.message}`)
      return
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', uid)
      .eq('id', id)
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

      if (habits.length > 0) {
        const rows = habits.map(h => toDbRow(h, uid))
        const { error } = await supabase.from('habits').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(error.message)
      }

      if (entries.length > 0) {
        const rows = entries.map(e => toDbRow(e, uid))
        const { error } = await supabase.from('entries').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(error.message)
      }

      if (identities.length > 0) {
        const rows = identities.map(i => toDbRow(i, uid))
        const { error } = await supabase.from('identities').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(error.message)
      }

      if (notes.length > 0) {
        const rows = notes.map(n => toDbRow(n, uid))
        const { error } = await supabase.from('notes').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(error.message)
      }

      const settings = get(appSettings)
      const settingsRow = toDbRow(settings, uid)
      const { error: settingsError } = await supabase.from('user_settings').upsert(settingsRow, { onConflict: 'user_id' })
      if (settingsError) throw new Error(settingsError.message)

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

      const [{ data: habitsData }, { data: entriesData }, { data: identitiesData }, { data: notesData }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', uid),
        supabase.from('entries').select('*').eq('user_id', uid),
        supabase.from('identities').select('*').eq('user_id', uid),
        supabase.from('notes').select('*').eq('user_id', uid),
      ])

      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', uid)
        .single()

      const habits = (habitsData || []).map(r => {
        const h = fromDbRow(r, dateFieldsForTable.habits) as any;
        if (h.schedule && typeof h.schedule.startDate === 'string') h.schedule.startDate = new Date(h.schedule.startDate);
        return h;
      });
      const entries = (entriesData || []).map(r => fromDbRow(r, dateFieldsForTable.entries));
      const identities = (identitiesData || []).map(r => fromDbRow(r, dateFieldsForTable.identities));
      const notes = (notesData || []).map(r => fromDbRow(r, dateFieldsForTable.notes));

      await clearAllHabits()
      for (const h of habits) await saveHabit(h)
      habitsStore.set(habits)

      await clearAllEntries()
      for (const e of entries) await saveEntry(e)
      entriesStore.set(entries)

      await clearAllIdentities()
      for (const i of identities) await saveIdentity(i)
      identitiesStore.set(identities)

      await clearAllNotes()
      for (const n of notes) await saveNote(n)
      notesStore.set(notes)

      if (settingsData) {
        appSettings.set({
          resetTime: settingsData.reset_time || '00:00',
          themeMode: settingsData.theme_mode || 'system',
          oled: settingsData.oled ?? false,
          accentColor: settingsData.accent_color || '',
          mainColor: settingsData.main_color || '',
          launchScreen: settingsData.launch_screen || '/today',
        });
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
