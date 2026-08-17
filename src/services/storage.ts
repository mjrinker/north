// src/services/storage.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Habit, HabitEntry, Identity, HabitNote } from '../types';

const DB_NAME = 'north_db';
const DB_VERSION = 2;

// Check if we are in a browser environment with indexedDB support
const isBrowser = typeof window !== 'undefined' && window.indexedDB;

async function getDB(): Promise<IDBPDatabase> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment');
  }
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('habits')) {
        db.createObjectStore('habits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('identities')) {
        db.createObjectStore('identities', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
    },
  });
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  if (!isBrowser) return;
  const db = await getDB();
  await db.put(storeName, value);
}

async function idbGet<T>(storeName: string, id: string): Promise<T | undefined> {
  if (!isBrowser) return undefined;
  const db = await getDB();
  return await db.get(storeName, id);
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  if (!isBrowser) return [];
  const db = await getDB();
  return await db.getAll(storeName);
}

async function idbDelete(storeName: string, id: string): Promise<void> {
  if (!isBrowser) return;
  const db = await getDB();
  await db.delete(storeName, id);
}

async function idbClear(storeName: string): Promise<void> {
  if (!isBrowser) return;
  const db = await getDB();
  await db.clear(storeName);
}

// Atomic replace: clear + bulk put inside a single readwrite transaction. If
// anything fails the whole transaction rolls back, so the cache is never left
// empty or partially written.
async function idbReplaceAll<T>(storeName: string, values: T[]): Promise<void> {
  if (!isBrowser) return;
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  for (const value of values) {
    await store.put(value);
  }
  await tx.done;
}

// --- Habit methods ---
export async function saveHabit(habit: Habit): Promise<void> {
  await idbPut('habits', habit);
}

export async function clearAllHabits(): Promise<void> {
  await idbClear('habits');
}

export async function replaceAllHabits(habits: Habit[]): Promise<void> {
  await idbReplaceAll('habits', habits);
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  return await idbGet<Habit>('habits', id);
}

export async function getAllHabits(): Promise<Habit[]> {
  return await idbGetAll<Habit>('habits');
}

export async function deleteHabit(id: string): Promise<void> {
  await idbDelete('habits', id);
}

// --- Entry methods ---
export async function saveEntry(entry: HabitEntry): Promise<void> {
  const existing = await getEntry(entry.habitId, entry.date);
  if (existing && existing.id !== entry.id) {
    await idbDelete('entries', existing.id);
  }
  await idbPut('entries', entry);
}

export async function clearAllEntries(): Promise<void> {
  await idbClear('entries');
}

export async function replaceAllEntries(entries: HabitEntry[]): Promise<void> {
  await idbReplaceAll('entries', entries);
}

export async function getEntry(habitId: string, date: string): Promise<HabitEntry | undefined> {
  if (!isBrowser) return undefined;
  const db = await getDB();
  const tx = db.transaction('entries', 'readonly');
  const store = tx.objectStore('entries');
  const all = await store.getAll();
  return all.find(e => e.habitId === habitId && e.date === date);
}

export async function getAllEntries(): Promise<HabitEntry[]> {
  return await idbGetAll<HabitEntry>('entries');
}

export async function getEntriesByHabitId(habitId: string): Promise<HabitEntry[]> {
  if (!isBrowser) return [];
  const db = await getDB();
  const tx = db.transaction('entries', 'readonly');
  const store = tx.objectStore('entries');
  const all = await store.getAll();
  return all.filter(e => e.habitId === habitId);
}

export async function getEntriesByDateRange(start: string, end: string): Promise<HabitEntry[]> {
  if (!isBrowser) return [];
  const db = await getDB();
  const tx = db.transaction('entries', 'readonly');
  const store = tx.objectStore('entries');
  const all = await store.getAll();
  return all.filter(e => e.date >= start && e.date <= end);
}

export interface EntriesRangeMeta {
  entries: HabitEntry[];
  earliestDate: string | null;
  latestDate: string | null;
}

export async function getEntriesByDateRangeMeta(start: string, end: string): Promise<EntriesRangeMeta> {
  if (!isBrowser) return { entries: [], earliestDate: null, latestDate: null };
  const db = await getDB();
  const tx = db.transaction('entries', 'readonly');
  const store = tx.objectStore('entries');
  const all = await store.getAll();
  let earliestDate: string | null = null;
  let latestDate: string | null = null;
  for (const e of all) {
    if (!earliestDate || e.date < earliestDate) earliestDate = e.date;
    if (!latestDate || e.date > latestDate) latestDate = e.date;
  }
  return {
    entries: all.filter(e => e.date >= start && e.date <= end),
    earliestDate,
    latestDate,
  };
}

// --- Identity methods ---
export async function saveIdentity(identity: Identity): Promise<void> {
  await idbPut('identities', identity);
}

export async function clearAllIdentities(): Promise<void> {
  await idbClear('identities');
}

export async function replaceAllIdentities(identities: Identity[]): Promise<void> {
  await idbReplaceAll('identities', identities);
}

export async function getIdentity(id: string): Promise<Identity | undefined> {
  return await idbGet<Identity>('identities', id);
}

export async function getAllIdentities(): Promise<Identity[]> {
  return await idbGetAll<Identity>('identities');
}

export async function deleteIdentity(id: string): Promise<void> {
  await idbDelete('identities', id);
}

// --- Note methods ---
export async function saveNote(note: HabitNote): Promise<void> {
  await idbPut('notes', note);
}

export async function clearAllNotes(): Promise<void> {
  await idbClear('notes');
}

export async function replaceAllNotes(notes: HabitNote[]): Promise<void> {
  await idbReplaceAll('notes', notes);
}

export async function getNotesByHabitDate(habitId: string, date: string): Promise<HabitNote[]> {
  if (!isBrowser) return [];
  const db = await getDB();
  const tx = db.transaction('notes', 'readonly');
  const store = tx.objectStore('notes');
  const all = await store.getAll();
  return all.filter(n => n.habitId === habitId && n.date === date).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function getAllNotes(): Promise<HabitNote[]> {
  return await idbGetAll<HabitNote>('notes');
}

export async function deleteNote(id: string): Promise<void> {
  await idbDelete('notes', id);
}