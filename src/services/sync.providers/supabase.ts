import type { SyncProvider, SyncResult } from '../../types'
import { habitsStore } from '../../stores/habits'
import { entriesStore } from '../../stores/entries'
import { identitiesStore } from '../../stores/identities'
import { notesStore } from '../../stores/notes'
import { appSettings } from '../../lib/settings'
import { get } from 'svelte/store'
import { supabase } from '../../lib/supabase'
import { user } from '../../stores/auth'
import { getSchema } from '../../lib/schemaToggle'

const OLD_TABLE = 'user_sync_data'

const NEW_TABLES: Record<string, string> = {
  habits: 'habits',
  entries: 'entries',
  notes: 'notes',
  identities: 'identities',
  settings: 'user_settings',
}

function toNewRow(collection: string, userId: string, data: any) {
  switch (collection) {
    case 'habits':
      return {
        id: data.id,
        user_id: userId,
        title: data.title,
        description: data.description,
        type: data.type,
        standard: data.standard,
        target: data.target,
        unit: data.unit,
        schedule: data.schedule,
        metadata: data.metadata,
        depends_on: data.dependsOn,
        identity_id: data.identityId,
        tags: data.tags,
        status: data.status,
        created_at: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt,
        updated_at: new Date().toISOString(),
      }
    case 'entries':
      return {
        id: data.id,
        user_id: userId,
        habit_id: data.habitId,
        date: data.date,
        value: data.value,
        standard_met: data.standardMet,
        target_met: data.targetMet,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      }
    case 'notes':
      return {
        id: data.id,
        user_id: userId,
        habit_id: data.habitId,
        date: data.date,
        content: data.content,
        created_at: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt,
      }
    case 'identities':
      return {
        id: data.id,
        user_id: userId,
        name: data.name,
        description: data.description,
        goals: data.goals,
        created_at: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt,
      }
    case 'settings':
      return {
        user_id: userId,
        reset_time: data.resetTime,
        theme_mode: data.themeMode,
        oled: data.oled,
        accent_color: data.accentColor,
        main_color: data.mainColor,
        launch_screen: data.launchScreen,
        updated_at: new Date().toISOString(),
      }
  }
}

function fromNewRow(collection: string, row: any) {
  switch (collection) {
    case 'habits':
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        standard: row.standard,
        target: row.target,
        unit: row.unit,
        schedule: row.schedule,
        metadata: row.metadata,
        dependsOn: row.depends_on,
        identityId: row.identity_id,
        tags: row.tags,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    case 'entries':
      return {
        id: row.id,
        habitId: row.habit_id,
        date: row.date,
        value: row.value,
        standardMet: row.standard_met,
        targetMet: row.target_met,
        notes: row.notes,
        updatedAt: row.updated_at,
      }
    case 'notes':
      return {
        id: row.id,
        habitId: row.habit_id,
        date: row.date,
        content: row.content,
        createdAt: row.created_at,
      }
    case 'identities':
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        goals: row.goals,
        createdAt: row.created_at,
      }
    case 'settings':
      return {
        resetTime: row.reset_time,
        themeMode: row.theme_mode,
        oled: row.oled,
        accentColor: row.accent_color,
        mainColor: row.main_color,
        launchScreen: row.launch_screen,
      }
  }
}

class SupabaseSyncProvider implements SyncProvider {
  providerId = 'supabase'

  private getUserId(): string | null {
    const u = get(user)
    return u?.id ?? null
  }

