import type { YogaInitialContext } from 'graphql-yoga';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDb } from './db.js';
import { authenticate } from './auth.js';

export interface GraphQLContext {
  userId: string | null;
  db: SupabaseClient;
}

export async function buildContext(initial: YogaInitialContext): Promise<GraphQLContext> {
  const auth = await authenticate(initial.request);
  let db: SupabaseClient;
  try {
    db = getDb();
  } catch (e) {
    throw new Error(`Database not configured: ${(e as Error).message}`);
  }
  return { userId: auth.userId, db };
}
