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

export interface GlobalStats {
  totalCompletions: number;
  averageCompletionRate: number;
  strongestHabit: { title: string; rate: number } | null;
  weakestHabit: { title: string; rate: number } | null;
}

export function computeHabitStats(habit: Habit, entries: HabitEntry[]): HabitStats {
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
    completionRate: habitEntries.length > 0 ? standardMetCount / habitEntries.length : 0,
    currentStreak,
    longestStreak,
    bestDay,
  };
}

export function computeGlobalStats(habits: Habit[], entries: HabitEntry[]): GlobalStats {
  const stats = habits.map(h => computeHabitStats(h, entries));
  const totalCompletions = stats.reduce((s, h) => s + h.standardMetCount, 0);
  const totalEntries = stats.reduce((s, h) => s + h.totalEntries, 0);
  const averageCompletionRate = totalEntries > 0 ? totalCompletions / totalEntries : 0;

  let strongest: { title: string; rate: number } | null = null;
  let weakest: { title: string; rate: number } | null = null;

  for (const s of stats) {
    if (s.totalEntries === 0) continue;
    if (!strongest || s.completionRate > strongest.rate) strongest = { title: s.habit.title, rate: s.completionRate };
    if (!weakest || s.completionRate < weakest.rate) weakest = { title: s.habit.title, rate: s.completionRate };
  }

  return { totalCompletions, averageCompletionRate, strongestHabit: strongest, weakestHabit: weakest };
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const filtered = habitId ? entries.filter(e => e.habitId === habitId) : entries;
  const map = new Map<string, number>();
  for (const e of filtered) {
    map.set(e.date, (map.get(e.date) ?? 0) + 1);
  }
  return days.map(date => {
    const d = new Date(date + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const ref = new Date(days[0] + 'T00:00:00');
    const weekOffset = Math.floor((d.getTime() - ref.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return { date, dayOfWeek, weekOffset, value: map.get(date) ?? 0 };
  });
}
