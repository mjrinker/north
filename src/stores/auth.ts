// src/stores/auth.ts
import { writable, get } from 'svelte/store'
import { getToken, setToken, gql } from '../lib/api'
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public'
import type { AppAuthUser } from '../types/user'

export const user = writable<AppAuthUser | null>(null)
export const isLoading = writable(true)

let syncScheduled = false

async function triggerSync() {
  if (syncScheduled) return
  syncScheduled = true

  try {
    const { apiSyncProvider } = await import('../services/sync.providers/api')

    const { habitsStore } = await import('./habits')
    const { entriesStore } = await import('./entries')
    const { identitiesStore } = await import('./identities')
    const { notesStore } = await import('./notes')

    const hasLocal = get(habitsStore).length > 0
      || get(entriesStore).length > 0
      || get(identitiesStore).length > 0
      || get(notesStore).length > 0

    await apiSyncProvider.downloadAll()

    if (hasLocal) {
      await apiSyncProvider.uploadAll()
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

async function init() {
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

init()

const GOOGLE_CLIENT_ID = PUBLIC_GOOGLE_CLIENT_ID || ''

function loadGoogleIdentity(): Promise<any> {
  return new Promise((resolve, reject) => {
    const check = () => (window as any).google?.accounts && resolve((window as any).google)
    if (check()) return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = check
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
    let tries = 0
    const timer = window.setInterval(() => {
      tries++
      if ((window as any).google?.accounts) {
        window.clearInterval(timer)
        resolve((window as any).google)
      } else if (tries > 100) {
        window.clearInterval(timer)
      }
    }, 100)
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

export function renderGoogleButton(el: HTMLElement) {
  function showError(msg: string) {
    el.innerHTML = ''
    const p = document.createElement('p')
    p.className = 'google-signin-error'
    p.textContent = msg
    el.appendChild(p)
  }
  if (!GOOGLE_CLIENT_ID) {
    showError('Google sign-in is not configured: missing PUBLIC_GOOGLE_CLIENT_ID in the build environment.')
    console.error('PUBLIC_GOOGLE_CLIENT_ID is not set')
    return
  }
  loadGoogleIdentity()
    .then((google) => {
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: false,
          callback: async (resp: any) => {
            if (resp?.credential) await completeGoogleSignIn(resp.credential)
          },
        })
        google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 240,
          shape: 'rectangular',
          text: 'signin_with',
        })
      } catch (e: any) {
        showError('Google sign-in failed to render: ' + (e?.message ?? String(e)))
      }
    })
    .catch((e: any) => {
      showError('Could not load Google sign-in SDK. Check your connection or ad-blocker, then reload. ' + (e?.message ?? String(e)))
    })
}

export async function signOut() {
  setToken(null)
  cacheUser(null)
  user.set(null)
}
