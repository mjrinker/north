import type { GraphQLContext } from '../context.js';

async function getUserEmail(ctx: GraphQLContext): Promise<string | null> {
  if (!ctx.userId) return null;
  const { data, error } = await ctx.db.from('users').select('email').eq('id', ctx.userId).single();
  if (error || !data) return null;
  return (data as { email: string }).email;
}

export async function isAdmin(ctx: GraphQLContext): Promise<boolean> {
  if (!ctx.userId || ctx.userId === '__api__') return false;
  const { data: roleData } = await ctx.db
    .from('app_user_roles')
    .select('role_name')
    .eq('user_id', ctx.userId)
    .eq('role_name', 'admin')
    .maybeSingle();
  if (roleData) return true;

  const email = await getUserEmail(ctx);
  if (!email) return false;
  const { data: admins } = await ctx.db.from('admins').select('email').eq('email', email).maybeSingle();
  return !!admins;
}

async function getRolesForUser(ctx: GraphQLContext, userId: string): Promise<string[]> {
  const { data } = await ctx.db.from('app_user_roles').select('role_name').eq('user_id', userId);
  const roles = (data ?? []).map((r: { role_name: string }) => r.role_name);

  const email = await getUserEmail(ctx);
  if (email) {
    const { data: admins } = await ctx.db.from('admins').select('email').eq('email', email).maybeSingle();
    if (admins && !roles.includes('admin')) roles.push('admin');
  }
  return roles;
}

export const userResolvers = {
  Query: {
    myRoles: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) return [];
      const { data } = await ctx.db.from('app_user_roles').select('role_name').eq('user_id', ctx.userId);
      const roles = (data ?? []).map((r: { role_name: string }) => r.role_name);

      const email = await getUserEmail(ctx);
      if (email) {
        const { data: admins } = await ctx.db.from('admins').select('email').eq('email', email).maybeSingle();
        if (admins && !roles.includes('admin')) roles.push('admin');
      }
      return roles;
    },

    usersWithRoles: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (!(await isAdmin(ctx))) throw new Error('Forbidden');

      const { data: users, error: ue } = await ctx.db.from('users').select('id, email, name, avatar');
      if (ue) throw new Error(ue.message);

      const { data: roleRows } = await ctx.db.from('app_user_roles').select('user_id, role_name');

      const roleMap = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role_name);
        roleMap.set(r.user_id, arr);
      }

      const { data: admins } = await ctx.db.from('admins').select('email');
      const adminEmails = new Set((admins ?? []).map((a: { email: string }) => a.email));

      return (users ?? []).map((u: { id: string; email: string; name: string | null; avatar: string | null }) => {
        const roles = roleMap.get(u.id) ?? [];
        if (adminEmails.has(u.email) && !roles.includes('admin')) roles.push('admin');
        return {
          id: u.id,
          email: u.email,
          name: u.name ?? null,
          avatar: u.avatar ?? null,
          roles,
        };
      });
    },
  },

  Mutation: {
    setRoles: async (_: unknown, args: { userId: string; roles: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (!(await isAdmin(ctx))) throw new Error('Forbidden');

      const unique = Array.from(new Set(args.roles));
      const { error: delErr } = await ctx.db.from('app_user_roles').delete().eq('user_id', args.userId);
      if (delErr) throw new Error(delErr.message);

      if (unique.length > 0) {
        const rows = unique.map(role_name => ({ user_id: args.userId, role_name }));
        const { error: insErr } = await ctx.db.from('app_user_roles').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
      return true;
    },
  },
};
