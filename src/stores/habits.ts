// src/stores/habits.ts
import type { Habit } from '../types';
import { writable, type Writable } from 'svelte/store';
import { getAllHabits, saveHabit } from '../services/storage';

export const habitsStore: Writable<Habit[]> = writable([]);

// Load initial data only on the client
if (typeof window !== 'undefined') {
  getAllHabits().then(h => habitsStore.set(h));
}

export function addHabit(habit: Habit) {
  habitsStore.update(list => {
    const updated = [...list, habit];
    // Also persist to IndexedDB
    saveHabit(habit).catch(console.error);
    return updated;
  });
}

export function removeHabit(id: string) {
  habitsStore.update(list => list.filter(h => h.id !== id));
}