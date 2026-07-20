import { writable, get } from 'svelte/store'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export const user = writable<User | null>(null)
export const session = writable<any>(null)
export const isLoading = writable(true)

let syncScheduled = false

async function triggerSync() {
  if (syncScheduled) return
  syncScheduled = true
  console.log('[sync] triggerSync started')

  const { supabaseSyncProvider } = await import('../services/sync.providers/supabase')

  // download first so remote data (likely more complete) populates local state
  const downloadResult = await supabaseSyncProvider.downloadAll()
  console.log('[sync] downloadAll result:', downloadResult)

  const { habitsStore } = await import('./habits')
  const { entriesStore } = await import('./entries')
  const { identitiesStore } = await import('./identities')
  const { notesStore } = await import('./notes')

  const hasLocal = get(habitsStore).length > 0
    || get(entriesStore).length > 0
    || get(identitiesStore).length > 0
    || get(notesStore).length > 0

  if (hasLocal) {
    await supabaseSyncProvider.uploadAll()
  }
}

supabase.auth.onAuthStateChange((event, sessionData) => {
  user.set(sessionData?.user ?? null)
  session.set(sessionData)
  if (event !== 'INITIAL_SESSION') isLoading.set(false)

  if (event === 'SIGNED_IN') {
    console.log('[sync] SIGNED_IN — scheduling sync in 1500ms')
    setTimeout(triggerSync, 1500)
  } else if (event === 'INITIAL_SESSION' && sessionData?.user) {
    console.log('[sync] INITIAL_SESSION with user — scheduling sync in 1500ms')
    setTimeout(triggerSync, 1500)
  }
})

supabase.auth.getSession().then(({ data: { session: s } }) => {
  user.set(s?.user ?? null)
  session.set(s)
  isLoading.set(false)
})

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' }
  })
  if (error) console.error('Sign in error:', error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}
