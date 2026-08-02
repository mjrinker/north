import type { Habit } from '../types';
import { get } from 'svelte/store';
import { habitsStore, updateHabit } from '../stores/habits';
import { toDateStr } from './dates';

// A paused habit is effectively paused only while:
//   - status === 'paused' AND
//   - no pauseUntil (indefinite) OR today <= pauseUntil (inclusive through the pause date)
export function isHabitPaused(habit: Habit, now: Date = new Date()): boolean {
  if (habit.status !== 'paused') return false;
  const until = habit.metadata?.pauseUntil;
  if (!until) return true;
  return toDateStr(now) <= until;
}

export function isHabitActive(habit: Habit, now: Date = new Date()): boolean {
  if (habit.status === 'archived' || habit.status === 'deleted') return false;
  return habit.status === 'active' || !isHabitPaused(habit, now);
}

export function pauseHabit(habit: Habit, until?: string): Habit {
  const u = until?.trim();
  return {
    ...habit,
    status: 'paused',
    metadata: { ...habit.metadata, pauseUntil: u ? u : undefined },
    updatedAt: new Date(),
  };
}

export function resumeHabit(habit: Habit): Habit {
  return {
    ...habit,
    status: 'active',
    metadata: { ...habit.metadata, pauseUntil: undefined },
    updatedAt: new Date(),
  };
}

// Paused habits whose pauseUntil has passed and should now be active again.
export function expiredPausedHabits(habits: Habit[], now: Date = new Date()): Habit[] {
  return habits.filter(h => h.status === 'paused' && h.metadata?.pauseUntil && !isHabitPaused(h, now));
}

export function pauseAllHabits(until?: string) {
  const habits = get(habitsStore);
  for (const h of habits) {
    if (isHabitActive(h)) updateHabit(pauseHabit(h, until));
  }
}

export function resumeAllHabits() {
  const habits = get(habitsStore);
  for (const h of habits) {
    if (h.status === 'paused') updateHabit(resumeHabit(h));
  }
}

export function pauseLabel(habit: Habit): string {
  const until = habit.metadata?.pauseUntil;
  if (!until) return 'Paused indefinitely';
  const d = new Date(until + 'T12:00:00');
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `Paused until ${label}`;
}
