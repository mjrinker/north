// src/stores/entries.ts
import type { HabitEntry } from '../types';
import { writable, type Writable } from 'svelte/store';
import { getAllEntries } from '../services/storage';

export const entriesStore: Writable<HabitEntry[]> = writable([]);

if (typeof window !== 'undefined') {
  getAllEntries().then(e => entriesStore.set(e));
}
