// src/lib/api.ts
// GraphQL client for the north-api backend.

const API_BASE = (import.meta.env.PUBLIC_API_URL || 'https://north-api-rho.vercel.app').replace(/\/+$/, '');
export const GRAPHQL_URL = API_BASE + '/graphql';

const TOKEN_KEY = 'north_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
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
  if (body?.errors?.length) {
    const first = body.errors[0];
    throw new ApiError(first?.message ?? 'GraphQL error', body.errors, res.status);
  }
  return body?.data;
}
