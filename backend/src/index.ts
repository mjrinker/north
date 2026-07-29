import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createYoga } from 'graphql-yoga';
import type { GraphQLContext } from './context';
import { schema } from './schema';
import { buildContext } from './context';

const yoga = createYoga<GraphQLContext>({
  schema,
  context: buildContext,
  cors: false,
  graphiql: process.env.NODE_ENV !== 'production',
});

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.all('/graphql', async (c) => {
  const response = await yoga.fetch(c.req.raw);
  return new Response(response.body, response);
});

export const GET = handle(app);
export const POST = handle(app);

export const config = { runtime: 'nodejs' };
