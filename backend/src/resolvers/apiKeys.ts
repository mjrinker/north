import crypto from 'node:crypto';
import type { GraphQLContext } from '../context.js';
import { isAdmin } from './users.js';

interface ApiKeyRow {
  id: string;
  user_id: string;
  api_key: string;
  name: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

function toApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    userId: row.user_id,
    apiKey: row.api_key,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export const apiKeyResolvers = {
  Query: {
    myApiKeys: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db.from('api_keys').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as ApiKeyRow[]).map(toApiKey);
    },

    apiKeys: async (_: unknown, args: { userId?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (!(await isAdmin(ctx))) throw new Error('Forbidden');
      let query = ctx.db.from('api_keys').select('*').order('created_at', { ascending: false });
      if (args.userId) query = query.eq('user_id', args.userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as ApiKeyRow[]).map(toApiKey);
    },
  },

  Mutation: {
    createMyApiKey: async (_: unknown, args: { name?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      return insertApiKey(ctx, ctx.userId, args.name);
    },

    revokeMyApiKey: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { error } = await ctx.db.from('api_keys').delete().eq('id', args.id).eq('user_id', ctx.userId);
      if (error) throw new Error(error.message);
      return true;
    },

    createApiKey: async (_: unknown, args: { userId: string; name?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (!(await isAdmin(ctx))) throw new Error('Forbidden');

      const { data: user, error: userErr } = await ctx.db.from('users').select('id').eq('id', args.userId).maybeSingle();
      if (userErr || !user) throw new Error('User not found');

      return insertApiKey(ctx, args.userId, args.name);
    },

    revokeApiKey: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (!(await isAdmin(ctx))) throw new Error('Forbidden');
      const { error } = await ctx.db.from('api_keys').delete().eq('id', args.id);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};

async function insertApiKey(ctx: GraphQLContext, userId: string, name?: string) {
  const apiKey = crypto.randomBytes(24).toString('hex');
  const { data, error } = await ctx.db.from('api_keys').insert({
    user_id: userId,
    api_key: apiKey,
    name: name?.trim() || null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return toApiKey(data as ApiKeyRow);
}