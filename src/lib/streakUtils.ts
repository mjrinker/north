import type { HabitEntry } from '../types';
import { getLocalDateString, parseLocalDate, toDateStr } from './dates';

export function computeDailyStreak(entries: HabitEntry[]): number {
  const completedDates = new Set(entries.filter(e => e.standardMet).map(e => e.date));
  let streak = 0;
  // Start from the current habit day (reset-time aware), then walk backwards by
  // plain calendar days. Avoid re-applying the reset shift to midnight Date
  // objects, which would leave the streak a day (or week) short.
  const date = parseLocalDate(getLocalDateString());
  if (!completedDates.has(toDateStr(date))) {
    date.setDate(date.getDate() - 1);
  }
  while (true) {
    if (completedDates.has(toDateStr(date))) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else break;
  }
  return streak;
}

export function computeLongestStreak(entries: HabitEntry[]): number {
  const sorted = entries
    .filter(e => e.standardMet)
    .map(e => e.date)
    .sort((a, b) => a.localeCompare(b));
  let longest = 0;
  let temp = 0;
  let prev: number | null = null;
  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00').getTime();
    if (prev !== null) {
      const gap = (d - prev) / (1000 * 60 * 60 * 24);
      if (gap === 1) {
        temp++;
      } else {
        longest = Math.max(longest, temp);
        temp = 1;
      }
    } else {
      temp = 1;
    }
    prev = d;
  }
  return Math.max(longest, temp);
}
