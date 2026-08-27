// src/lib/api.ts
// GraphQL client for the north-api backend.

const API_BASE = (import.meta.env.PUBLIC_API_URL || 'https://north-api-rho.vercel.app').replace(/\/+$/, '');
export const GRAPHQL_URL = API_BASE + '/graphql';

const TOKEN_KEY = 'north_token';
const TOKEN_COOKIE = 'north_token';
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

function readCookieToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)north_token=([^;]*)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  let t: string | null = null;
  try {
    t = localStorage.getItem(TOKEN_KEY);
  } catch {}
  if (t) return t;
  const c = readCookieToken();
  if (c) {
    try {
      localStorage.setItem(TOKEN_KEY, c);
    } catch {}
  }
  return c;
}

export function setToken(token: string | null) {
  const value = token || '';
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('[auth] localStorage write failed', e);
  }
  try {
    const cookie = value
      ? `${TOKEN_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${TOKEN_MAX_AGE}; samesite=lax${typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : ''}`
      : `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
    document.cookie = cookie;
  } catch (e) {
    console.error('[auth] cookie write failed', e);
  }
}

export function clearToken() {
  setToken(null);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly errors: unknown[] = [],
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface GqlOptions {
  auth?: boolean;
}

export async function gql<T = any>(
  query: string,
  variables?: Record<string, unknown>,
  opts?: GqlOptions,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.auth !== false) {
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }

  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch {
    throw new ApiError('Network error: unable to reach API');
  }

  const body = await res.json().catch(() => null);
  console.log('[gql] Response:', { status: res.status, body });
  if (body?.errors?.length) {
    const first = body.errors[0];
    console.error('[gql] GraphQL errors:', body.errors);
    throw new ApiError(first?.message ?? 'GraphQL error', body.errors, res.status);
  }
  if (!res.ok) {
    console.error('[gql] HTTP error:', res.status, body);
    throw new ApiError(`HTTP ${res.status}: ${body?.message ?? 'Unknown error'}`, [], res.status);
  }
  return body?.data;
}
