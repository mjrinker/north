// src/stores/auth.ts
import { writable } from 'svelte/store'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export const user = writable<User | null>(null)
export const session = writable<any>(null)
export const isLoading = writable(true)

supabase.auth.onAuthStateChange((event, sessionData) => {
  user.set(sessionData?.user ?? null)
  session.set(sessionData)
  isLoading.set(false)
})

// Handle PKCE callback from any page — exchange ?code= and clean the URL
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (code) {
    supabase.auth.exchangeCodeForSession(code).finally(() => {
      window.history.replaceState({}, '', window.location.pathname)
    })
  }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) console.error('Sign in error:', error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}
