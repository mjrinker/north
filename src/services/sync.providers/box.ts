// src/services/sync.providers/box.ts

import type { SyncProvider, SyncResult, SyncConflict } from '../../types'
import { habitsStore } from '../../stores/habits'
import { entriesStore } from '../../stores/entries'
import { identitiesStore } from '../../stores/identities'
import { get } from 'svelte/store'
import { boxFetch } from '$lib/box'
import { user } from '../../stores/auth'

class BoxSyncProvider implements SyncProvider {
  providerId = 'box'

  private getUserId(): string | null {
    const u = get(user)
    return u?.id ?? null
  }

  async saveRecord(collection: string, id: string, data: any): Promise<void> {
    const uid = this.getUserId()
    if (!uid) throw new Error('No user')

    const files = await this._listFiles(uid, collection)
    const existing = files.find(f => f.name === `${id}.json`)

    const body = JSON.stringify(data)
    const blob = new Blob([body], { type: 'application/json' })
    const file = new File([blob], `${id}.json`)

    if (existing) {
      const upRes = await boxFetch(uid, `/files/${existing.id}/content`, {
        method: 'PUT',
        body: file,
      })
      if (!upRes.ok) throw new Error(`Box saveRecord PUT failed: ${upRes.status}`)
    } else {
      const folderId = await this._ensureCollectionFolder(uid, collection)
      const form = new FormData()
      form.append('attributes', JSON.stringify({
        name: `${id}.json`,
        parent: { id: folderId },
      }))
      form.append('file', file)
      const upRes = await boxFetch(uid, '/files/content', {
        method: 'POST',
        body: form,
      })
      if (!upRes.ok) throw new Error(`Box saveRecord POST failed: ${upRes.status}`)
    }
  }

  async getRecord(collection: string, id: string): Promise<any> {
    const uid = this.getUserId()
    if (!uid) return undefined

    const files = await this._listFiles(uid, collection)
    const file = files.find(f => f.name === `${id}.json`)
    if (!file) return undefined

    const res = await boxFetch(uid, `/files/${file.id}/content`)
    if (!res.ok) return undefined
    return res.json()
  }

  async uploadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('No user')

      const habits = get(habitsStore)
      const entries = get(entriesStore)
      const identities = get(identitiesStore)

      for (const h of habits) {
        await this.saveRecord('habits', h.id, h)
      }
      for (const e of entries) {
        await this.saveRecord('entries', e.id, e)
      }
      for (const i of identities) {
        await this.saveRecord('identities', i.id, i)
      }

      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch (e: any) {
      return {
        lastSynced: start,
        status: 'error',
        conflicts: [{ id: 'upload', localVersion: null, remoteVersion: null, resolution: 'manual' }],
      }
    }
  }

  async downloadAll(): Promise<SyncResult> {
    const start = new Date()
    try {
      const uid = this.getUserId()
      if (!uid) throw new Error('No user')
      return { lastSynced: start, status: 'success', conflicts: [] }
    } catch (e: any) {
      return {
        lastSynced: start,
        status: 'error',
        conflicts: [{ id: 'download', localVersion: null, remoteVersion: null, resolution: 'manual' }],
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    const uid = this.getUserId()
    if (!uid) return false
    try {
      const res = await boxFetch(uid, '/users/me')
      return res.ok
    } catch {
      return false
    }
  }

  private async _ensureCollectionFolder(uid: string, collection: string): Promise<string> {
    const rootId = await this._ensureAppFolder(uid)
    const list = await this._listItems(uid, rootId)
    const existing = list.find(i => i.name === collection && i.type === 'folder')
    if (existing) return existing.id

    const res = await boxFetch(uid, '/folders', {
      method: 'POST',
      body: JSON.stringify({
        name: collection,
        parent: { id: rootId },
      }),
    })
    if (!res.ok) throw new Error(`Failed to create ${collection} folder`)
    const data = await res.json()
    return data.id
  }

  private async _ensureAppFolder(uid: string): Promise<string> {
    const res = await boxFetch(uid, '/folders/0/items', {
      method: 'GET',
    })
    if (!res.ok) throw new Error('Cannot access Box root')

    const items = await res.json()
    const existing = (items.entries ?? []).find(
      (i: any) => i.name === 'NorthHabitTracker' && i.type === 'folder'
    )
    if (existing) return existing.id

    const createRes = await boxFetch(uid, '/folders', {
      method: 'POST',
      body: JSON.stringify({
        name: 'NorthHabitTracker',
        parent: { id: '0' },
      }),
    })
    if (!createRes.ok) throw new Error('Failed to create app folder')
    const data = await createRes.json()
    return data.id
  }

  private async _listItems(uid: string, folderId: string): Promise<any[]> {
    const res = await boxFetch(uid, `/folders/${folderId}/items?limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries ?? []
  }

  private async _listFiles(uid: string, collection: string): Promise<any[]> {
    const folderId = await this._ensureCollectionFolder(uid, collection)
    return this._listItems(uid, folderId)
  }
}

export const boxSyncProvider = new BoxSyncProvider()
