import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createYoga } from 'graphql-yoga';
import type { GraphQLContext } from './context.js';
import { schema } from './schema.js';
import { buildContext } from './context.js';
import { getDb } from './db.js';

const isProd = process.env.NODE_ENV === 'production';

const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'https://north-mu.vercel.app,http://localhost:5173')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

const yoga = createYoga<GraphQLContext>({
  schema,
  context: buildContext,
  cors: {
    origin: frontendOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'OPTIONS'],
  },
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
export const OPTIONS = handle(app);

export const config = { runtime: 'nodejs' };
