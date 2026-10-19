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

// Shared connection, reopened if iOS closes it while the app is suspended.
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!isBrowser) return Promise.reject(new Error('IndexedDB is not available'));
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
        }
      },
      blocking() {
        void dbPromise?.then(db => db.close());
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function withDB<T>(fn: (db: IDBPDatabase) => Promise<T>): Promise<T> {
  try {
    return await fn(await getDB());
  } catch (e) {
    if (!['AbortError', 'InvalidStateError', 'TransactionInactiveError', 'UnknownError'].includes((e as DOMException)?.name)) throw e;
    dbPromise = null;
    return await fn(await getDB());
  }
}

export async function enqueue(item: OutboxItem): Promise<void> {
  try {
    await withDB(db => db.add(STORE, item));
  } catch (e) {
    console.error('outbox enqueue failed:', e);
  }
}

export async function dequePending(): Promise<OutboxItem[]> {
  if (!isBrowser) return [];
  try {
    return await withDB(db => db.getAll(STORE));
  } catch {
    return [];
  }
}

export async function dequeue(seq: number): Promise<void> {
  try {
    await withDB(db => db.delete(STORE, seq));
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

export async function pendingCount(): Promise<number> {
  if (!isBrowser) return 0;
  try {
    return (await withDB(db => db.count(STORE))) || 0;
  } catch {
    return 0;
  }
}

export async function clearOutbox(): Promise<void> {
  if (!isBrowser) return;
  try {
    await withDB(db => db.clear(STORE));
  } catch {}
}