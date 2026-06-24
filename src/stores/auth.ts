import { writable } from 'svelte/store'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export const user = writable<User | null>(null)
export const session = writable<any>(null)
export const isLoading = writable(true)

supabase.auth.onAuthStateChange((event, sessionData) => {
  user.set(sessionData?.user ?? null)
  session.set(sessionData)
  if (event !== 'INITIAL_SESSION') isLoading.set(false)

  if (event === 'SIGNED_IN') {
    setTimeout(() => {
      import('../services/sync.providers/supabase').then(({ supabaseSyncProvider }) =>
        supabaseSyncProvider.uploadAll()
      )
    }, 1500)
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
