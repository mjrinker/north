import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createYoga } from 'graphql-yoga';
import type { GraphQLContext } from './context';
import { schema } from './schema';
import { buildContext } from './context';
import { getDb } from './db';

const isProd = process.env.NODE_ENV === 'production';

const yoga = createYoga<GraphQLContext>({
  schema,
  context: buildContext,
  cors: false,
  graphiql: !isProd,
  maskedErrors: isProd,
});

const app = new Hono();

app.get('/', (c) =>
  c.json({
    name: 'north-api',
    ok: true,
    graphql: '/graphql',
    health: '/health',
    playground: isProd ? undefined : '/graphql',
  }),
);

app.get('/health', (c) => {
  let db = 'unknown';
  try {
    getDb();
    db = 'ok';
  } catch {
    db = 'misconfigured';
  }
  return c.json({ ok: true, db, ts: Date.now() });
});

app.all('/graphql', async (c) => {
  try {
    const response = await yoga.fetch(c.req.raw);
    return new Response(response.body, response);
  } catch (e) {
    return c.json({ errors: [{ message: (e as Error).message || 'Internal error' }] }, 500);
  }
});

app.notFound((c) => c.json({ ok: false, error: 'not_found', path: c.req.path }, 404));

export const GET = handle(app);
export const POST = handle(app);

export const config = { runtime: 'nodejs' };
