import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId } from '../ids.js';
import { runPage } from '../pagination.js';

export interface EntryRow {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number;
  standard_met: boolean;
  target_met: boolean;
  notes: string | null;
  updated_at: string | null;
}

export function toEntry(row: EntryRow) {
  return {
    id: toGlobalId('HabitEntry', row.id),
    habitId: toGlobalId('Habit', row.habit_id),
    date: row.date,
    value: row.value,
    standardMet: row.standard_met,
    targetMet: row.target_met,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

interface ThresholdHabit {
  type?: string | null;
  standard?: number | null;
  target?: number | null;
  metadata?: { category?: string } | null;
}

// Mirrors the client's threshold semantics (src/lib/thresholds.ts): build habits
// are met at value >= threshold, break habits are met at value <= threshold, and
// binary habits are met when value >= standard.
export function computeMet(habit: ThresholdHabit, value: number) {
  const type = habit?.type ?? 'binary';
  const standard = habit?.standard ?? 0;
  const target = habit?.target ?? null;
  const breakInverted = type !== 'binary' && habit?.metadata?.category === 'break';
  const standardMet = breakInverted ? value <= standard : value >= standard;
  const targetMet = target != null && (breakInverted ? value <= target : value >= target);
  return { standardMet, targetMet };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Enumerates YYYY-MM-DD dates from start to end inclusive (max 10 years).
function rangeDates(startDate: string, endDate: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('Dates must be YYYY-MM-DD');
  }
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date');
  const MAX_DAYS = 3660;
  if (start > end) throw new Error('Start date must be on or before end date');
  const total = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (total >= MAX_DAYS) throw new Error(`Backfill range too large (max ${MAX_DAYS} days)`);
  const out: string[] = [];
  const d = new Date(start);
  for (let i = 0; i <= total; i++) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + i);
    out.push(`${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`);
  }
  return out;
}

