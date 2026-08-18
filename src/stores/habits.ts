import type { Habit } from '../types';
import { getAllHabits, saveHabit, deleteHabit as deleteHabitFromDB } from '../services/storage';
import { createStore } from '../lib/storeFactory';
import { pushRecord, removeRecord } from '../services/sync';
import { get } from 'svelte/store';

function cloneHabit(h: Habit): Habit {
  return {
    ...h,
    tags: [...h.tags],
    schedule: { ...h.schedule, startDate: new Date(h.schedule.startDate) },
    metadata: { ...h.metadata },
    dependsOn: h.dependsOn ? { habitIds: [...h.dependsOn.habitIds], mode: h.dependsOn.mode } : undefined,
    linkedHabitIds: h.linkedHabitIds ? [...h.linkedHabitIds] : undefined,
    createdAt: new Date(h.createdAt),
    updatedAt: new Date(h.updatedAt),
  };
}

export const habitsStore = createStore<Habit>(getAllHabits, saveHabit, deleteHabitFromDB);

export function addHabit(habit: Habit) {
  habitsStore.add(cloneHabit(habit));
  pushRecord('habits', habit.id, habit);
}

export function updateHabit(habit: Habit) {
  const cloned = cloneHabit(habit);
  cloned.updatedAt = new Date();
  habitsStore.updateItem(cloned);
  pushRecord('habits', cloned.id, cloned);
}

// Applies a link-group edit symmetrically on the device: the picked partners
// (plus the habit itself) form the group, every group member lists the others,
// and any habit that still references a group member without being in the group
// gets the member stripped from its list (mirrors the backend normalizer).
export function setLinkedHabits(target: Habit, selectedIds: string[]): void {
  const all = get(habitsStore);
  const group = [...new Set([target.id, ...selectedIds.filter(id => id && id !== target.id)])];
  const inGroup = new Set(group);
  const next = new Map<string, Habit>();
  for (const h of all) {
    if (!inGroup.has(h.id)) continue;
    next.set(h.id, { ...cloneHabit(h), linkedHabitIds: group.filter(id => id !== h.id) });
  }
  for (const h of all) {
    if (inGroup.has(h.id)) continue;
    const linked = (h.linkedHabitIds ?? []).filter(id => !inGroup.has(id));
    if (linked.length === (h.linkedHabitIds ?? []).length) continue;
    next.set(h.id, { ...cloneHabit(h), linkedHabitIds: linked });
  }
  next.set(target.id, { ...target, linkedHabitIds: group.filter(id => id !== target.id) });
  for (const h of next.values()) updateHabit(h);
}

export async function removeHabit(id: string) {
  await habitsStore.remove(id);
  await removeRecord('habits', id);
}
