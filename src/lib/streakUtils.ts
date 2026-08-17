import type { HabitEntry } from '../types';
import { getLocalDateString, getWeekStart, parseLocalDate, toDateStr } from './dates';

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

// For Break habits, an unlogged day counts as maintained (absence of the habit
// is success): the streak only resets on a logged day that failed the standard.
// It is bounded by the earliest logged entry so a fresh habit doesn't read as an
// unbounded streak.
export function computeBreakDailyStreak(entries: HabitEntry[]): number {
  if (entries.length === 0) return 0;
  const failedDates = new Set(entries.filter(e => !e.standardMet).map(e => e.date));
  const earliest = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
  let streak = 0;
  const date = parseLocalDate(getLocalDateString());
  while (toDateStr(date) >= earliest) {
    if (failedDates.has(toDateStr(date))) break;
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

export function computeBreakWeeklyStreak(entries: HabitEntry[], startOfWeek = 1): number {
  if (entries.length === 0) return 0;
  const failedWeeks = new Set<string>();
  let earliest = entries[0].date;
  for (const e of entries) {
    if (e.date < earliest) earliest = e.date;
    if (!e.standardMet) {
      failedWeeks.add(toDateStr(getWeekStart(parseLocalDate(e.date), startOfWeek)));
    }
  }
  const earliestWeek = toDateStr(getWeekStart(parseLocalDate(earliest), startOfWeek));
  let streak = 0;
  let ws = getWeekStart(parseLocalDate(getLocalDateString()), startOfWeek);
  while (toDateStr(ws) >= earliestWeek) {
    if (failedWeeks.has(toDateStr(ws))) break;
    streak++;
    ws = new Date(ws);
    ws.setDate(ws.getDate() - 7);
  }
  return streak;
}

// Longest run of consecutive days with no logged failure for a Break habit
// (unlogged days count as maintained).
export function computeBreakLongestStreak(entries: HabitEntry[]): number {
  if (entries.length === 0) return 0;
  const failedDates = new Set(entries.filter(e => !e.standardMet).map(e => e.date));
  const earliest = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
  const today = parseLocalDate(getLocalDateString());
  let longest = 0;
  let run = 0;
  const date = parseLocalDate(earliest);
  while (toDateStr(date) <= toDateStr(today)) {
    if (failedDates.has(toDateStr(date))) run = 0;
    else {
      run++;
      if (run > longest) longest = run;
    }
    date.setDate(date.getDate() + 1);
  }
  return longest;
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
