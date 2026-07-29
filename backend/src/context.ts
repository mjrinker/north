import type { YogaInitialContext } from 'graphql-yoga';
import { db } from './db';
import { authenticate } from './auth';

export interface GraphQLContext {
  userId: string | null;
  db: typeof db;
}

export async function buildContext(initial: YogaInitialContext): Promise<GraphQLContext> {
  const auth = await authenticate(initial.request);
  return { userId: auth.userId, db };
}
