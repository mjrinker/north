import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId, requireGlobalIdOptional } from '../ids.js';
import { runPage } from '../pagination.js';

interface NoteRow {
  id: string;
  user_id: string;
  habit_id: string;
  habit_ids: string[] | null;
  date: string;
  content: string | null;
  status: string | null;
  created_at: string | null;
}

export type { NoteRow };

export function toNote(row: NoteRow) {
  const habitIds = row.habit_ids?.length ? row.habit_ids : [row.habit_id];
  return {
    id: toGlobalId('HabitNote', row.id),
    habitId: toGlobalId('Habit', row.habit_id),
    habitIds: habitIds.map((h) => toGlobalId('Habit', h)),
    date: row.date,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const noteResolvers = {
  Query: {
    notes: async (_: unknown, args: { habitId?: string; date?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      let query = ctx.db.from('notes').select('*').eq('user_id', ctx.userId);
      if (args.habitId) query = query.contains('habit_ids', [requireGlobalId(args.habitId, 'Habit')]);
      if (args.date) query = query.eq('date', args.date);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as NoteRow[]).map(toNote);
    },

    notesConnection: async (
      _: unknown,
      args: {
        first?: number | null;
        after?: string | null;
        offset?: number | null;
        limit?: number | null;
        habitId?: string;
        date?: string;
      },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const apply = (q: any) => {
        let query = q.eq('user_id', ctx.userId);
        if (args.habitId) query = query.contains('habit_ids', [requireGlobalId(args.habitId, 'Habit')]);
        if (args.date) query = query.eq('date', args.date);
        return query;
      };
      return runPage(ctx.db, 'notes', apply, 'created_at', false, args, toNote);
    },
  },

  Mutation: {
    addNote: async (_: unknown, args: { input: { id?: string; habitId: string; date: string; content?: string; habitIds?: string[] } }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitIds = (args.input.habitIds?.length ? args.input.habitIds : [args.input.habitId])
        .map((h) => requireGlobalId(h, 'Habit'));
      if (!habitIds.length) throw new Error('A note must be linked to at least one habit');
      const primaryHabitId = habitIds[0];
      const { data, error } = await ctx.db.from('notes').upsert({
        id: requireGlobalIdOptional(args.input.id, 'HabitNote') ?? crypto.randomUUID(),
        user_id: ctx.userId,
        habit_id: primaryHabitId,
        habit_ids: habitIds,
        date: args.input.date,
        content: args.input.content,
      }, { onConflict: 'id' }).select('*').single();
      if (error) throw new Error(error.message);
      return toNote(data as NoteRow);
    },

    deleteNote: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'HabitNote');
      const { error } = await ctx.db.from('notes').update({ status: 'deleted' }).eq('id', id).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
