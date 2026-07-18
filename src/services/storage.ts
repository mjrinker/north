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

// --- Habit methods ---
export async function saveHabit(habit: Habit): Promise<void> {
  await idbPut('habits', habit);
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
  await idbPut('entries', entry);
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

// --- Identity methods ---
export async function saveIdentity(identity: Identity): Promise<void> {
  await idbPut('identities', identity);
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