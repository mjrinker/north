// src/stores/entries.ts
import type { HabitEntry } from '../types';
import { writable, type Writable } from 'svelte/store';
import { getAllEntries, saveEntry } from '../services/storage';

export const entriesStore: Writable<HabitEntry[]> = writable([]);

if (typeof window !== 'undefined') {
  getAllEntries().then(e => entriesStore.set(e));
}

export function addEntry(entry: HabitEntry) {
  entriesStore.update(list => {
    const updated = [...list, entry];
    saveEntry(entry).catch(console.error);
    return updated;
  });
}
