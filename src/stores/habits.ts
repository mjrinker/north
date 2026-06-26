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
  const cloned = cloneHabit(habit);
  habitsStore.update(list => {
    const updated = [...list, cloned];
    saveHabit(cloned).catch(console.error);
    return updated;
  });
}

function cloneHabit(h: Habit): Habit {
  return {
    ...h,
    tags: [...h.tags],
    schedule: { ...h.schedule, startDate: new Date(h.schedule.startDate) },
    metadata: { ...h.metadata },
    dependsOn: h.dependsOn ? { habitIds: [...h.dependsOn.habitIds], mode: h.dependsOn.mode } : undefined,
    createdAt: new Date(h.createdAt),
    updatedAt: new Date(h.updatedAt),
  };
}

export function updateHabit(habit: Habit) {
  const cloned = cloneHabit(habit);
  cloned.updatedAt = new Date();
  habitsStore.update(list => {
    const updated = list.map(h => h.id === cloned.id ? cloned : h);
    saveHabit(cloned).catch(console.error);
    return updated;
  });
}

export function removeHabit(id: string) {
  habitsStore.update(list => list.filter(h => h.id !== id));
  deleteHabitFromDB(id).catch(console.error);
}
