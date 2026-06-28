// src/services/habitEngine.ts

import type { Habit, HabitEntry, CompletionResult } from '../types';
import { getAllEntries, saveEntry, getEntry } from './storage';
import { getLocalDateString } from '../lib/dates';

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Simple Habit Engine handling completion logic and streak tracking.
 * It operates on a single habit; callers provide the habit definition.
 */
export class HabitEngine {
  constructor(private habit: Habit) {}

  /**
   * Calculate completion for a given value.
   * Returns a CompletionResult based on standard/target thresholds.
   */
  calculateCompletion(value: number): CompletionResult {
    const standardMet = value >= this.habit.standard;
    const targetMet = this.habit.target !== undefined ? value >= this.habit.target : false;
    const progressPercentage = this.habit.standard > 0 ? value / this.habit.standard : 0;
    return { standardMet, targetMet, progressPercentage };
  }

  /** Log a completion entry for the habit on a specific date (ISO string). */
  async logCompletion(date: string, value: number, notes?: string): Promise<void> {
    const existing = await getEntry(this.habit.id, date);
    const entry: HabitEntry = existing
      ? { ...existing, value, notes, updatedAt: new Date() }
      : {
          id: crypto.randomUUID(),
          habitId: this.habit.id,
          date,
          value,
          standardMet: false,
          targetMet: false,
          notes,
          updatedAt: new Date()
        };
    // Update derived flags
    const completion = this.calculateCompletion(value);
    entry.standardMet = completion.standardMet;
    entry.targetMet = completion.targetMet;
    await saveEntry(entry);
  }

  /** Get the current streak. For daily habits, counts consecutive days.
   *  For weekly habits (daysPerWeek set), counts consecutive weeks. */
  async getStreak(): Promise<number> {
    const all = await getAllEntries();
    const habitEntries = all.filter(e => e.habitId === this.habit.id && e.standardMet);

    if (this.habit.schedule.daysPerWeek) {
      return this.getWeeklyStreak(habitEntries);
    }
    return this.getDailyStreak(habitEntries);
  }

  private async getDailyStreak(entries: HabitEntry[]): Promise<number> {
    const completedDates = new Set(entries.map(e => e.date));
    let streak = 0;
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(date);
    if (!completedDates.has(todayStr)) {
      date.setDate(date.getDate() - 1);
    }
    while (true) {
      const dateStr = getLocalDateString(date);
      if (completedDates.has(dateStr)) {
        streak++;
        date.setDate(date.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  private async getWeeklyStreak(entries: HabitEntry[]): Promise<number> {
    const weekCounts = new Map<string, number>();
    for (const e of entries) {
      const d = new Date(e.date);
      const weekStart = getWeekStart(d);
      const key = getLocalDateString(weekStart);
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
    }

    const daysPerWeek = this.habit.schedule.daysPerWeek!;
    let streak = 0;
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(date);
    const currentKey = getLocalDateString(currentWeekStart);
    if ((weekCounts.get(currentKey) || 0) < daysPerWeek) {
      date.setDate(date.getDate() - 7);
    }
    while (true) {
      const ws = getWeekStart(date);
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

  /** Calculate the next scheduled occurrence based on the habit's schedule. */
  getNextOccurrence(): Date | null {
    const { schedule } = this.habit;
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
        // Placeholder: custom recurrence not implemented yet
        return null;
      default:
        return null;
    }
  }
}
