// src/stores/auth.ts
import { writable, get } from 'svelte/store'
import { supabase } from '../lib/supabase'
import { getToken, setToken, gql } from '../lib/api'
import { isNewBackend } from '../lib/backend'
import type { AppAuthUser } from '../types/user'

export const user = writable<AppAuthUser | null>(null)
export const session = writable<any>(null)
export const isLoading = writable(true)

let syncScheduled = false

async function triggerSync() {
  if (syncScheduled) return
  syncScheduled = true

  try {
    const { getActiveProvider } = await import('../services/sync')
    const provider = await getActiveProvider()

    const { habitsStore } = await import('./habits')
    const { entriesStore } = await import('./entries')
    const { identitiesStore } = await import('./identities')
    const { notesStore } = await import('./notes')

    const hasLocal = get(habitsStore).length > 0
      || get(entriesStore).length > 0
      || get(identitiesStore).length > 0
      || get(notesStore).length > 0

    await provider.downloadAll()

    if (hasLocal) {
      await provider.uploadAll()
    }
  } catch (e) {
    console.error('Sync failed:', e)
  }
}

function toAppUser(me: any): AppAuthUser {
  return {
    id: me.id,
    email: me.email ?? null,
    name: me.name ?? null,
    avatar: me.avatar ?? null,
    user_metadata: {
      name: me.name ?? undefined,
      avatar_url: me.avatar ?? undefined,
    },
  }
}

const CACHED_USER_KEY = 'north_user'

function cacheUser(u: AppAuthUser | null) {
  try {
    if (u) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(CACHED_USER_KEY)
  } catch {}
}

function readCachedUser(): AppAuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    return raw ? (JSON.parse(raw) as AppAuthUser) : null
  } catch {
    return null
  }
}

// --- New backend (GraphQL API) ---

async function initNewBackend() {
  const token = getToken()
  if (!token) {
    user.set(null)
    isLoading.set(false)
    return
  }

  try {
    const data = await gql<{ me: any }>(`query { me { id email name avatar } }`)
    if (data?.me) {
      const u = toAppUser(data.me)
      user.set(u)
      cacheUser(u)
      setTimeout(triggerSync, 1500)
    } else {
      setToken(null)
      cacheUser(null)
      user.set(null)
    }
  } catch {
    const cached = readCachedUser()
    user.set(cached)
    if (cached) setTimeout(triggerSync, 1500)
  }
  isLoading.set(false)
}

const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID || ''

function loadGoogleIdentity(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts) return resolve((window as any).google)
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve((window as any).google)
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
}

async function completeGoogleSignIn(idToken: string) {
  isLoading.set(true)
  try {
    const data = await gql<{ googleSignIn: { token: string; user: any } }>(
      `mutation ($idToken: String!) {
         googleSignIn(idToken: $idToken) {
           token
           user { id email name avatar }
         }
       }`,
      { idToken },
      { auth: false },
    )
    setToken(data.googleSignIn.token)
    const u = toAppUser(data.googleSignIn.user)
    user.set(u)
    cacheUser(u)
    setTimeout(triggerSync, 1500)
  } catch (e: any) {
    console.error('Google sign-in failed:', e.message)
  }
  isLoading.set(false)
}

async function newBackendGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID) {
    console.error('PUBLIC_GOOGLE_CLIENT_ID is not set')
    return
  }
  try {
    const google = await loadGoogleIdentity()
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      callback: async (resp: any) => {
        if (resp?.credential) await completeGoogleSignIn(resp.credential)
      },
    })
    google.accounts.id.prompt()
  } catch (e: any) {
    console.error('Google sign-in error:', e.message)
  }
}

// --- Legacy backend (Supabase) ---

function toLegacyUser(u: any): AppAuthUser | null {
  if (!u) return null
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.user_metadata?.name ?? null,
    avatar: u.user_metadata?.avatar_url ?? null,
    user_metadata: u.user_metadata,
  }
}

function initLegacyBackend() {
  supabase.auth.onAuthStateChange((event, sessionData) => {
    user.set(toLegacyUser(sessionData?.user))
    session.set(sessionData)
    if (event !== 'INITIAL_SESSION') isLoading.set(false)

    if (event === 'SIGNED_IN') {
      setTimeout(triggerSync, 1500)
    } else if (event === 'INITIAL_SESSION' && sessionData?.user) {
      setTimeout(triggerSync, 1500)
    }
  })

  supabase.auth.getSession().then(({ data: { session: s } }) => {
    user.set(toLegacyUser(s?.user))
    session.set(s)
    isLoading.set(false)
  })
}

if (isNewBackend()) {
  initNewBackend()
} else {
  initLegacyBackend()
}

export function signInWithGoogle() {
  if (isNewBackend()) {
    newBackendGoogleSignIn()
    return
  }
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' },
  })
}

export async function signOut() {
  if (isNewBackend()) {
    setToken(null)
    cacheUser(null)
    user.set(null)
    session.set(null)
    return
  }
  await supabase.auth.signOut()
}
