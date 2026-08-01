// src/lib/backend.ts
// Toggle between the new GraphQL backend ("new") and the legacy direct-to-Supabase
// paths ("old"). Persisted so it survives reloads.

import { writable, get } from 'svelte/store';

export type BackendMode = 'new' | 'old';

const KEY = 'north_backend';

function load(): BackendMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'old' || v === 'new') return v;
  } catch {}
  return 'new';
}

function persist(m: BackendMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {}
}

export const backendMode = writable<BackendMode>(load());
backendMode.subscribe(persist);

export function getBackendMode(): BackendMode {
  return get(backendMode);
}

export function isNewBackend(): boolean {
  return getBackendMode() === 'new';
}

export function toggleBackendMode(): BackendMode {
  backendMode.update(m => (m === 'new' ? 'old' : 'new'));
  return getBackendMode();
}
