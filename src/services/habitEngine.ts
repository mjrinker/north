import type { Habit, HabitEntry, CompletionResult } from '../types';
import { getAllEntries, saveEntry, getEntry, clearAllEntries } from './storage';
import { getLocalDateString, getWeekStart } from '../lib/dates';
import { computeDailyStreak } from '../lib/streakUtils';
import { entriesStore } from '../stores/entries';
import { pushRecord } from './sync';
import { webhooksFor, fireWebhook } from './webhooks';

async function fireHabitWebhooks(habit: Habit, date: string, value: number, standardMet: boolean, targetMet: boolean): Promise<void> {
  const payload = {
    date,
    value,
    standard: habit.standard,
    target: habit.target ?? null,
    standardMet,
    targetMet,
    timestamp: new Date().toISOString(),
  };
  for (const event of webhooksFor(habit, value, standardMet, targetMet)) {
    fireWebhook(habit, event, payload);
  }
}

export class HabitEngine {
  constructor(private habit: Habit) {}

  static calculateCompletion(habit: Habit, value: number): CompletionResult {
    const standardMet = value >= habit.standard;
    const targetMet = habit.target !== undefined ? value >= habit.target : false;
    const progressPercentage = habit.standard > 0 ? value / habit.standard : 0;
    return { standardMet, targetMet, progressPercentage };
  }

  calculateCompletion(value: number): CompletionResult {
    return HabitEngine.calculateCompletion(this.habit, value);
  }

  static async logCompletion(habit: Habit, date: string, value: number, notes?: string): Promise<void> {
    const existing = await getEntry(habit.id, date);
    const entry: HabitEntry = existing
      ? { ...existing, value, notes, updatedAt: new Date() }
      : {
          id: crypto.randomUUID(),
          habitId: habit.id,
          date,
          value,
          standardMet: false,
          targetMet: false,
          notes,
          updatedAt: new Date()
        };
    const completion = HabitEngine.calculateCompletion(habit, value);
    entry.standardMet = completion.standardMet;
    entry.targetMet = completion.targetMet;
    await saveEntry(entry);
    entriesStore.update(list => {
      const idx = list.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...list];
        updated[idx] = entry;
        return updated;
      }
      return [...list.filter(e => !(e.habitId === entry.habitId && e.date === entry.date)), entry];
    });
    await pushRecord('entries', entry.id, entry);
    void fireHabitWebhooks(habit, date, value, completion.standardMet, completion.targetMet);
  }

  async logCompletion(date: string, value: number, notes?: string): Promise<void> {
    return HabitEngine.logCompletion(this.habit, date, value, notes);
  }

  static async getStreak(habit: Habit): Promise<number> {
    const all = await getAllEntries();
    const habitEntries = all.filter(e => e.habitId === habit.id && e.standardMet);

    if (habit.schedule.daysPerWeek) {
      return HabitEngine.getWeeklyStreak(habit, habitEntries);
    }
    return computeDailyStreak(habitEntries);
  }

  async getStreak(): Promise<number> {
    return HabitEngine.getStreak(this.habit);
  }

  private static async getWeeklyStreak(habit: Habit, entries: HabitEntry[]): Promise<number> {
    const startOfWeek = habit.schedule.startOfWeek ?? 1;
    const weekCounts = new Map<string, number>();
    for (const e of entries) {
      const d = new Date(e.date);
      const weekStart = getWeekStart(d, startOfWeek);
      const key = getLocalDateString(weekStart);
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
    }

    const daysPerWeek = habit.schedule.daysPerWeek!;
    let streak = 0;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(date, startOfWeek);
    const currentKey = getLocalDateString(currentWeekStart);
    if ((weekCounts.get(currentKey) || 0) < daysPerWeek) {
      date.setDate(date.getDate() - 7);
    }
    while (true) {
      const ws = getWeekStart(date, startOfWeek);
      const key = getLocalDateString(ws);
      if ((weekCounts.get(key) || 0) >= daysPerWeek) {
        streak++;
        date.setDate(date.getDate() - 7);
      } else {
        break;
      }
    }
    return streak;
  }

  static getNextOccurrence(habit: Habit): Date | null {
    const { schedule } = habit;
    const now = new Date();
    switch (schedule.frequency) {
      case 'daily':
        return new Date(now.setDate(now.getDate() + schedule.interval));
      case 'days_per_week':
      case 'weekly':
        return new Date(now.setDate(now.getDate() + 7 * schedule.interval));
      case 'monthly': {
        const d = new Date(now);
        d.setMonth(d.getMonth() + schedule.interval);
        return d;
      }
      case 'custom':
        return null;
      default:
        return null;
    }
  }
}
