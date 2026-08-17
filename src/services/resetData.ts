// src/services/resetData.ts
// Clears all user data + settings stored on the local device (habits, history,
// identities, notes, outbox queue, and localStorage prefs). Does NOT touch the
// cloud/backend; that data survives unless overwritten by resync.
import {
  clearAllHabits,
  clearAllEntries,
  clearAllIdentities,
  clearAllNotes
} from './storage'
import { clearOutbox } from './outbox'
import { habitsStore } from '../stores/habits'
import { entriesStore } from '../stores/entries'
import { identitiesStore } from '../stores/identities'
import { notesStore } from '../stores/notes'
import { appSettings, defaultSettings } from '../lib/settings'

// localStorage keys this app uses for per-device state (excluding sessions
// like north_token / north_user, which are cleared on sign-out itself).
const LOCAL_STORAGE_KEYS = [
  'appSettings',
  'sortMode',
  'collapsedGroups',
  '__allTimerStates'
]

// Per-day keys have a shared prefix (e.g. autoDep_<habitId>_<date>).
const KEY_PREFIXES = ['autoDep_']

export async function clearLocalData(): Promise<void> {
  try {
    await Promise.all([
      clearAllHabits(),
      clearAllEntries(),
      clearAllIdentities(),
      clearAllNotes(),
      clearOutbox()
    ])
  } catch (e) {
    console.error('Failed to clear IndexedDB data:', e)
  }

  // Reset in-memory stores so the UI reflects the cleared device data.
  habitsStore.set([])
  entriesStore.set([])
  identitiesStore.set([])
  notesStore.set([])

  // Reset settings to defaults (also persists to localStorage).
  appSettings.set({ ...defaultSettings })

  // Drop each localStorage key we own.
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (
        LOCAL_STORAGE_KEYS.includes(key) ||
        KEY_PREFIXES.some(p => key.startsWith(p))
      ) {
        localStorage.removeItem(key)
      }
    }
  } catch (e) {
    console.error('Failed to clear localStorage:', e)
  }
}