  async saveRecord(collection: string, id: string, data: any): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    if (getSchema() === 'new') {
      const table = NEW_TABLES[collection]
      if (!table) throw new Error(`Unknown collection: ${collection}`)
      const row = toNewRow(collection, uid, data)
      const pk = collection === 'settings' ? 'user_id' : collection === 'entries' ? 'habit_id,date' : 'id'
      const { error } = await supabase.from(table).upsert(row, { onConflict: pk })
      if (error) throw new Error(`Save failed: ${error.message}`)
    } else {
      const { error } = await supabase.from(OLD_TABLE).upsert({
        user_id: uid,
        collection,
        record_id: id,
        data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,collection,record_id' })
      if (error) throw new Error(`Save failed: ${error.message}`)
    }
  }

  async getRecord(collection: string, id: string): Promise<any> {
    const uid = this.getUserId()
    if (!uid) return undefined

    if (getSchema() === 'new') {
      const table = NEW_TABLES[collection]
      if (!table) return undefined
      const pk = collection === 'settings' ? 'user_id' : 'id'
      const { data, error } = await supabase.from(table).select('*').eq(pk, id).single()
      if (error || !data) return undefined
      return fromNewRow(collection, data)
    } else {
      const { data, error } = await supabase
        .from(OLD_TABLE)
        .select('data')
        .eq('user_id', uid)
        .eq('collection', collection)
        .eq('record_id', id)
        .single()
      if (error || !data) return undefined
      return data.data
    }
  }

  async deleteRecord(collection: string, id: string): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    if (getSchema() === 'new') {
      const table = NEW_TABLES[collection]
      if (!table) throw new Error(`Unknown collection: ${collection}`)
      const pk = collection === 'settings' ? 'user_id' : 'id'
      const { error } = await supabase.from(table).delete().eq(pk, id)
      if (error) throw new Error(`Delete failed: ${error.message}`)
    } else {
      const { error } = await supabase
        .from(OLD_TABLE)
        .delete()
        .eq('user_id', uid)
        .eq('collection', collection)
        .eq('record_id', id)
      if (error) throw new Error(`Delete failed: ${error.message}`)
    }
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

      if (getSchema() === 'new') {
        const habitRows = habits.map(h => toNewRow('habits', uid, h))
        if (habitRows.length > 0) {
          const { error } = await supabase.from('habits').upsert(habitRows, { onConflict: 'id' })
          if (error) throw new Error(error.message)
        }
        const entryRows = entries.map(e => toNewRow('entries', uid, e))
        if (entryRows.length > 0) {
          const { error } = await supabase.from('entries').upsert(entryRows, { onConflict: 'habit_id,date' })
          if (error) throw new Error(error.message)
        }
        const identityRows = identities.map(i => toNewRow('identities', uid, i))
        if (identityRows.length > 0) {
          const { error } = await supabase.from('identities').upsert(identityRows, { onConflict: 'id' })
          if (error) throw new Error(error.message)
        }
        const noteRows = notes.map(n => toNewRow('notes', uid, n))
        if (noteRows.length > 0) {
          const { error } = await supabase.from('notes').upsert(noteRows, { onConflict: 'id' })
          if (error) throw new Error(error.message)
        }
        const settings = get(appSettings)
        const settingsRow = toNewRow('settings', uid, settings)
        const { error } = await supabase.from('user_settings').upsert(settingsRow, { onConflict: 'user_id' })
        if (error) throw new Error(error.message)
      } else {
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
          const { error } = await supabase.from(OLD_TABLE).upsert(rows, { onConflict: 'user_id,collection,record_id' })
          if (error) throw new Error(error.message)
        }
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

      if (getSchema() === 'new') {
        const { setSyncEnabled } = await import('../sync')
        setSyncEnabled(false)

        const { data: habitRows, error: he } = await supabase.from('habits').select('*').eq('user_id', uid)
        if (he) throw new Error(he.message)
        for (const row of habitRows || []) {
          try {
            const data = fromNewRow('habits', row)
            const { addHabit, updateHabit } = await import('../../stores/habits')
            if (get(habitsStore).some(h => h.id === data.id)) {
              updateHabit(data)
            } else {
              addHabit(data)
            }
          } catch {}
        }

        const { data: entryRows, error: ee } = await supabase.from('entries').select('*').eq('user_id', uid)
        if (ee) throw new Error(ee.message)
        for (const row of entryRows || []) {
          try {
            const data = fromNewRow('entries', row)
            const { addEntry } = await import('../../stores/entries')
            if (get(entriesStore).some(e => e.id === data.id)) {
              entriesStore.updateItem(data)
            } else {
              addEntry(data)
            }
          } catch {}
        }

        const { data: identityRows, error: ie } = await supabase.from('identities').select('*').eq('user_id', uid)
        if (ie) throw new Error(ie.message)
        for (const row of identityRows || []) {
          try {
            const data = fromNewRow('identities', row)
            const { addIdentity, updateIdentity } = await import('../../stores/identities')
            if (get(identitiesStore).some(i => i.id === data.id)) {
              updateIdentity(data)
            } else {
              addIdentity(data)
            }
          } catch {}
        }

        const { data: noteRows, error: ne } = await supabase.from('notes').select('*').eq('user_id', uid)
        if (ne) throw new Error(ne.message)
        for (const row of noteRows || []) {
          try {
            const data = fromNewRow('notes', row)
            const { addNote } = await import('../../stores/notes')
            if (get(notesStore).some(n => n.id === data.id)) {
              notesStore.updateItem(data)
            } else {
              addNote(data)
            }
          } catch {}
        }

        const { data: settingsRows, error: se } = await supabase.from('user_settings').select('*').eq('user_id', uid)
        if (se) throw new Error(se.message)
        if (settingsRows && settingsRows.length > 0) {
          appSettings.set(fromNewRow('settings', settingsRows[0]))
        }

        setSyncEnabled(true)
      } else {
        let allRows: any[] = []
        const pageSize = 1000
        let rangeStart = 0
        while (true) {
          const { data, error } = await supabase
            .from(OLD_TABLE)
            .select('*')
            .eq('user_id', uid)
            .range(rangeStart, rangeStart + pageSize - 1)
          if (error) throw new Error(error.message)
          if (!data || data.length === 0) break
          allRows = allRows.concat(data)
          if (data.length < pageSize) break
          rangeStart += pageSize
        }

        if (allRows.length > 0) {
          const { setSyncEnabled } = await import('../sync')
          setSyncEnabled(false)
          for (const row of allRows) {
            try {
              if (row.collection === 'habits') {
                const { addHabit, updateHabit } = await import('../../stores/habits')
                if (get(habitsStore).some(h => h.id === row.record_id)) {
                  updateHabit(row.data)
                } else {
                  addHabit(row.data)
                }
              } else if (row.collection === 'entries') {
                const { addEntry } = await import('../../stores/entries')
                if (get(entriesStore).some(e => e.id === row.record_id)) {
                  entriesStore.updateItem(row.data)
                } else {
                  addEntry(row.data)
                }
              } else if (row.collection === 'identities') {
                const { addIdentity, updateIdentity } = await import('../../stores/identities')
                if (get(identitiesStore).some(i => i.id === row.record_id)) {
                  updateIdentity(row.data)
                } else {
                  addIdentity(row.data)
                }
              } else if (row.collection === 'notes') {
                const { addNote } = await import('../../stores/notes')
                if (get(notesStore).some(n => n.id === row.record_id)) {
                  notesStore.updateItem(row.data)
                } else {
                  addNote(row.data)
                }
              } else if (row.collection === 'settings' && row.record_id === 'app_settings') {
                appSettings.set(row.data)
              }
            } catch {}
          }
          setSyncEnabled(true)
        }
      }

      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch {
      return { lastSynced: start, status: 'error', conflicts: [] }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getUserId()
  }
}

export const supabaseSyncProvider = new SupabaseSyncProvider()
