import type { SyncProvider, SyncResult } from '../../types'
import { habitsStore } from '../../stores/habits'
import { entriesStore } from '../../stores/entries'
import { identitiesStore } from '../../stores/identities'
import { notesStore } from '../../stores/notes'
import { appSettings } from '../../lib/settings'
import { get } from 'svelte/store'
import { supabase } from '../../lib/supabase'
import { user } from '../../stores/auth'


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
        tags: data.tags ?? [],
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
        status: data.status ?? 'active',
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
        tags: row.tags ?? [],
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
        status: row.status ?? 'active',
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

  private async saveToNew(collection: string, uid: string, data: any): Promise<void> {
    const table = NEW_TABLES[collection]
    if (!table) return
    const row = toNewRow(collection, uid, data)
    const pk = collection === 'settings' ? 'user_id' : collection === 'entries' ? 'habit_id,date' : 'id'
    const { error } = await supabase.from(table).upsert(row, { onConflict: pk })
    if (error) throw error
  }

  private async saveToOld(collection: string, uid: string, id: string, data: any): Promise<void> {
    const { error } = await supabase.from(OLD_TABLE).upsert({
      user_id: uid,
      collection,
      record_id: id,
      data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,collection,record_id' })
    if (error) throw error
  }

  async saveRecord(collection: string, id: string, data: any): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const results = await Promise.allSettled([
      this.saveToNew(collection, uid, data),
      this.saveToOld(collection, uid, id, data),
    ])

    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (rejected.length === results.length) {
      throw new Error(`Save failed: ${rejected.map(r => r.reason?.message ?? 'unknown').join('; ')}`)
    }
  }

  async getRecord(collection: string, id: string): Promise<any> {
    const uid = this.getUserId()
    if (!uid) return undefined

    const table = NEW_TABLES[collection]
    if (!table) return undefined
    const pk = collection === 'settings' ? 'user_id' : 'id'
    const { data, error } = await supabase.from(table).select('*').eq(pk, id).single()
    if (error || !data) return undefined
    return fromNewRow(collection, data)
  }

  async deleteRecord(collection: string, id: string): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('Not signed in')

    const table = NEW_TABLES[collection]
    const pk = collection === 'settings' ? 'user_id' : 'id'
    const newDel = table ? supabase.from(table).delete().eq(pk, id) : Promise.resolve()
    const oldDel = supabase.from(OLD_TABLE).delete().eq('user_id', uid).eq('collection', collection).eq('record_id', id)

    const results = await Promise.allSettled([newDel, oldDel])
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (rejected.length === results.length) {
      throw new Error(`Delete failed: ${rejected.map(r => r.reason?.message ?? 'unknown').join('; ')}`)
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
      const settings = get(appSettings)

      const dedupedEntries = Array.from(
        entries.reduce((map, e) => {
          const key = `${e.habitId}|${e.date}`
          const existing = map.get(key)
          if (!existing || e.updatedAt > existing.updatedAt) map.set(key, e)
          return map
        }, new Map()).values()
      )

      const promises: Promise<void>[] = []

      const newHabitRows = habits.map(h => toNewRow('habits', uid, h))
      if (newHabitRows.length > 0) {
        promises.push(
          supabase.from('habits').upsert(newHabitRows, { onConflict: 'id' }).then(r => { if (r.error) throw r.error })
        )
      }

      const newEntryRows = dedupedEntries.map(e => toNewRow('entries', uid, e))
      if (newEntryRows.length > 0) {
        promises.push(
          supabase.from('entries').upsert(newEntryRows, { onConflict: 'habit_id,date' }).then(r => { if (r.error) throw r.error })
        )
      }

      const newIdentityRows = identities.map(i => toNewRow('identities', uid, i))
      if (newIdentityRows.length > 0) {
        promises.push(
          supabase.from('identities').upsert(newIdentityRows, { onConflict: 'id' }).then(r => { if (r.error) throw r.error })
        )
      }

      const newNoteRows = notes.map(n => toNewRow('notes', uid, n))
      if (newNoteRows.length > 0) {
        promises.push(
          supabase.from('notes').upsert(newNoteRows, { onConflict: 'id' }).then(r => { if (r.error) throw r.error })
        )
      }

      promises.push(
        supabase.from('user_settings').upsert(toNewRow('settings', uid, settings), { onConflict: 'user_id' }).then(r => { if (r.error) throw r.error })
      )

      const oldRows: any[] = [
        ...habits.map(h => ({ user_id: uid, collection: 'habits', record_id: h.id, data: h, updated_at: new Date().toISOString() })),
        ...dedupedEntries.map(e => ({ user_id: uid, collection: 'entries', record_id: e.id, data: e, updated_at: new Date().toISOString() })),
        ...identities.map(i => ({ user_id: uid, collection: 'identities', record_id: i.id, data: i, updated_at: new Date().toISOString() })),
        ...notes.map(n => ({ user_id: uid, collection: 'notes', record_id: n.id, data: n, updated_at: new Date().toISOString() })),
        { user_id: uid, collection: 'settings', record_id: 'app_settings', data: settings, updated_at: new Date().toISOString() },
      ]
      if (oldRows.length > 0) {
        promises.push(
          supabase.from(OLD_TABLE).upsert(oldRows, { onConflict: 'user_id,collection,record_id' }).then(r => { if (r.error) throw r.error })
        )
      }

      const results = await Promise.allSettled(promises)
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
      if (rejected.length > 0) {
        console.error(`uploadAll: ${rejected.length}/${results.length} operations failed`)
      }
      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch (e: any) {
      return { lastSynced: start, status: 'error', conflicts: [] }
    }
  }

  private async migrateOldToNew(uid: string): Promise<void> {
    const migrated = typeof localStorage !== 'undefined' && localStorage.getItem('migrated_old_to_new')
    if (migrated) return

    const { data: oldRows } = await supabase.from(OLD_TABLE).select('*').eq('user_id', uid).limit(1)
    if (!oldRows || oldRows.length === 0) return

    const { data: newHabits } = await supabase.from('habits').select('id').eq('user_id', uid).limit(1)
    if (newHabits && newHabits.length > 0) return

    const { data: allOld } = await supabase.from(OLD_TABLE).select('*').eq('user_id', uid)
    if (!allOld || allOld.length === 0) return

    const collectionMap: Record<string, any[]> = { habits: [], entries: [], identities: [], notes: [] }
    let settingsRow: any = null

    for (const row of allOld) {
      if (row.collection in collectionMap) {
        collectionMap[row.collection].push(row.data)
      } else if (row.collection === 'settings') {
        settingsRow = row.data
      }
    }

    const promises: Promise<any>[] = []

    if (collectionMap.habits.length > 0) {
      promises.push(
        supabase.from('habits').upsert(collectionMap.habits.map(h => toNewRow('habits', uid, h)), { onConflict: 'id' })
      )
    }
    if (collectionMap.entries.length > 0) {
      promises.push(
        supabase.from('entries').upsert(collectionMap.entries.map(e => toNewRow('entries', uid, e)), { onConflict: 'habit_id,date' })
      )
    }
    if (collectionMap.identities.length > 0) {
      promises.push(
        supabase.from('identities').upsert(collectionMap.identities.map(i => toNewRow('identities', uid, i)), { onConflict: 'id' })
      )
    }
    if (collectionMap.notes.length > 0) {
      promises.push(
        supabase.from('notes').upsert(collectionMap.notes.map(n => toNewRow('notes', uid, n)), { onConflict: 'id' })
      )
    }
    if (settingsRow) {
      promises.push(
        supabase.from('user_settings').upsert(toNewRow('settings', uid, settingsRow), { onConflict: 'user_id' })
      )
    }

    const results = await Promise.allSettled(promises)
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (rejected.length > 0) {
      console.error(`migrateOldToNew: ${rejected.length}/${results.length} migrations failed`)
    }
    try { localStorage.setItem('migrated_old_to_new', '1') } catch {}
  }

  async downloadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('Not signed in')

      const { setSyncEnabled } = await import('../sync')
      setSyncEnabled(false)

      await this.migrateOldToNew(uid)

      const { saveHabit, saveEntry, saveIdentity, saveNote } = await import('../storage')

      const habits = get(habitsStore)
      const entries = get(entriesStore)
      const identities = get(identitiesStore)
      const notes = get(notesStore)

      const { data: habitRows, error: he } = await supabase.from('habits').select('*').eq('user_id', uid)
      if (he) throw new Error(he.message)
      if (habitRows) {
        const merged = [...habits]
        for (const row of habitRows) {
          try {
            const data = fromNewRow('habits', row)
            const idx = merged.findIndex(h => h.id === data.id)
            if (idx >= 0) merged[idx] = data; else merged.push(data)
          } catch {}
        }
        habitsStore.set(merged)
        for (const h of merged) { try { await saveHabit(h) } catch {} }
      }

      const { data: entryRows, error: ee } = await supabase.from('entries').select('*').eq('user_id', uid)
      if (ee) throw new Error(ee.message)
      if (entryRows) {
        const merged = [...entries]
        for (const row of entryRows) {
          try {
            const data = fromNewRow('entries', row)
            const idx = merged.findIndex(e => e.id === data.id)
            if (idx >= 0) merged[idx] = data; else merged.push(data)
          } catch {}
        }
        entriesStore.set(merged)
        for (const e of merged) { try { await saveEntry(e) } catch {} }
      }

      const { data: identityRows, error: ie } = await supabase.from('identities').select('*').eq('user_id', uid)
      if (ie) throw new Error(ie.message)
      if (identityRows) {
        const merged = [...identities]
        for (const row of identityRows) {
          try {
            const data = fromNewRow('identities', row)
            const idx = merged.findIndex(i => i.id === data.id)
            if (idx >= 0) merged[idx] = data; else merged.push(data)
          } catch {}
        }
        identitiesStore.set(merged)
        for (const i of merged) { try { await saveIdentity(i) } catch {} }
      }

      const { data: noteRows, error: ne } = await supabase.from('notes').select('*').eq('user_id', uid)
      if (ne) throw new Error(ne.message)
      if (noteRows) {
        const merged = [...notes]
        for (const row of noteRows) {
          try {
            const data = fromNewRow('notes', row)
            const idx = merged.findIndex(n => n.id === data.id)
            if (idx >= 0) merged[idx] = data; else merged.push(data)
          } catch {}
        }
        notesStore.set(merged)
        for (const n of merged) { try { await saveNote(n) } catch {} }
      }

      const { data: settingsRows, error: se } = await supabase.from('user_settings').select('*').eq('user_id', uid)
      if (se) throw new Error(se.message)
      if (settingsRows && settingsRows.length > 0) {
        appSettings.set(fromNewRow('settings', settingsRows[0]))
      }

      setSyncEnabled(true)
      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch {
      setSyncEnabled(true)
      return { lastSynced: start, status: 'error', conflicts: [] }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getUserId()
  }
}

export const supabaseSyncProvider = new SupabaseSyncProvider()
