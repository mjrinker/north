// src/services/sync.providers/api.ts
// SyncProvider backed by the north-api GraphQL backend.

import type { SyncProvider, SyncResult } from '../../types';
import type { Habit, HabitEntry, HabitNote, Identity } from '../../types';
import { habitsStore } from '../../stores/habits';
import { entriesStore } from '../../stores/entries';
import { identitiesStore } from '../../stores/identities';
import { notesStore } from '../../stores/notes';
import { appSettings, type AppSettings } from '../../lib/settings';
import { get } from 'svelte/store';
import { gql, ApiError, getToken } from '../../lib/api';
import { encodeId, decodeId } from '../../lib/globalId';

const HABIT_FIELDS = `id title description type standard target unit schedule metadata dependsOn identityId tags status sortOrder createdAt updatedAt`;
const ENTRY_FIELDS = `id habitId date value standardMet targetMet notes updatedAt`;
const NOTE_FIELDS = `id habitId date content status createdAt`;
const IDENTITY_FIELDS = `id name description goals`;

function toDate(v: string | null | undefined): Date {
  return v ? new Date(v) : new Date();
}

function isMissingError(e: unknown): boolean {
  if (e instanceof ApiError) {
    return /multiple \(or no\) rows/i.test(e.message) || /no rows/i.test(e.message);
  }
  return false;
}

function toApiHabitInput(h: Habit) {
  return {
    title: h.title,
    description: h.description ?? null,
    type: h.type,
    standard: h.standard,
    target: h.target ?? null,
    unit: h.unit,
    schedule: h.schedule,
    metadata: h.metadata,
    identityId: encodeId('Identity', h.identityId) ?? null,
    dependsOn: h.dependsOn
      ? { ...h.dependsOn, habitIds: (h.dependsOn.habitIds ?? []).map(hid => encodeId('Habit', hid)) }
      : null,
    tags: h.tags ?? [],
    sortOrder: h.sortOrder ?? null,
  };
}

function fromApiHabit(h: any): Habit {
  const schedule = h.schedule && typeof h.schedule === 'object' ? { ...h.schedule } : h.schedule;
  if (schedule?.startDate) schedule.startDate = toDate(schedule.startDate);
  if (schedule?.endDate) schedule.endDate = toDate(schedule.endDate);
  const dependsOn = h.dependsOn && typeof h.dependsOn === 'object' && Array.isArray(h.dependsOn.habitIds)
    ? { ...h.dependsOn, habitIds: (h.dependsOn.habitIds as string[]).map(decodeId) }
    : h.dependsOn;
  return {
    id: decodeId(h.id),
    title: h.title,
    description: h.description ?? undefined,
    type: h.type,
    standard: h.standard,
    target: h.target ?? undefined,
    unit: h.unit,
    schedule,
    metadata: h.metadata ?? { remindersEnabled: false, reminderAdvanceMinutes: 30, streakFreezeDays: 0, allowBackdating: false },
    dependsOn,
    identityId: h.identityId ? decodeId(h.identityId) : undefined,
    tags: h.tags ?? [],
    status: h.status ?? 'active',
    createdAt: toDate(h.createdAt),
    updatedAt: toDate(h.updatedAt),
    ...(h.sortOrder != null ? { sortOrder: h.sortOrder } : {}),
  };
}

function fromApiEntry(e: any): HabitEntry {
  return {
    id: decodeId(e.id),
    habitId: decodeId(e.habitId),
    date: e.date,
    value: e.value,
    standardMet: e.standardMet,
    targetMet: e.targetMet,
    notes: e.notes ?? undefined,
    updatedAt: toDate(e.updatedAt),
  };
}

function fromApiNote(n: any): HabitNote {
  return {
    id: decodeId(n.id),
    habitId: decodeId(n.habitId),
    date: n.date,
    content: n.content ?? '',
    createdAt: toDate(n.createdAt),
    status: n.status ?? 'active',
  };
}

function fromApiIdentity(i: any): Identity {
  return {
    id: decodeId(i.id),
    name: i.name,
    description: i.description ?? undefined,
    goals: i.goals ?? [],
    createdAt: new Date(),
  };
}

class ApiSyncProvider implements SyncProvider {
  providerId = 'api';

  isAvailable(): Promise<boolean> {
    return Promise.resolve(!!getToken());
  }

  async saveRecord(collection: string, _id: string, data: any): Promise<void> {
    switch (collection) {
      case 'habits':
        return this.upsertHabit(data);
      case 'entries':
        return this.upsertEntry(data);
      case 'notes':
        if (data.status === 'deleted') return this.deleteNote(data.id);
        return this.upsertNote(data);
      case 'identities':
        return this.upsertIdentity(data);
      case 'settings':
        return this.upsertSettings(data);
    }
  }

