import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createToken } from '../auth.js';
import type { GraphQLContext } from '../context.js';
import { toGlobalId } from '../ids.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  avatar: string | null;
  created_at: string;
}

const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function verifyGoogleToken(idToken: string): Promise<{ email: string; sub: string; name: string | null; avatar: string | null }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

  const { payload } = await jwtVerify(idToken, googleJWKS, {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: clientId,
  });

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Google token missing email');
  }

  return {
    email: payload.email,
    sub: payload.sub as string,
    name: typeof payload.name === 'string' ? payload.name : null,
    avatar: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

async function findOrCreateGoogleUser(ctx: GraphQLContext, info: { email: string; name: string | null; avatar: string | null }): Promise<UserRow> {
  const { data: existing } = await ctx.db.from('users').select('*').eq('email', info.email).maybeSingle();
  if (existing) {
    const row = existing as UserRow;
    const { data, error } = await ctx.db.from('users').update({
      name: row.name ?? info.name,
      avatar: row.avatar ?? info.avatar,
    }).eq('id', row.id).select('*').single();
    if (error) throw new Error(error.message);
    return data as UserRow;
  }

  const { data, error } = await ctx.db.from('users').insert({
    email: info.email.toLowerCase().trim(),
    password_hash: '',
    name: info.name,
    avatar: info.avatar,
  }).select('*').single();

  if (error) throw new Error(error.message);
  return data as UserRow;
}

function toAuthUser(row: UserRow) {
  return {
    id: toGlobalId('User', row.id),
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId || ctx.userId === '__api__') return null;
      const { data, error } = await ctx.db.from('users').select('id, email, name, avatar, created_at').eq('id', ctx.userId).single();
      if (error) return null;
      return toAuthUser(data as UserRow);
    },
  },

  Mutation: {
    googleSignIn: async (_: unknown, args: { idToken: string }, ctx: GraphQLContext) => {
      const { email, name, avatar } = await verifyGoogleToken(args.idToken);
      const user = await findOrCreateGoogleUser(ctx, { email, name, avatar });
      const token = await createToken(user.id);
      return { token, user: toAuthUser(user) };
    },
  },
};
