import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId, requireGlobalIdOptional } from '../ids.js';

interface NoteRow {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  content: string | null;
  status: string | null;
  created_at: string | null;
}

export type { NoteRow };

export function toNote(row: NoteRow) {
  return {
    id: toGlobalId('HabitNote', row.id),
    habitId: toGlobalId('Habit', row.habit_id),
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
      if (args.habitId) query = query.eq('habit_id', requireGlobalId(args.habitId, 'Habit'));
      if (args.date) query = query.eq('date', args.date);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as NoteRow[]).map(toNote);
    },
  },

  Mutation: {
    addNote: async (_: unknown, args: { input: { id?: string; habitId: string; date: string; content?: string } }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db.from('notes').upsert({
        id: requireGlobalIdOptional(args.input.id, 'HabitNote') ?? crypto.randomUUID(),
        user_id: ctx.userId,
        habit_id: requireGlobalId(args.input.habitId, 'Habit'),
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
