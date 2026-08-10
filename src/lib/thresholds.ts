// src/lib/thresholds.ts
// Completion threshold semantics shared across the app.
//
//  - Build habits (quantity/duration): met when value >= threshold; standard < target.
//  - Break habits (quantity/duration): met when value <= threshold (i.e. NOT exceeded);
//    target is the stricter ceiling and standard the looser one, so standard > target.
//  - Binary habits: value is 0/1, met when value >= standard; thresholds are inert.

import type { Habit } from '../types';

export function isBreakInverted(habit: Pick<Habit, 'type' | 'metadata'>): boolean {
  const type = habit.type;
  return (type === 'quantity' || type === 'duration') && habit.metadata?.category === 'break';
}

export function isStandardMet(habit: Pick<Habit, 'type' | 'metadata' | 'standard'>, value: number): boolean {
  if (isBreakInverted(habit)) return value <= (habit.standard ?? 0);
  return value >= (habit.standard ?? 0);
}

export function isTargetMet(
  habit: Pick<Habit, 'type' | 'metadata' | 'standard' | 'target'>,
  value: number,
): boolean {
  if (habit.target === undefined || habit.target === null) return false;
  if (isBreakInverted(habit)) return value <= habit.target;
  return value >= habit.target;
}

// For break habits, progress is how far below the standard you stayed (value 0 = full),
// so a lower value reads as more progress rather than less.
export function progressPercentage(
  habit: Pick<Habit, 'type' | 'metadata' | 'standard'>,
  value: number,
): number {
  const standard = habit.standard || 0;
  if (standard <= 0) return 0;
  if (isBreakInverted(habit)) {
    return value <= standard ? Math.max(0, 1 - value / standard) : 0;
  }
  return value / standard;
}

// Returns an error message when the habit's standard/target ordering is invalid,
// or null when it is acceptable.
export function thresholdOrderingError(habit: Pick<Habit, 'type' | 'metadata' | 'standard' | 'target'>): string | null {
  if (habit.type === 'binary') return null;
  const target = habit.target;
  if (target === undefined || target === null) return null;
  if (isBreakInverted(habit)) {
    if (habit.standard < target) {
      return 'For a Break habit, Standard must be higher than Target (a value is met when it stays under the threshold).';
    }
  } else if (habit.standard > target) {
    return 'For a Build habit, Standard must be lower than Target.';
  }
  return null;
}