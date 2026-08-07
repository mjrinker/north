import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId } from '../ids.js';
import { runPage } from '../pagination.js';

interface IdentityRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  goals: string[] | null;
}

function toIdentity(row: IdentityRow) {
  return {
    id: toGlobalId('Identity', row.id),
    userId: toGlobalId('User', row.user_id),
    name: row.name,
    description: row.description,
    goals: row.goals ?? [],
  };
}

export const identityResolvers = {
  Query: {
    identities: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db.from('identities').select('*').eq('user_id', ctx.userId).order('name');
      if (error) throw new Error(error.message);
      return (data as IdentityRow[]).map(toIdentity);
    },

    identity: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Identity');
      const { data, error } = await ctx.db.from('identities').select('*').eq('id', id).eq('user_id', ctx.userId).single();
      if (error) return null;
      return toIdentity(data as IdentityRow);
    },

    identitiesConnection: async (
      _: unknown,
      args: { first?: number | null; after?: string | null; offset?: number | null; limit?: number | null },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const apply = (q: any) => q.eq('user_id', ctx.userId);
      return runPage(ctx.db, 'identities', apply, 'name', true, args, toIdentity);
    },
  },

  Mutation: {
    createIdentity: async (_: unknown, args: { name: string; description?: string; goals?: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db.from('identities').insert({
        id: crypto.randomUUID(),
        user_id: ctx.userId,
        name: args.name,
        description: args.description,
        goals: args.goals,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return toIdentity(data as IdentityRow);
    },

    updateIdentity: async (_: unknown, args: { id: string; name?: string; description?: string; goals?: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Identity');
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.goals !== undefined) updates.goals = args.goals;
      const { data, error } = await ctx.db.from('identities').update(updates).eq('id', id).eq('user_id', ctx.userId).select('*').single();
      if (error) throw new Error(error.message);
      return toIdentity(data as IdentityRow);
    },

    upsertIdentity: async (_: unknown, args: { id: string; name: string; description?: string; goals?: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Identity');
      const row = {
        id,
        user_id: ctx.userId,
        name: args.name,
        description: args.description ?? null,
        goals: args.goals ?? [],
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await ctx.db.from('identities').upsert(row, { onConflict: 'id' }).select('*').single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Upsert failed');
      return toIdentity(data as IdentityRow);
    },

    deleteIdentity: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const id = requireGlobalId(args.id, 'Identity');
      const { error } = await ctx.db.from('identities').delete().eq('id', id).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