  async getRecord(): Promise<any> {
    return undefined;
  }

  async deleteRecord(collection: string, id: string): Promise<void> {
    switch (collection) {
      case 'habits':
        try {
          await gql(`mutation ($id: ID!) { deleteHabit(id: $id) }`, { id: encodeId('Habit', id) });
        } catch (e) {
          if (!isMissingError(e)) throw e;
        }
        break;
      case 'identities':
        try {
          await gql(`mutation ($id: ID!) { deleteIdentity(id: $id) }`, { id: encodeId('Identity', id) });
        } catch (e) {
          if (!isMissingError(e)) throw e;
        }
        break;
      case 'notes':
        await this.deleteNote(id);
        break;
    }
  }

  private async upsertHabit(h: Habit): Promise<void> {
    const input = toApiHabitInput(h);
    try {
      await gql(`mutation ($id: ID!, $input: UpdateHabitInput!) { updateHabit(id: $id, input: $input) { id } }`, {
        id: encodeId('Habit', h.id),
        input,
      });
    } catch (e) {
      if (!isMissingError(e)) throw e;
      await gql(`mutation ($input: CreateHabitInput!) { createHabit(input: $input) { id } }`, { input });
    }
  }

  private async upsertEntry(e: HabitEntry): Promise<void> {
    await gql(
      `mutation ($input: UpsertEntryInput!) {
         upsertEntry(input: $input) { id }
       }`,
      {
        input: {
          habitId: encodeId('Habit', e.habitId),
          date: e.date,
          value: e.value,
          standardMet: e.standardMet,
          targetMet: e.targetMet,
          notes: e.notes ?? null,
        },
      },
    );
  }

  private async upsertNote(n: HabitNote): Promise<void> {
    await gql(
      `mutation ($input: AddNoteInput!) {
         addNote(input: $input) { id }
       }`,
      {
        input: {
          id: encodeId('HabitNote', n.id),
          habitId: encodeId('Habit', n.habitId),
          date: n.date,
          content: n.content,
        },
      },
    );
  }

  private async deleteNote(id: string): Promise<void> {
    try {
      await gql(`mutation ($id: ID!) { deleteNote(id: $id) }`, { id: encodeId('HabitNote', id) });
    } catch (e) {
      if (!isMissingError(e)) throw e;
    }
  }

  private async upsertIdentity(i: Identity): Promise<void> {
    try {
      await gql(
        `mutation ($id: ID!, $name: String!, $description: String, $goals: [String!]) {
           updateIdentity(id: $id, name: $name, description: $description, goals: $goals) { id }
         }`,
        { id: encodeId('Identity', i.id), name: i.name, description: i.description ?? null, goals: i.goals ?? [] },
      );
    } catch (e) {
      if (!isMissingError(e)) throw e;
      await gql(
        `mutation ($name: String!, $description: String, $goals: [String!]) {
           createIdentity(name: $name, description: $description, goals: $goals) { id }
         }`,
        { name: i.name, description: i.description ?? null, goals: i.goals ?? [] },
      );
    }
  }

  private async upsertSettings(s: AppSettings): Promise<void> {
    await gql(
      `mutation ($input: UpsertSettingsInput!) {
         upsertSettings(input: $input) { userId }
       }`,
      {
        input: {
          resetTime: s.resetTime,
          themeMode: s.themeMode,
          oled: s.oled,
          accentColor: s.accentColor || null,
          mainColor: s.mainColor || null,
          launchScreen: s.launchScreen,
        },
      },
    );
  }

  async uploadAll(): Promise<SyncResult> {
    const start = new Date();
    if (!getToken()) return { lastSynced: start, status: 'error', conflicts: [] };
    try {
      const habits = get(habitsStore);
      const entries = get(entriesStore);
      const identities = get(identitiesStore);
      const notes = get(notesStore);
      const settings = get(appSettings);

      const dedupedEntries = Array.from(
        entries.reduce((map, e) => {
          const key = `${e.habitId}|${e.date}`;
          const existing = map.get(key);
          if (!existing || e.updatedAt > existing.updatedAt) map.set(key, e);
          return map;
        }, new Map()).values(),
      );

      const jobs: Promise<void>[] = [];
      for (const h of habits) jobs.push(this.upsertHabit(h));
      for (const e of dedupedEntries) jobs.push(this.upsertEntry(e));
      for (const i of identities) jobs.push(this.upsertIdentity(i));
      for (const n of notes) {
        if (n.status === 'deleted') jobs.push(this.deleteNote(n.id));
        else jobs.push(this.upsertNote(n));
      }
      jobs.push(this.upsertSettings(settings));

      const results = await Promise.allSettled(jobs);
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (rejected.length > 0) {
        console.error(`api uploadAll: ${rejected.length}/${results.length} failed`, rejected.map(r => r.reason));
      }
      return { lastSynced: start, status: 'success', conflicts: [] };
    } catch (e) {
      console.error('api uploadAll error:', e);
      return { lastSynced: start, status: 'error', conflicts: [] };
    }
  }

