import type { GraphQLContext } from '../context.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toEntry, type EntryRow } from './entries.js';
import { toNote, type NoteRow } from './notes.js';
import { toGlobalId, requireGlobalId, requireGlobalIdOptional, encodeDependsOn, decodeDependsOn, toGlobalIds, decodeGlobalIds } from '../ids.js';
import { runPage } from '../pagination.js';

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
  linked_habit_ids: string[] | null;
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
    linkedHabitIds: toGlobalIds(row.linked_habit_ids),
    identityId: row.identity_id ? toGlobalId('Identity', row.identity_id) : null,
    tags: row.tags ?? [],
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Keeps a habit's link group symmetric: the picked partners (plus the habit
// itself) form the group, every member lists the other members, and any habit
// that still references a group member without being part of the group has the
// member stripped from its list (so unlinking stays two-way).
async function applyLinkedGroup(
  db: SupabaseClient,
  userId: string,
  target: { id: string; type: string; status: string },
  selectedRawIds: string[],
): Promise<void> {
  const targetId = target.id;

  if (target.status === 'deleted') {
    const { data: rows } = await db
      .from('habits')
      .select('id, linked_habit_ids')
      .eq('user_id', userId)
      .contains('linked_habit_ids', [targetId]);
    for (const r of rows ?? []) {
      const row = r as { id: string; linked_habit_ids: string[] | null };
      const next = (row.linked_habit_ids ?? []).filter(id => id !== targetId);
      if (next.length === (row.linked_habit_ids ?? []).length) continue;
      await db
        .from('habits')
        .update({ linked_habit_ids: next, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('user_id', userId);
    }
    return;
  }

  const selected = [...new Set(selectedRawIds.filter(id => id && id !== targetId))];

  let selectedRows: { id: string; type: string; status: string }[] = [];
  if (selected.length) {
    const { data, error } = await db.from('habits').select('id, type, status').in('id', selected).eq('user_id', userId);
    if (error) throw new Error(error.message);
    selectedRows = (data ?? []) as typeof selectedRows;
  }
  selectedRows = selectedRows.filter(r => r.status !== 'deleted');
  const keptIds = new Set(selectedRows.map(r => r.id));
  const missing = selected.filter(id => !keptIds.has(id));
  if (missing.length) throw new Error('Linked habit not found');

  for (const r of selectedRows) {
    if (r.type !== target.type) {
      throw new Error(`Linked habits must have the same type as "${target.type}"`);
    }
  }

  const group = [...new Set([targetId, ...selected])];

  // Strip any group member out of habits that aren't part of the group (e.g.
  // a partner the user just unlinked on another device).
  const { data: refs } = await db
    .from('habits')
    .select('id, linked_habit_ids')
    .eq('user_id', userId)
    .overlaps('linked_habit_ids', group);

  const writes: { id: string; linked_habit_ids: string[] }[] = [];
  for (const memberId of group) {
    writes.push({ id: memberId, linked_habit_ids: group.filter(id => id !== memberId) });
  }
  for (const r of refs ?? []) {
    const row = r as { id: string; linked_habit_ids: string[] | null };
    if (group.includes(row.id)) continue;
    const next = (row.linked_habit_ids ?? []).filter(id => !group.includes(id));
    if (next.length === (row.linked_habit_ids ?? []).length) continue;
    writes.push({ id: row.id, linked_habit_ids: next });
  }

  const now = new Date().toISOString();
  for (const w of writes) {
    await db
      .from('habits')
      .update({ linked_habit_ids: w.linked_habit_ids, updated_at: now })
      .eq('id', w.id)
      .eq('user_id', userId);
  }
}

// Re-fetches a habit row after the link group has been rewritten so the
// returned object reflects the final linked_habit_ids.
async function refetch(db: SupabaseClient, userId: string, id: string): Promise<HabitRow> {
  const { data, error } = await db.from('habits').select('*').eq('id', id).eq('user_id', userId).single();
  if (error || !data) throw new Error(error?.message ?? 'Habit not found');
  return data as HabitRow;
}

async function latestStatusRow(db: SupabaseClient, userId: string, id: string): Promise<HabitRow | null> {
  const { data } = await db.from('habits').select('type, status, linked_habit_ids').eq('id', id).eq('user_id', userId).maybeSingle();
  return (data as HabitRow | null) ?? null;
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
      let query = ctx.db.from('notes').select('*').contains('habit_ids', [habitId]);
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

    habitsConnection: async (
      _: unknown,
      args: {
        first?: number | null;
        after?: string | null;
        offset?: number | null;
        limit?: number | null;
        status?: string;
        tags?: string[];
        title?: string;
        type?: string;
        sortBy?: string;
        sortDir?: string;
      },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const apply = (q: any) => {
        let query = q.eq('user_id', ctx.userId);
        if (args.status) query = query.eq('status', args.status);
        if (args.type) query = query.eq('type', args.type);
        if (args.tags?.length) query = query.contains('tags', args.tags);
        if (args.title) query = query.ilike('title', `%${args.title}%`);
        return query;
      };
      const sortColumn = (args.sortBy ?? 'SORT_ORDER') === 'SORT_ORDER' ? 'sort_order'
        : args.sortBy === 'TITLE' ? 'title'
        : args.sortBy === 'CREATED_AT' ? 'created_at'
        : 'updated_at';
      const ascending = args.sortDir !== 'DESC';
      return runPage(ctx.db, 'habits', apply, sortColumn, ascending, args, toHabit);
    },
  },

  Mutation: {
    createHabit: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const newId = crypto.randomUUID();
      const linkedIds = decodeGlobalIds(args.input.linkedHabitIds as string[] | null | undefined);
      const { data, error } = await ctx.db.from('habits').insert({
        id: newId,
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
      if (linkedIds.length) {
        await applyLinkedGroup(ctx.db, ctx.userId, { id: newId, type: args.input.type as string, status: 'active' }, linkedIds);
        return toHabit(await refetch(ctx.db, ctx.userId, newId));
      }
      const row = data as HabitRow;
      return toHabit({ ...row, linked_habit_ids: [] });
    },

    updateHabit: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const existing = await latestStatusRow(ctx.db, ctx.userId, id);
      if (!existing) throw new Error('Habit not found');
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

      const finalStatus = (updates.status as string | undefined) ?? existing.status ?? 'active';
      if (finalStatus === 'deleted') {
        await applyLinkedGroup(ctx.db, ctx.userId, { id, type: existing.type ?? 'binary', status: 'deleted' }, []);
        await ctx.db.from('habits').update({ linked_habit_ids: [] }).eq('id', id).eq('user_id', ctx.userId);
        return toHabit({ ...(data as HabitRow), linked_habit_ids: [] });
      }
      if (args.input.linkedHabitIds !== undefined) {
        const selected = decodeGlobalIds(args.input.linkedHabitIds as string[] | null | undefined);
        await applyLinkedGroup(ctx.db, ctx.userId, { id, type: (updates.type as string | undefined) ?? existing.type ?? 'binary', status: finalStatus }, selected);
        return toHabit(await refetch(ctx.db, ctx.userId, id));
      }
      return toHabit(data as HabitRow);
    },

    upsertHabit: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const provided = args.input.linkedHabitIds !== undefined;
      const linkedIds = provided ? decodeGlobalIds(args.input.linkedHabitIds as string[] | null | undefined) : null;
      const row: Record<string, unknown> = {
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
      if (linkedIds) {
        row.linked_habit_ids = linkedIds;
      } else {
        const existing = await latestStatusRow(ctx.db, ctx.userId, id);
        row.linked_habit_ids = existing?.linked_habit_ids ?? [];
      }
      const { data, error } = await ctx.db.from('habits').upsert(row, { onConflict: 'id' }).select('*').single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Upsert failed');

      const status = (args.input.status as string | undefined) ?? 'active';
      if (status === 'deleted') {
        await applyLinkedGroup(ctx.db, ctx.userId, { id, type: args.input.type as string, status: 'deleted' }, []);
        await ctx.db.from('habits').update({ linked_habit_ids: [] }).eq('id', id).eq('user_id', ctx.userId);
        return toHabit({ ...(data as HabitRow), linked_habit_ids: [] });
      }
      if (linkedIds) {
        const selected = linkedIds;
        await applyLinkedGroup(ctx.db, ctx.userId, { id, type: args.input.type as string, status }, selected);
        return toHabit(await refetch(ctx.db, ctx.userId, id));
      }
      return toHabit(data as HabitRow);
    },

    deleteHabit: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Habit');
      const existing = await latestStatusRow(ctx.db, ctx.userId, id);
      if (existing) {
        await applyLinkedGroup(ctx.db, ctx.userId, { id, type: existing.type ?? 'binary', status: 'deleted' }, []);
      }
      const { error } = await ctx.db.from('habits').delete().eq('id', id).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
