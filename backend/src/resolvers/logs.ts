import type { GraphQLContext } from '../context.js';

interface LogRow {
  level: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
}

export const logResolvers = {
  Mutation: {
    clientLogs: async (
      _: unknown,
      args: {
        entries: { level?: string; message?: string; stack?: string | null; url?: string | null; timestamp?: string | null }[];
      },
      ctx: GraphQLContext,
    ) => {
      const rows: LogRow[] = (args.entries ?? [])
        .filter((e) => e && typeof e.message === 'string' && e.message.length > 0)
        .map((e) => ({
          level: ['log', 'info', 'warn', 'error'].includes(e.level ?? '') ? (e.level as string) : 'log',
          message: (e.message as string).slice(0, 5000),
          stack: e.stack ? e.stack.slice(0, 10000) : null,
          url: e.url ? e.url.slice(0, 1000) : null,
          user_agent: null,
        }));

      if (rows.length === 0) return true;

      const { error } = await ctx.db.from('client_logs').insert(rows);
      if (error) {
        console.error('clientLogs insert error:', error.message);
        return false;
      }
      return true;
    },
  },
};
