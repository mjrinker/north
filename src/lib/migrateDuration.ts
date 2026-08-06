// src/lib/migrateDuration.ts
// One-time client migration: duration values used to be stored in minutes and are
// now stored in seconds. The DB migration converts the server rows, but device data
// in IndexedDB predates that and must be converted here. Runs once (flagged) before
// the deferred server sync so it never double-applies against already-seconds data.
import { getAllHabits, getAllEntries, saveHabit, saveEntry } from '../services/storage';
import { habitsStore } from '../stores/habits';
import { entriesStore } from '../stores/entries';

const FLAG = 'north_migration_duration_seconds_v1';

function save() {
  return localStorage.setItem(FLAG, '1');
}

function isMinuteLikeUnit(unit: string | undefined | null): boolean {
  const u = (unit ?? '').trim().toLowerCase();
  return u === '' || /^(min|mins|minute|minutes?)$/.test(u);
}

export async function migrateDurationToSeconds(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  try {
    if (localStorage.getItem(FLAG)) return;

    const habits = await getAllHabits();
    const habitById = new Map<string, typeof habits[number]>();
    let habitChanged = false;

    for (const h of habits) {
      if (h.type === 'duration') {
        const originalStandard = h.standard;
        h.standard *= 60;
        if (h.target != null) h.target = Math.round(h.target * 60);
        if (isMinuteLikeUnit(h.unit)) h.unit = 'seconds';
        h.updatedAt = new Date();
        habitChanged = habitChanged || h.standard !== originalStandard;
        await saveHabit(h);
      }
      habitById.set(h.id, h);
    }
    if (habitChanged) await habitsStore.refresh();

    let entryChanged = false;
    for (const e of await getAllEntries()) {
      const habit = habitById.get(e.habitId);
      if (!habit || habit.type !== 'duration') continue;
      const value = Math.round(e.value * 60);
      e.value = value;
      e.standardMet = value >= habit.standard;
      e.targetMet = habit.target != null && value >= habit.target;
      e.updatedAt = new Date();
      entryChanged = true;
      await saveEntry(e);
    }
    if (entryChanged) await entriesStore.refresh();

    save();
  } catch (e) {
    console.error('duration migration failed:', e);
  }
}