export const entryResolvers = {
  Query: {
    entries: async (_: unknown, args: { habitId?: string; date?: string; dateFrom?: string; dateTo?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      let query = ctx.db.from('entries').select('*').eq('user_id', ctx.userId);
      if (args.habitId) query = query.eq('habit_id', requireGlobalId(args.habitId, 'Habit'));
      if (args.date) query = query.eq('date', args.date);
      if (args.dateFrom) query = query.gte('date', args.dateFrom);
      if (args.dateTo) query = query.lte('date', args.dateTo);
      query = query.order('date', { ascending: false });
const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as EntryRow[]).map(toEntry);
    },

    entriesConnection: async (
      _: unknown,
      args: {
        first?: number | null;
        after?: string | null;
        offset?: number | null;
        limit?: number | null;
        habitId?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
      },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const apply = (q: any) => {
        let query = q.eq('user_id', ctx.userId);
        if (args.habitId) query = query.eq('habit_id', requireGlobalId(args.habitId, 'Habit'));
        if (args.date) query = query.eq('date', args.date);
        if (args.dateFrom) query = query.gte('date', args.dateFrom);
        if (args.dateTo) query = query.lte('date', args.dateTo);
        return query;
      };
      // Existing list query orders newest dates first; mirror that.
      return runPage(ctx.db, 'entries', apply, 'date', false, args, toEntry);
    },

    entry: async (_: unknown, args: { habitId: string; date: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(args.habitId, 'Habit');
      const { data, error } = await ctx.db.from('entries').select('*').eq('habit_id', habitId).eq('date', args.date).eq('user_id', ctx.userId).single();
      if (error) return null;
      return toEntry(data as EntryRow);
    },
  },

  Mutation: {
    upsertEntry: async (_: unknown, args: { input: { habitId: string; date: string; value: number; standardMet?: boolean; targetMet?: boolean; notes?: string } }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(args.input.habitId, 'Habit');
      const { data: habitRow } = await ctx.db.from('habits').select('type, standard, target, metadata, linked_habit_ids').eq('id', habitId).eq('user_id', ctx.userId).maybeSingle();
      if (!habitRow) throw new Error('Habit not found');

      const value = args.input.value;
      const met = computeMet(habitRow as ThresholdHabit, value);
      const standardMet = met.standardMet;
      const targetMet = met.targetMet;

      const existing = await ctx.db.from('entries').select('id').eq('habit_id', habitId).eq('date', args.input.date).maybeSingle();
      const now = new Date().toISOString();
      const record: Record<string, unknown> = {
        id: existing?.data?.id ?? crypto.randomUUID(),
        user_id: ctx.userId,
        habit_id: habitId,
        date: args.input.date,
        value,
        standard_met: standardMet,
        target_met: targetMet,
        updated_at: now,
      };
      if (args.input.notes !== undefined) record.notes = args.input.notes;
      const { data, error } = await ctx.db.from('entries').upsert(record).select('*').single();
      if (error) throw new Error(error.message);

      // Linked habits stay in lockstep: logging on one writes the same value to
      // every linked habit for the same date (met computed per habit).
      const linkedIds = (habitRow.linked_habit_ids ?? []) as string[];
      if (linkedIds.length) {
        const { data: linkedHabits } = await ctx.db
          .from('habits')
          .select('id, type, standard, target, metadata')
          .in('id', linkedIds)
          .eq('user_id', ctx.userId);
        const { data: existingLinked } = await ctx.db
          .from('entries')
          .select('id, habit_id')
          .in('habit_id', linkedIds)
          .eq('date', args.input.date)
          .eq('user_id', ctx.userId);
        const existingIdByHabit = new Map<string, string>();
        for (const r of existingLinked ?? []) {
          existingIdByHabit.set((r as { habit_id: string }).habit_id, (r as { id: string }).id);
        }
        const linkedRecords: Record<string, unknown>[] = [];
        for (const lh of linkedHabits ?? []) {
          const lrow = lh as ThresholdHabit & { id: string };
          const lmet = computeMet(lrow, value);
          linkedRecords.push({
            id: existingIdByHabit.get(lrow.id) ?? crypto.randomUUID(),
            user_id: ctx.userId,
            habit_id: lrow.id,
            date: args.input.date,
            value,
            standard_met: lmet.standardMet,
            target_met: lmet.targetMet,
            updated_at: now,
          });
        }
        const { error: linkedError } = await ctx.db.from('entries').upsert(linkedRecords);
        if (linkedError) throw new Error(linkedError.message);
      }

      return toEntry(data as EntryRow);
    },

    deleteEntry: async (_: unknown, args: { habitId: string; date: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(args.habitId, 'Habit');
      const { error } = await ctx.db.from('entries').delete().eq('habit_id', habitId).eq('date', args.date).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },

    backfillHabit: async (
      _: unknown,
      args: {
        input: {
          habitId: string;
          startDate: string;
          endDate: string;
          valueMode: string;
          value?: number | null;
          linkedHabitId?: string | null;
          conditionHabitIds?: string[];
          conditionMode?: string;
          skipWeekdays?: number[];
          skipDates?: string[];
          skipLogged?: boolean;
          skipAtOrAbove?: boolean;
        };
      },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const rawHabitId = requireGlobalId(args.input.habitId, 'Habit');
      const { data: habitRow } = await ctx.db
        .from('habits')
        .select('type, standard, target, metadata, linked_habit_ids')
        .eq('id', rawHabitId)
        .eq('user_id', ctx.userId)
        .maybeSingle();
      if (!habitRow) throw new Error('Habit not found');
      const habit = habitRow as ThresholdHabit;

      const dates = rangeDates(args.input.startDate, args.input.endDate);
      const from = dates[0];
      const to = dates[dates.length - 1];

      const valueMode = args.input.valueMode ?? 'VALUE';
      let plannedValue: number;
      let linkedValuesByDate: Map<string, number> | null = null;
      if (valueMode === 'STANDARD') {
        plannedValue = habit.standard ?? 0;
      } else if (valueMode === 'TARGET') {
        if (habit.target == null) throw new Error('This habit has no target');
        plannedValue = habit.target;
      } else if (valueMode === 'LINKED') {
        const linkedHabitId = requireGlobalId(args.input.linkedHabitId ?? '', 'Habit');
        const linkedIds = (habitRow.linked_habit_ids ?? []) as string[];
        if (!linkedIds.includes(linkedHabitId)) throw new Error('linkedHabitId is not one of this habit\'s linked habits');
        const { data: linkedHabit } = await ctx.db
          .from('habits')
          .select('id')
          .eq('id', linkedHabitId)
          .eq('user_id', ctx.userId)
          .maybeSingle();
        if (!linkedHabit) throw new Error('Linked habit not found');
        const { data: linkedEntries } = await ctx.db
          .from('entries')
          .select('date, value')
          .eq('habit_id', linkedHabitId)
          .eq('user_id', ctx.userId)
          .gte('date', from)
          .lte('date', to);
        linkedValuesByDate = new Map<string, number>();
        for (const r of linkedEntries ?? []) {
          const row = r as { date: string; value: number };
          linkedValuesByDate.set(row.date, row.value);
        }
        plannedValue = 0;
      } else {
        if (args.input.value == null || Number.isNaN(args.input.value)) throw new Error('A value is required');
        plannedValue = args.input.value;
      }

      // Existing entries for the target habit in range.
      const { data: existingRows } = await ctx.db
        .from('entries')
        .select('*')
        .eq('user_id', ctx.userId)
        .eq('habit_id', rawHabitId)
        .gte('date', from)
        .lte('date', to);
      const existingByDate = new Map<string, EntryRow>();
      for (const r of existingRows ?? []) existingByDate.set(r.date, r);

      // Condition habits + their standard-met state per day.
      const conditionHabits = new Map<string, ThresholdHabit>();
      let conditionValuesByDate = new Map<string, Map<string, number>>();
      const conditionIds = (args.input.conditionHabitIds ?? []).map(id => requireGlobalId(id, 'Habit')).filter(Boolean);
      if (conditionIds.length) {
        const { data: condHabits } = await ctx.db
          .from('habits')
          .select('id, type, standard, target, metadata')
          .in('id', conditionIds)
          .eq('user_id', ctx.userId);
        for (const r of condHabits ?? []) {
          const row = r as ThresholdHabit & { id: string };
          conditionHabits.set(row.id, row);
        }
        const missing = conditionIds.filter(id => !conditionHabits.has(id));
        if (missing.length) throw new Error('Condition habit not found');
        const { data: condEntries } = await ctx.db
          .from('entries')
          .select('habit_id, date, value')
          .eq('user_id', ctx.userId)
          .in('habit_id', conditionIds)
          .gte('date', from)
          .lte('date', to);
        for (const r of condEntries ?? []) {
          const row = r as { habit_id: string; date: string; value: number };
          let m = conditionValuesByDate.get(row.date);
          if (!m) { m = new Map(); conditionValuesByDate.set(row.date, m); }
          m.set(row.habit_id, row.value);
        }
      }

      const skipWeekdaySet = new Set(args.input.skipWeekdays ?? []);
      const skipDateSet = new Set(args.input.skipDates ?? []);
      const conditionMode = args.input.conditionMode ?? 'and';
      const skipLogged = !!args.input.skipLogged;
      const skipAtOrAbove = !!args.input.skipAtOrAbove;

      const records: Record<string, unknown>[] = [];
      let applied = 0;
      let skipped = 0;
      for (const date of dates) {
        const existing = existingByDate.get(date);

        if (valueMode === 'LINKED') {
          const v = linkedValuesByDate!.get(date);
          if (v == null) { skipped++; continue; } // no value logged on the linked habit that day
          plannedValue = v;
        }

        if (skipDateSet.has(date)) { skipped++; continue; }
        if (skipWeekdaySet.has(new Date(date + 'T00:00:00').getDay())) { skipped++; continue; }

        if (conditionHabits.size) {
          const dayValues = conditionValuesByDate.get(date) ?? new Map<string, number>();
          const results = [...conditionHabits.entries()].map(([id, h]) => {
            const v = dayValues.get(id);
            if (v == null) return false;
            return computeMet(h, v).standardMet;
          });
          const satisfied = conditionMode === 'or' ? results.some(Boolean) : results.every(Boolean);
          if (!satisfied) { skipped++; continue; }
        }

        if (existing && existing.value > 0) {
          if (skipLogged) { skipped++; continue; }
          if (skipAtOrAbove && existing.value >= plannedValue) { skipped++; continue; }
        }

        const met = computeMet(habit, plannedValue);
        records.push({
          id: existing?.id ?? crypto.randomUUID(),
          user_id: ctx.userId,
          habit_id: rawHabitId,
          date,
          value: plannedValue,
          standard_met: met.standardMet,
          target_met: met.targetMet,
          notes: existing?.notes ?? null,
          updated_at: new Date().toISOString(),
        });
        applied++;
      }

      let written: EntryRow[] = [];
      if (records.length) {
        const { data, error } = await ctx.db.from('entries').upsert(records).select('*');
        if (error) throw new Error(error.message);
        written = data as EntryRow[];
      }

      return {
        habitId: toGlobalId('Habit', rawHabitId),
        totalDays: dates.length,
        appliedDays: applied,
        skippedDays: skipped,
        entries: written.map(toEntry),
      };
    },
  },
};
