import { env } from '$env/dynamic/public'

const TOKEN_DB = 'north-box-tokens'
const TOKEN_STORE = 'tokens'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(TOKEN_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(TOKEN_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(verifier))
  return base64url(hash)
}

export function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const arr = new Uint8Array(64)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => chars[b % chars.length]).join('')
}

export interface BoxTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export async function getBoxTokens(userId: string): Promise<BoxTokens | null> {
  const db = await openDb()
  return new Promise(resolve => {
    const tx = db.transaction(TOKEN_STORE, 'readonly')
    const req = tx.objectStore(TOKEN_STORE).get(userId)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

export async function setBoxTokens(userId: string, tokens: BoxTokens) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).put(tokens, userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearBoxTokens(userId: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKEN_STORE, 'readwrite')
    tx.objectStore(TOKEN_STORE).delete(userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function startBoxOAuth(userId: string) {
  const verifier = generateCodeVerifier()
  sessionStorage.setItem('box_code_verifier', verifier)
  sessionStorage.setItem('box_user_id', userId)
  generateCodeChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.PUBLIC_STORE_BOX_CLIENT_ID ?? '',
      redirect_uri: `${env.PUBLIC_STORE_ORIGIN ?? window.location.origin}/settings/box-callback`,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: userId,
    })
    window.location.href = `https://account.box.com/api/oauth2/authorize?${params}`
  })
}

export async function exchangeCodeForTokens(code: string): Promise<BoxTokens> {
  const verifier = sessionStorage.getItem('box_code_verifier')
  if (!verifier) throw new Error('Missing code_verifier')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.PUBLIC_STORE_BOX_CLIENT_ID ?? '',
    redirect_uri: `${env.PUBLIC_STORE_ORIGIN ?? window.location.origin}/settings/box-callback`,
    code_verifier: verifier,
  })

  const res = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshBoxTokens(refreshToken: string): Promise<BoxTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.PUBLIC_STORE_BOX_CLIENT_ID ?? '',
  })

  const res = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function ensureValidTokens(userId: string): Promise<BoxTokens | null> {
  const tokens = await getBoxTokens(userId)
  if (!tokens) return null
  if (Date.now() < tokens.expiresAt - 60000) return tokens
  try {
    const refreshed = await refreshBoxTokens(tokens.refreshToken)
    await setBoxTokens(userId, refreshed)
    return refreshed
  } catch {
    await clearBoxTokens(userId)
    return null
  }
}

export async function boxFetch(userId: string, path: string, init?: RequestInit): Promise<Response> {
  const tokens = await ensureValidTokens(userId)
  if (!tokens) throw new Error('Box not connected')
  return fetch(`https://api.box.com/2.0${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  })
}
