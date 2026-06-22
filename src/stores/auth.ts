// src/stores/auth.ts
import { writable } from 'svelte/store'
import { supabase } from '../lib/supabase'
import { env } from '$env/dynamic/public'
import type { User } from '@supabase/supabase-js'

export const user = writable<User | null>(null)
export const session = writable<any>(null)
export const isLoading = writable(true)

supabase.auth.onAuthStateChange((event, sessionData) => {
  user.set(sessionData?.user ?? null)
  session.set(sessionData)
  isLoading.set(false)
})

export async function signInWithGoogle() {
  const origin = env.PUBLIC_STORE_ORIGIN || window.location.origin
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: origin + '/auth/callback' }
  })
  if (error) console.error('Sign in error:', error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}