  async downloadAll(): Promise<SyncResult> {
    const start = new Date();
    if (!getToken()) return { lastSynced: start, status: 'error', conflicts: [] };
    try {
      const { setSyncEnabled } = await import('../sync');
      setSyncEnabled(false);

      const { saveHabit, saveEntry, saveIdentity, saveNote } = await import('../storage');

      const data = await gql<{
        habits: any[];
        entries: any[];
        notes: any[];
        identities: any[];
        settings: any | null;
      }>(
        `query DownloadAll {
          habits { ${HABIT_FIELDS} }
          entries { ${ENTRY_FIELDS} }
          notes { ${NOTE_FIELDS} }
          identities { ${IDENTITY_FIELDS} }
          settings { resetTime themeMode oled accentColor mainColor launchScreen }
        }`,
        undefined,
        { auth: true },
      );

      const localHabits = get(habitsStore);
      const mergedHabits = [...localHabits];
      for (const row of data.habits ?? []) {
        try {
          const h = fromApiHabit(row);
          const idx = mergedHabits.findIndex(x => x.id === h.id);
          if (idx >= 0) mergedHabits[idx] = h;
          else mergedHabits.push(h);
        } catch {}
      }
      habitsStore.set(mergedHabits);
      for (const h of mergedHabits) {
        try { await saveHabit(h); } catch {}
      }

      const localEntries = get(entriesStore);
      const mergedEntries = [...localEntries];
      for (const row of data.entries ?? []) {
        try {
          const e = fromApiEntry(row);
          const idx = mergedEntries.findIndex(x => x.id === e.id);
          if (idx >= 0) mergedEntries[idx] = e;
          else mergedEntries.push(e);
        } catch {}
      }
      entriesStore.set(mergedEntries);
      for (const e of mergedEntries) {
        try { await saveEntry(e); } catch {}
      }

      const localIdentities = get(identitiesStore);
      const mergedIdentities = [...localIdentities];
      for (const row of data.identities ?? []) {
        try {
          const i = fromApiIdentity(row);
          const idx = mergedIdentities.findIndex(x => x.id === i.id);
          if (idx >= 0) mergedIdentities[idx] = i;
          else mergedIdentities.push(i);
        } catch {}
      }
      identitiesStore.set(mergedIdentities);
      for (const i of mergedIdentities) {
        try { await saveIdentity(i); } catch {}
      }

      const localNotes = get(notesStore);
      const mergedNotes = [...localNotes];
      for (const row of data.notes ?? []) {
        try {
          const n = fromApiNote(row);
          const idx = mergedNotes.findIndex(x => x.id === n.id);
          if (idx >= 0) {
            if (mergedNotes[idx].status !== 'deleted') mergedNotes[idx] = n;
          } else {
            mergedNotes.push(n);
          }
        } catch {}
      }
      notesStore.set(mergedNotes);
      for (const n of mergedNotes) {
        try { await saveNote(n); } catch {}
      }

      if (data.settings) {
        const s = get(appSettings);
        appSettings.set({
          ...s,
          resetTime: data.settings.resetTime ?? s.resetTime,
          themeMode: (data.settings.themeMode as AppSettings['themeMode']) ?? s.themeMode,
          oled: data.settings.oled ?? s.oled,
          accentColor: data.settings.accentColor ?? s.accentColor,
          mainColor: data.settings.mainColor ?? s.mainColor,
          launchScreen: (data.settings.launchScreen as AppSettings['launchScreen']) ?? s.launchScreen,
        });
      }

      setSyncEnabled(true);
      return { lastSynced: start, status: 'success', conflicts: [] };
    } catch (e) {
      const { setSyncEnabled } = await import('../sync');
      setSyncEnabled(true);
      console.error('api downloadAll error:', e);
      return { lastSynced: start, status: 'error', conflicts: [] };
    }
  }
}

export const apiSyncProvider = new ApiSyncProvider();
