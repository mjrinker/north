import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import { createYoga } from 'graphql-yoga';
import type { GraphQLContext } from './context.js';
import { schema } from './schema.js';
import { buildContext } from './context.js';
import { getDb } from './db.js';

const isProd = process.env.NODE_ENV === 'production';

const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'https://north-mu.vercel.app,http://localhost:5173')
  .split(/[\s,]+/)
  .map((s: string) => s.trim())
  .filter(Boolean);

const yoga = createYoga<GraphQLContext>({
  schema,
  context: buildContext,
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

app.use('/graphql', cors({
  origin: frontendOrigins,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

app.all('/graphql', async (c) => {
  try {
    const response = await yoga.fetch(c.req.raw);
    return new Response(response.body, response);
  } catch (e) {
    return c.json({ errors: [{ message: (e as Error).message || 'Internal error' }] }, 500);
  }
});

app.notFound((c) => c.json({ ok: false, error: 'not_found', path: c.req.path }, 404));

// vercel.json rewrites every path to this file and passes the original path as
// `__path`. Depending on the runtime, the function sees either the original URL
// or the rewritten one (/src/index.ts), so restore the original before routing.
export async function restoreOriginalPath(req: Request): Promise<Request> {
  const url = new URL(req.url);
  const original = url.searchParams.get('__path');
  if (original === null && url.pathname !== '/src/index.ts') return req;
  url.searchParams.delete('__path');
  url.pathname = original !== null ? '/' + original.replace(/^\/+/, '') : '/graphql';
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });
}

const handler = handle(app);
const vercelHandler = async (req: Request) => handler(await restoreOriginalPath(req));

export const GET = vercelHandler;
export const POST = vercelHandler;
export const OPTIONS = vercelHandler;

export const config = { runtime: 'nodejs' };
