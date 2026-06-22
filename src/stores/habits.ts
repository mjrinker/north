// src/stores/habits.ts
import type { Habit } from '../types';
import { writable, type Writable } from 'svelte/store';
import { getAllHabits, saveHabit, deleteHabit as deleteHabitFromDB } from '../services/storage';

export const habitsStore: Writable<Habit[]> = writable([]);

// Load initial data only on the client
if (typeof window !== 'undefined') {
  getAllHabits().then(h => habitsStore.set(h));
}

export function addHabit(habit: Habit) {
  habitsStore.update(list => {
    const updated = [...list, habit];
    saveHabit(habit).catch(console.error);
    return updated;
  });
}

export function updateHabit(habit: Habit) {
  habit.updatedAt = new Date();
  habitsStore.update(list => {
    const updated = list.map(h => h.id === habit.id ? habit : h);
    saveHabit(habit).catch(console.error);
    return updated;
  });
}

export function removeHabit(id: string) {
  habitsStore.update(list => list.filter(h => h.id !== id));
  deleteHabitFromDB(id).catch(console.error);
}
