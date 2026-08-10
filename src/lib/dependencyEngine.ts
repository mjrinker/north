import type { Habit, HabitEntry } from '../types';
import { HabitEngine } from '../services/habitEngine';
import { recordAutoCompletedDep, getAutoCompletedDepIds, clearAutoCompletedDeps } from './autoDeps';
import { isStandardMet } from './thresholds';

export async function areDependenciesSatisfied(
  habit: Habit,
  date: string,
  habits: Habit[],
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>
): Promise<boolean> {
  const results = await Promise.all(
    habit.dependsOn!.habitIds.map(async hid => {
      const e = await getEntry(hid, date);
      const h = habits.find(x => x.id === hid);
      if (!e || !h) return false;
      return isStandardMet(h, e.value);
    })
  );
  return habit.dependsOn!.mode === 'and' ? results.every(Boolean) : results.some(Boolean);
}

export async function autoCompleteDependencies(
  habit: Habit,
  date: string,
  habits: Habit[],
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>,
  afterLogCompletion?: (habitId: string, date: string, value: number) => void
): Promise<void> {
  const today = date;
  for (const hid of habit.dependsOn!.habitIds) {
    const entry = await getEntry(hid, today);
    if (entry?.value && entry.value > 0) continue;
    const dep = habits.find(h => h.id === hid);
    if (!dep) continue;
    await HabitEngine.logCompletion(dep, today, dep.standard);
    afterLogCompletion?.(hid, today, dep.standard);
    recordAutoCompletedDep(habit.id, today, hid);
  }
}

export async function uncheckDependencies(
  habit: Habit,
  date: string,
  habits: Habit[],
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>,
  afterLogCompletion?: (habitId: string, date: string, value: number) => void
): Promise<void> {
  const recorded = getAutoCompletedDepIds(habit.id, date);
  for (const hid of habit.dependsOn!.habitIds) {
    if (!recorded.includes(hid)) continue;
    const entry = await getEntry(hid, date);
    if (!entry || entry.value === 0) continue;
    const dep = habits.find(h => h.id === hid);
    if (!dep) continue;
    await HabitEngine.logCompletion(dep, date, 0);
    afterLogCompletion?.(hid, date, 0);
  }
  clearAutoCompletedDeps(habit.id, date);
}

export async function cascadeUncheck(
  habit: Habit,
  date: string,
  habits: Habit[],
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>,
  afterLogCompletion?: (habitId: string, date: string, value: number) => void
): Promise<void> {
  const dependents = habits.filter(h => h.type === 'binary' && h.dependsOn?.habitIds.includes(habit.id));
  for (const dep of dependents) {
    const depEntry = await getEntry(dep.id, date);
    if (!depEntry || depEntry.value === 0) continue;
    const satisfied = await areDependenciesSatisfied(dep, date, habits, getEntry);
    if (!satisfied) {
      await HabitEngine.logCompletion(dep, date, 0);
      afterLogCompletion?.(dep.id, date, 0);
    }
  }
}

export async function cascadeCheck(
  habit: Habit,
  date: string,
  habits: Habit[],
  getEntry: (habitId: string, date: string) => Promise<HabitEntry | undefined>,
  afterLogCompletion?: (habitId: string, date: string, value: number) => void
): Promise<void> {
  const dependents = habits.filter(h => h.type === 'binary' && h.dependsOn?.habitIds.includes(habit.id));
  for (const dep of dependents) {
    const depEntry = await getEntry(dep.id, date);
    if (depEntry?.value && depEntry.value > 0) continue;
    const satisfied = await areDependenciesSatisfied(dep, date, habits, getEntry);
    if (satisfied) {
      await HabitEngine.logCompletion(dep, date, 1);
      afterLogCompletion?.(dep.id, date, 1);
    }
  }
}
