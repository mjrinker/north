import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hashPassword, verifyPassword, createToken } from '../auth.js';
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
    signup: async (_: unknown, args: { email: string; password: string }, ctx: GraphQLContext) => {
      const email = args.email.trim().toLowerCase();
      if (!email || !args.password || args.password.length < 6) {
        throw new Error('Invalid email or password (min 6 chars)');
      }

      const existing = await ctx.db.from('users').select('id').eq('email', email).maybeSingle();
      if (existing.data) throw new Error('Email already registered');

      const passwordHash = await hashPassword(args.password);
      const { data, error } = await ctx.db.from('users').insert({
        email,
        password_hash: passwordHash,
      }).select('id, email, created_at').single();

      if (error) throw new Error(error.message);
      const user = data as UserRow;
      const token = await createToken(user.id);
      return { token, user: toAuthUser(user) };
    },

    login: async (_: unknown, args: { email: string; password: string }, ctx: GraphQLContext) => {
      const email = args.email.trim().toLowerCase();

      const { data, error } = await ctx.db.from('users').select('*').eq('email', email).single();
      if (error || !data) throw new Error('Invalid email or password');

      const user = data as UserRow;
      if (!user.password_hash) throw new Error('This account uses Google Sign-In');

      const valid = await verifyPassword(args.password, user.password_hash);
      if (!valid) throw new Error('Invalid email or password');

      const token = await createToken(user.id);
      return { token, user: toAuthUser(user) };
    },

    googleSignIn: async (_: unknown, args: { idToken: string }, ctx: GraphQLContext) => {
      const { email, name, avatar } = await verifyGoogleToken(args.idToken);
      const user = await findOrCreateGoogleUser(ctx, { email, name, avatar });
      const token = await createToken(user.id);
      return { token, user: toAuthUser(user) };
    },
  },
};
