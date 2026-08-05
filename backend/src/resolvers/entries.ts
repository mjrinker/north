import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId } from '../ids.js';

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
      const { data: habit } = await ctx.db.from('habits').select('standard, target').eq('id', habitId).eq('user_id', ctx.userId).maybeSingle();
      if (!habit) throw new Error('Habit not found');

      const value = args.input.value;
      const standard = (habit as { standard: number | null }).standard ?? 0;
      const target = (habit as { target: number | null }).target;
      const standardMet = value >= standard;
      const targetMet = target != null && value >= target;

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
      return toEntry(data as EntryRow);
    },

    deleteEntry: async (_: unknown, args: { habitId: string; date: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(args.habitId, 'Habit');
      const { error } = await ctx.db.from('entries').delete().eq('habit_id', habitId).eq('date', args.date).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
