import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hashPassword, verifyPassword, createToken } from '../auth.js';
import type { GraphQLContext } from '../context.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function verifyGoogleToken(idToken: string): Promise<{ email: string; sub: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

  const { payload } = await jwtVerify(idToken, googleJWKS, {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: clientId,
  });

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Google token missing email');
  }

  return { email: payload.email, sub: payload.sub as string };
}

async function findOrCreateGoogleUser(ctx: GraphQLContext, email: string): Promise<UserRow> {
  const { data: existing } = await ctx.db.from('users').select('*').eq('email', email).maybeSingle();
  if (existing) return existing as UserRow;

  const { data, error } = await ctx.db.from('users').insert({
    email: email.toLowerCase().trim(),
    password_hash: '',
  }).select('*').single();

  if (error) throw new Error(error.message);
  return data as UserRow;
}

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId || ctx.userId === '__api__') return null;
      const { data, error } = await ctx.db.from('users').select('id, email, created_at').eq('id', ctx.userId).single();
      if (error) return null;
      return {
        id: (data as UserRow).id,
        email: (data as UserRow).email,
        createdAt: (data as UserRow).created_at,
      };
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
      return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
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
      return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
    },

    googleSignIn: async (_: unknown, args: { idToken: string }, ctx: GraphQLContext) => {
      const { email } = await verifyGoogleToken(args.idToken);
      const user = await findOrCreateGoogleUser(ctx, email);
      const token = await createToken(user.id);
      return { token, user: { id: user.id, email: user.email, createdAt: user.created_at } };
    },
  },
};
