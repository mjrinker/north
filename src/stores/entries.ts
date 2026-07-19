import type { HabitEntry } from '../types';
import { getAllEntries, saveEntry } from '../services/storage';
import { createStore } from '../lib/storeFactory';
import { pushRecord } from '../services/sync';

export const entriesStore = createStore<HabitEntry>(getAllEntries, saveEntry, async () => {});

export function addEntry(entry: HabitEntry) {
  entriesStore.add(entry);
  pushRecord('entries', entry.id, entry);
}
