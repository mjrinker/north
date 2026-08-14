// src/services/syncState.ts
// Tracks the last successful sync watermark so incremental sync only pushes
// / pulls records that changed since that point, instead of syncing everything
// on every run. Also provides date helpers for download-range presets.
import { toDateStr } from '../lib/dates';

const WATERMARK_KEY = 'north:lastSyncedAt';

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(WATERMARK_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(iso: string): void {
  try {
    localStorage.setItem(WATERMARK_KEY, iso);
  } catch {}
}

// YYYY-MM-DD for `n` calendar days before today (no reset-time shift).
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}