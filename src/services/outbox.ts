// src/services/outbox.ts
// Durable queue of records that failed to sync (e.g. offline). Survives reloads
// via IndexedDB and is flushed when a connection returns. Uses a separate DB
// (north_outbox) so it never conflicts with the main north_db version.
import { openDB, type IDBPDatabase } from 'idb';

export interface OutboxItem {
  seq?: number;
  collection: string;
  id: string;
  data?: any;
  delete?: boolean;
}

const DB_NAME = 'north_outbox';
const STORE = 'outbox';
const isBrowser = typeof window !== 'undefined' && window.indexedDB;

async function getDB(): Promise<IDBPDatabase> {
  if (!isBrowser) throw new Error('IndexedDB is not available');
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      }
    },
  });
}

export async function enqueue(item: OutboxItem): Promise<void> {
  try {
    const db = await getDB();
    await db.add(STORE, item);
  } catch (e) {
    console.error('outbox enqueue failed:', e);
  }
}

export async function dequePending(): Promise<OutboxItem[]> {
  if (!isBrowser) return [];
  try {
    const db = await getDB();
    return await db.getAll(STORE);
  } catch {
    return [];
  }
}

export async function dequeue(seq: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE, seq);
  } catch {}
}

export async function hasPending(): Promise<boolean> {
  try {
    const pending = await dequePending();
    return pending.length > 0;
  } catch {
    return false;
  }
}