// src/services/habitEngine.ts

import type { Habit, HabitEntry, CompletionResult } from '../types';
import { getAllEntries, saveEntry, getEntry } from './storage';

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

  /** Get the current streak (consecutive days where standardMet is true). */
  async getStreak(): Promise<number> {
    const all = await getAllEntries();
    // Filter entries for this habit and sort by date descending
    const habitEntries = all
      .filter(e => e.habitId === this.habit.id && e.standardMet)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const entry of habitEntries) {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      const diff = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === streak) {
        streak++;
        today = entryDate;
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
