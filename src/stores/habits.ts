import type { Habit } from '../types';
import { getAllHabits, saveHabit, deleteHabit as deleteHabitFromDB } from '../services/storage';
import { createStore } from '../lib/storeFactory';

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

export const habitsStore = createStore<Habit>(getAllHabits, saveHabit, deleteHabitFromDB);

export function addHabit(habit: Habit) {
  habitsStore.add(cloneHabit(habit));
}

export function updateHabit(habit: Habit) {
  const cloned = cloneHabit(habit);
  cloned.updatedAt = new Date();
  habitsStore.updateItem(cloned);
}

export function removeHabit(id: string) {
  habitsStore.remove(id);
}
