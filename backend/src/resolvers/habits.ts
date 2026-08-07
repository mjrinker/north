import type { GraphQLContext } from '../context.js';
import { toEntry, type EntryRow } from './entries.js';
import { toNote, type NoteRow } from './notes.js';
import { toGlobalId, requireGlobalId, requireGlobalIdOptional, encodeDependsOn, decodeDependsOn } from '../ids.js';

interface HabitRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: string;
  standard: number | null;
  target: number | null;
  unit: string | null;
  schedule: unknown;
  metadata: unknown;
  depends_on: unknown;
  identity_id: string | null;
  tags: string[] | null;
  status: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

function toHabit(row: HabitRow) {
  return {
    id: toGlobalId('Habit', row.id),
    userId: toGlobalId('User', row.user_id),
    title: row.title,
    description: row.description,
    type: row.type,
    standard: row.standard,
    target: row.target,
    unit: row.unit,
    schedule: row.schedule,
    metadata: row.metadata,
    dependsOn: encodeDependsOn(row.depends_on),
    identityId: row.identity_id ? toGlobalId('Identity', row.identity_id) : null,
    tags: row.tags ?? [],
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const habitResolvers = {
  Habit: {
    entries: async (habit: { id: string }, args: { dateFrom?: string; dateTo?: string; limit?: number }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(habit.id, 'Habit');
      let query = ctx.db.from('entries').select('*').eq('habit_id', habitId).eq('user_id', ctx.userId);
      if (args.dateFrom) query = query.gte('date', args.dateFrom);
      if (args.dateTo) query = query.lte('date', args.dateTo);
      query = query.order('date', { ascending: false });
      if (args.limit && args.limit > 0) query = query.limit(args.limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as EntryRow[]).map(toEntry);
    },
    notes: async (habit: { id: string }, args: { dateFrom?: string; dateTo?: string; limit?: number }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const habitId = requireGlobalId(habit.id, 'Habit');
      let query = ctx.db.from('notes').select('*').eq('habit_id', habitId);
      if (args.dateFrom) query = query.gte('date', args.dateFrom);
      if (args.dateTo) query = query.lte('date', args.dateTo);
      query = query.order('created_at', { ascending: false });
      if (args.limit && args.limit > 0) query = query.limit(args.limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as NoteRow[]).map(toNote);
    },
  },

  Query: {
    habits: async (_: unknown, args: { userId?: string; status?: string; tags?: string[]; title?: string; type?: string; sortBy?: string; sortDir?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      let query = ctx.db.from('habits').select('*').eq('user_id', ctx.userId);
      if (args.status) query = query.eq('status', args.status);
      if (args.type) query = query.eq('type', args.type);
      if (args.tags?.length) query = query.contains('tags', args.tags);
      if (args.title) query = query.ilike('title', `%${args.title}%`);

      const sortColumn = (args.sortBy ?? 'SORT_ORDER') === 'SORT_ORDER' ? 'sort_order'
        : args.sortBy === 'TITLE' ? 'title'
        : args.sortBy === 'CREATED_AT' ? 'created_at'
        : 'updated_at';
      const ascending = args.sortDir !== 'DESC';
      query = query.order(sortColumn, { ascending });

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as HabitRow[]).map(toHabit);
    },

    habit: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const { data, error } = await ctx.db.from('habits').select('*').eq('id', id).eq('user_id', ctx.userId).single();
      if (error) return null;
      return toHabit(data as HabitRow);
    },
  },

  Mutation: {
    createHabit: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db.from('habits').insert({
        id: crypto.randomUUID(),
        user_id: ctx.userId,
        title: args.input.title,
        description: args.input.description,
        type: args.input.type,
        standard: args.input.standard,
        target: args.input.target,
        unit: args.input.unit,
        schedule: args.input.schedule,
        metadata: args.input.metadata,
        identity_id: requireGlobalIdOptional(args.input.identityId as string | null | undefined, 'Identity'),
        depends_on: decodeDependsOn(args.input.dependsOn),
        tags: args.input.tags,
        sort_order: args.input.sortOrder,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return toHabit(data as HabitRow);
    },

    updateHabit: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const updates: Record<string, unknown> = {};
      if (args.input.title !== undefined) updates.title = args.input.title;
      if (args.input.description !== undefined) updates.description = args.input.description;
      if (args.input.standard !== undefined) updates.standard = args.input.standard;
      if (args.input.target !== undefined) updates.target = args.input.target;
      if (args.input.unit !== undefined) updates.unit = args.input.unit;
      if (args.input.schedule !== undefined) updates.schedule = args.input.schedule;
      if (args.input.metadata !== undefined) updates.metadata = args.input.metadata;
      if (args.input.dependsOn !== undefined) updates.depends_on = decodeDependsOn(args.input.dependsOn);
      if (args.input.identityId !== undefined) updates.identity_id = requireGlobalIdOptional(args.input.identityId as string | null | undefined, 'Identity');
      if (args.input.tags !== undefined) updates.tags = args.input.tags;
      if (args.input.status !== undefined) updates.status = args.input.status;
      if (args.input.sortOrder !== undefined) updates.sort_order = args.input.sortOrder;
      const { data, error } = await ctx.db.from('habits').update(updates).eq('id', id).eq('user_id', ctx.userId).select('*').single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Habit not found: no rows returned');
      return toHabit(data as HabitRow);
    },

    upsertHabit: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const row = {
        id,
        user_id: ctx.userId,
        title: args.input.title,
        description: args.input.description ?? null,
        type: args.input.type,
        standard: args.input.standard ?? null,
        target: args.input.target ?? null,
        unit: args.input.unit ?? null,
        schedule: args.input.schedule ?? null,
        metadata: args.input.metadata ?? null,
        depends_on: decodeDependsOn(args.input.dependsOn),
        identity_id: requireGlobalIdOptional(args.input.identityId as string | null | undefined, 'Identity'),
        tags: args.input.tags ?? [],
        status: args.input.status ?? 'active',
        sort_order: args.input.sortOrder ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await ctx.db.from('habits').upsert(row, { onConflict: 'id' }).select('*').single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Upsert failed');
      return toHabit(data as HabitRow);
    },

    deleteHabit: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const { error } = await ctx.db.from('habits').delete().eq('id', id).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
