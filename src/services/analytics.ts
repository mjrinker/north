import type { Habit, HabitEntry } from '../types';
import { computeDailyStreak, computeLongestStreak, computeBreakDailyStreak, computeBreakWeeklyStreak, computeBreakLongestStreak } from '../lib/streakUtils';
import { getLocalDateString } from '../lib/dates';

export interface HabitStats {
  habit: Habit;
  totalEntries: number;
  standardMetCount: number;
  targetMetCount: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: { date: string; value: number } | null;
}

export interface DailyRate {
  date: string;
  met: number;
  total: number;
}

export interface GlobalStats {
  totalCompletions: number;
  averageCompletionRate: number;
  strongestHabit: { title: string; rate: number } | null;
  weakestHabit: { title: string; rate: number } | null;
  daily: DailyRate[];
}

export const RATE_WINDOW_DAYS = 30;

// Days in a stats range; `null` means all time (from the earliest habit start).
export type StatsRange = 7 | 30 | 90 | 365 | null;

const MAX_ALL_TIME_DAYS = 3660;

export function rangeDays(habits: Habit[], entries: HabitEntry[], range: StatsRange): string[] {
  if (range != null) return getLastNDays(range);
  const today = getLocalDateString();
  let earliest = today;
  for (const h of habits) {
    const created = dateOnly(h.createdAt);
    if (created && created < earliest) earliest = created;
  }
  for (const e of entries) if (e.date < earliest) earliest = e.date;
  const span = Math.round((new Date(today + 'T12:00:00').getTime() - new Date(earliest + 'T12:00:00').getTime()) / 86400000) + 1;
  return getLastNDays(Math.min(Math.max(span, 1), MAX_ALL_TIME_DAYS));
}

export interface RateBucket {
  start: string;
  end: string;
  met: number;
  total: number;
}

// Groups the per-day series into `size` buckets: 'day', calendar 'week'
// (starting `startOfWeek`) or calendar 'month'. Each bucket sums met/total.
export function bucketDaily(daily: DailyRate[], size: 'day' | 'week' | 'month', startOfWeek = 1): RateBucket[] {
  const buckets: RateBucket[] = [];
  const keyOf = (date: string) => {
    if (size === 'day') return date;
    if (size === 'month') return date.slice(0, 7);
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() - startOfWeek + 7) % 7));
    return d.toISOString().slice(0, 10);
  };
  let lastKey = '';
  for (const d of daily) {
    const key = keyOf(d.date);
    if (key !== lastKey || buckets.length === 0) {
      buckets.push({ start: d.date, end: d.date, met: 0, total: 0 });
      lastKey = key;
    }
    const b = buckets[buckets.length - 1];
    b.end = d.date;
    b.met += d.met;
    b.total += d.total;
  }
  return buckets;
}

