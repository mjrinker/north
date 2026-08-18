// src/lib/backfill.ts
// Client wrapper for the backfillHabit GraphQL mutation. The backend does the
// heavy lifting (per-day condition checks + skip rules); this module just sends
// the request and replays the returned entries into the local cache and store.

import type { HabitEntry } from '../types';
import { gql } from './api';
import { encodeId, decodeId } from './globalId';
import { saveEntry } from '../services/storage';
import { entriesStore } from '../stores/entries';

export type BackfillValueMode = 'VALUE' | 'STANDARD' | 'TARGET' | 'LINKED';

export interface BackfillOptions {
  habitId: string;
  startDate: string;
  endDate: string;
  valueMode: BackfillValueMode;
  value?: number;
  linkedHabitId?: string;
  conditionHabitIds?: string[];
  conditionMode?: 'and' | 'or';
  skipWeekdays?: number[];
  skipDates?: string[];
  skipLogged?: boolean;
  skipAtOrAbove?: boolean;
}

export interface BackfillResult {
  habitId: string;
  totalDays: number;
  appliedDays: number;
  skippedDays: number;
  entries: HabitEntry[];
}

interface ApiBackfillEntry {
  id: string;
  habitId: string;
  date: string;
  value: number;
  standardMet: boolean;
  targetMet: boolean;
  notes?: string | null;
  updatedAt: string;
}

export async function backfillHabit(opts: BackfillOptions): Promise<BackfillResult> {
  const res = await gql<{
    backfillHabit: Omit<BackfillResult, 'entries'> & { entries: ApiBackfillEntry[] };
  }>(
    `mutation BackfillHabit($input: BackfillHabitInput!) {
      backfillHabit(input: $input) {
        totalDays
        appliedDays
        skippedDays
        entries { id habitId date value standardMet targetMet updatedAt }
      }
    }`,
    {
      input: {
        habitId: encodeId('Habit', opts.habitId),
        startDate: opts.startDate,
        endDate: opts.endDate,
        valueMode: opts.valueMode,
        value: opts.value ?? null,
        linkedHabitId: opts.linkedHabitId ? encodeId('Habit', opts.linkedHabitId) : null,
        conditionHabitIds: (opts.conditionHabitIds ?? []).map(id => encodeId('Habit', id)),
        conditionMode: opts.conditionMode ?? 'and',
        skipWeekdays: opts.skipWeekdays ?? [],
        skipDates: opts.skipDates ?? [],
        skipLogged: opts.skipLogged ?? false,
        skipAtOrAbove: opts.skipAtOrAbove ?? false,
      },
    },
  );

  const entries: HabitEntry[] = (res?.backfillHabit?.entries ?? []).map((e: ApiBackfillEntry) => ({
    id: decodeId(e.id),
    habitId: decodeId(e.habitId),
    date: e.date,
    value: e.value,
    standardMet: e.standardMet,
    targetMet: e.targetMet,
    notes: e.notes ?? undefined,
    updatedAt: new Date(e.updatedAt),
  }));

  // Replay into IndexedDB + the store so UI reads (history, today) reflect the
  // backfill immediately without waiting for a full sync pull. No outbox push:
  // the backend already persisted these rows.
  for (const entry of entries) {
    try { await saveEntry(entry); } catch { /* cache write failures are non-fatal */ }
  }
  if (entries.length) {
    entriesStore.update(list => {
      const updated = [...list];
      for (const entry of entries) {
        const idx = updated.findIndex(x => x.id === entry.id);
        if (idx >= 0) updated[idx] = entry;
        else updated.push(entry);
      }
      return updated;
    });
  }

  return {
    habitId: decodeId(res?.backfillHabit?.habitId ?? ''),
    totalDays: res?.backfillHabit?.totalDays ?? 0,
    appliedDays: res?.backfillHabit?.appliedDays ?? 0,
    skippedDays: res?.backfillHabit?.skippedDays ?? 0,
    entries,
  };
}