function dateOnly(d: Date | string | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// First day the habit counts towards rates: whichever is earlier of its
// creation date and its first logged entry (backfilled history counts).
function habitStart(habit: Habit, habitEntries: HabitEntry[]): string {
  const created = dateOnly(habit.createdAt) ?? '0000-00-00';
  const first = habitEntries.reduce((min, e) => (e.date < min ? e.date : min), created);
  return first;
}

// Whether the habit succeeded on `date`. Build habits need a logged entry that
// met the standard; break habits succeed unless a logged entry failed it.
function succeeded(habit: Habit, entry: HabitEntry | undefined): boolean {
  if (habit.metadata?.category === 'break') return !entry || entry.standardMet;
  return !!entry?.standardMet;
}

// Share of eligible days in the window the habit succeeded. Days-per-week
// habits only expect `daysPerWeek` of every 7 days.
function windowRate(habit: Habit, habitEntries: HabitEntry[], window: string[]): number {
  const start = habitStart(habit, habitEntries);
  const byDate = new Map(habitEntries.map(e => [e.date, e]));
  const eligible = window.filter(d => d >= start);
  if (eligible.length === 0) return 0;
  const hits = eligible.filter(d => succeeded(habit, byDate.get(d))).length;
  const expected = habit.schedule.daysPerWeek
    ? Math.max(1, (eligible.length * Math.min(7, habit.schedule.daysPerWeek)) / 7)
    : eligible.length;
  return Math.min(1, hits / expected);
}

export function computeHabitStats(habit: Habit, entries: HabitEntry[], window: string[] = getLastNDays(RATE_WINDOW_DAYS)): HabitStats {
  const habitEntries = entries.filter(e => e.habitId === habit.id);
  const standardMetCount = habitEntries.filter(e => e.standardMet).length;
  const targetMetCount = habitEntries.filter(e => e.targetMet).length;

  const bestEntry = [...habitEntries].sort((a, b) => b.value - a.value)[0] || null;
  const bestDay = bestEntry ? { date: bestEntry.date, value: bestEntry.value } : null;

  const isBreak = habit.metadata?.category === 'break';
  const currentStreak = isBreak
    ? habit.schedule.daysPerWeek
      ? computeBreakWeeklyStreak(habitEntries, habit.schedule.startOfWeek ?? 1)
      : computeBreakDailyStreak(habitEntries)
    : computeDailyStreak(habitEntries);
  const longestStreak = isBreak ? computeBreakLongestStreak(habitEntries) : computeLongestStreak(habitEntries);

  return {
    habit,
    totalEntries: habitEntries.length,
    standardMetCount,
    targetMetCount,
    completionRate: windowRate(habit, habitEntries, window),
    currentStreak,
    longestStreak,
    bestDay,
  };
}

export function computeGlobalStats(habits: Habit[], entries: HabitEntry[], window: string[] = getLastNDays(RATE_WINDOW_DAYS)): GlobalStats {
  const stats = habits.map(h => computeHabitStats(h, entries, window));
  const totalCompletions = stats.reduce((s, h) => s + h.standardMetCount, 0);

  const entriesByHabit = new Map<string, Map<string, HabitEntry>>();
  for (const e of entries) {
    if (!entriesByHabit.has(e.habitId)) entriesByHabit.set(e.habitId, new Map());
    entriesByHabit.get(e.habitId)!.set(e.date, e);
  }
  const starts = new Map(habits.map(h => [h.id, habitStart(h, [...(entriesByHabit.get(h.id)?.values() ?? [])])]));

  // Per day: how many of the habits that existed that day succeeded.
  const daily: DailyRate[] = window.map(date => {
    let met = 0;
    let total = 0;
    for (const h of habits) {
      if (date < (starts.get(h.id) ?? date)) continue;
      total++;
      if (succeeded(h, entriesByHabit.get(h.id)?.get(date))) met++;
    }
    return { date, met, total };
  });
  const dayMet = daily.reduce((s, d) => s + d.met, 0);
  const dayTotal = daily.reduce((s, d) => s + d.total, 0);

  let strongest: { title: string; rate: number } | null = null;
  let weakest: { title: string; rate: number } | null = null;
  for (const s of stats) {
    if (!strongest || s.completionRate > strongest.rate) strongest = { title: s.habit.title, rate: s.completionRate };
    if (!weakest || s.completionRate < weakest.rate) weakest = { title: s.habit.title, rate: s.completionRate };
  }

  return {
    totalCompletions,
    averageCompletionRate: dayTotal > 0 ? dayMet / dayTotal : 0,
    strongestHabit: strongest,
    weakestHabit: weakest,
    daily,
  };
}

export function getLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getLocalDateString(d));
  }
  return days;
}

export interface HeatmapDay {
  date: string;
  dayOfWeek: number;
  weekOffset: number;
  value: number;
}

export function buildHeatmapData(
  entries: HabitEntry[],
  days: string[],
  habitId?: string
): HeatmapDay[] {
  // Counts days a habit met its standard (not merely logged).
  const filtered = (habitId ? entries.filter(e => e.habitId === habitId) : entries).filter(e => e.standardMet);
  const map = new Map<string, number>();
  for (const e of filtered) {
    map.set(e.date, (map.get(e.date) ?? 0) + 1);
  }
  // Columns are calendar weeks starting Sunday, so rows line up by weekday.
  const ref = new Date(days[0] + 'T12:00:00');
  ref.setDate(ref.getDate() - ref.getDay());
  return days.map(date => {
    const d = new Date(date + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const weekOffset = Math.round((d.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000)) / 7 | 0;
    return { date, dayOfWeek, weekOffset, value: map.get(date) ?? 0 };
  });
}
