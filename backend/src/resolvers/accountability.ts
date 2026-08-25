import type { GraphQLContext } from '../context.js';
import { toGlobalId, requireGlobalId } from '../ids.js';
import { getLocalDateString } from '../lib/dates.js';

async function getUserEmail(ctx: GraphQLContext, userId: string): Promise<string | null> {
  const { data, error } = await ctx.db.from('users').select('email').eq('id', userId).single();
  if (error || !data) return null;
  return (data as { email: string }).email;
}

async function getUserByEmail(ctx: GraphQLContext, email: string) {
  const { data, error } = await ctx.db.from('users').select('id, email, name, avatar').eq('email', email).single();
  if (error || !data) return null;
  return data as { id: string; email: string; name: string | null; avatar: string | null };
}

export const accountabilityResolvers = {
  AccountabilityInvitation: {
    inviter: async (invitation: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', invitation.inviter_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('User', data.id) };
    },
    invitee: async (invitation: any, _: unknown, ctx: GraphQLContext) => {
      if (!invitation.invitee_id) return null;
      const { data } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', invitation.invitee_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('User', data.id) };
    },
  },
  AccountabilityPartnership: {
    user: async (partnership: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', partnership.user_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('User', data.id) };
    },
    partner: async (partnership: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', partnership.partner_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('User', data.id) };
    },
  },
  SharedHabit: {
    partnership: async (shared: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('accountability_partnerships').select('*').eq('id', shared.partnership_id).single();
      if (!data) return null;
      return data;
    },
    habit: async (shared: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('habits').select('*').eq('id', shared.habit_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('Habit', data.id) };
    },
  },
  PartnerSharedHabit: {
    habit: async (psh: any, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('habits').select('*').eq('id', psh.habit_id).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('Habit', data.id) };
    },
    todayEntry: async (psh: any, _: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) return null;
      const date = getLocalDateString();
      const { data } = await ctx.db.from('habit_entries').select('*').eq('habit_id', psh.habit_id).eq('user_id', psh.partner_id).eq('date', date).single();
      if (!data) return null;
      return { ...data, id: toGlobalId('HabitEntry', data.id) };
    },
    standardMet: async (psh: any, _: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) return false;
      const date = getLocalDateString();
      const { data } = await ctx.db.from('habit_entries').select('standard_met').eq('habit_id', psh.habit_id).eq('user_id', psh.partner_id).eq('date', date).single();
      return data?.standard_met ?? false;
    },
    targetMet: async (psh: any, _: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) return false;
      const date = getLocalDateString();
      const { data } = await ctx.db.from('habit_entries').select('target_met').eq('habit_id', psh.habit_id).eq('user_id', psh.partner_id).eq('date', date).single();
      return data?.target_met ?? false;
    },
  },

  Query: {
    accountabilityInvitations: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .or(`inviter_id.eq.${ctx.userId},invitee_id.eq.${ctx.userId}`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    accountabilityPartnerships: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const { data, error } = await ctx.db
        .from('accountability_partnerships')
        .select('*')
        .or(`user_id.eq.${ctx.userId},partner_id.eq.${ctx.userId}`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    sharedHabits: async (_: unknown, args: { partnershipId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnershipId = requireGlobalId(args.partnershipId, 'AccountabilityPartnership');
      const { data: partnership, error: pError } = await ctx.db
        .from('accountability_partnerships')
        .select('*')
        .eq('id', partnershipId)
        .single();
      if (pError || !partnership) throw new Error('Partnership not found');
      if (partnership.user_id !== ctx.userId) throw new Error('Forbidden');

      const { data, error } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnershipId)
        .order('shared_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d: any) => ({
        ...d,
        habit: d.habits ? { ...d.habits, id: toGlobalId('Habit', d.habits.id) } : null,
      }));
    },

    partnerSharedHabits: async (_: unknown, args: { partnerId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnerId = requireGlobalId(args.partnerId, 'User');
      const { data: partnerships } = await ctx.db
        .from('accountability_partnerships')
        .select('id')
        .eq('user_id', partnerId)
        .eq('partner_id', ctx.userId)
        .limit(1)
        .single();
      if (!partnerships) return [];

      const { data, error } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnerships.id)
        .order('shared_at', { ascending: false });
      if (error) throw new Error(error.message);

      const today = getLocalDateString();
      const habitIds = (data ?? []).map((d: any) => d.habits?.id).filter(Boolean);
      let entries: any[] = [];
      if (habitIds.length > 0) {
        const { data: eData } = await ctx.db
          .from('habit_entries')
          .select('*')
          .in('habit_id', habitIds)
          .eq('user_id', partnerId)
          .eq('date', today);
        entries = eData ?? [];
      }
      const entryMap = new Map(entries.map((e: any) => [e.habit_id, e]));

      return (data ?? []).map((d: any) => {
        const entry = entryMap.get(d.habits?.id);
        return {
          habit: d.habits ? { ...d.habits, id: toGlobalId('Habit', d.habits.id) } : null,
          sharedAt: d.shared_at,
          todayEntry: entry ? { ...entry, id: toGlobalId('HabitEntry', entry.id) } : null,
          standardMet: entry?.standard_met ?? false,
          targetMet: entry?.target_met ?? false,
        };
      });
    },

    partnerHistory: async (_: unknown, args: { partnerId: string; habitId: string; dateFrom: string; dateTo: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnerId = requireGlobalId(args.partnerId, 'User');
      const habitId = requireGlobalId(args.habitId, 'Habit');

      const { data: partnerships } = await ctx.db
        .from('accountability_partnerships')
        .select('id')
        .eq('user_id', partnerId)
        .eq('partner_id', ctx.userId)
        .limit(1)
        .single();
      if (!partnerships) throw new Error('Partnership not found');

      const { data: shared } = await ctx.db
        .from('shared_habits')
        .select('id')
        .eq('partnership_id', partnerships.id)
        .eq('habit_id', habitId)
        .limit(1)
        .single();
      if (!shared) throw new Error('Habit not shared with you');

      const { data, error } = await ctx.db
        .from('habit_entries')
        .select('date, value, standard_met, target_met')
        .eq('habit_id', habitId)
        .eq('user_id', partnerId)
        .gte('date', args.dateFrom)
        .lte('date', args.dateTo)
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((e: any) => ({
        date: e.date,
        value: e.value,
        standardMet: e.standard_met,
        targetMet: e.target_met ?? false,
      }));
    },
  },

  Mutation: {
    sendAccountabilityInvitation: async (_: unknown, args: { email: string; message?: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      if (ctx.userId === args.email) throw new Error('Cannot invite yourself');

      const invitee = await getUserByEmail(ctx, args.email);
      const { data, error } = await ctx.db.from('accountability_invitations').insert({
        inviter_id: ctx.userId,
        invitee_email: args.email,
        invitee_id: invitee?.id ?? null,
        message: args.message ?? null,
      }).select('*').single();
      if (error) throw new Error(error.message);

      // TODO: Send email notification
      return {
        ...data,
        inviter: { id: toGlobalId('User', ctx.userId) },
        invitee: invitee ? { ...invitee, id: toGlobalId('User', invitee.id) } : null,
      };
    },

    acceptAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const invitationId = requireGlobalId(args.invitationId, 'AccountabilityInvitation');

      const { data: invitation, error: invError } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      if (invError || !invitation) throw new Error('Invitation not found');

      const inviteeEmail = await getUserEmail(ctx, ctx.userId);
      if (invitation.invitee_email !== inviteeEmail && invitation.invitee_id !== ctx.userId) {
        throw new Error('Forbidden');
      }
      if (invitation.status !== 'pending') throw new Error('Invitation already processed');

      await ctx.db.from('accountability_invitations')
        .update({ status: 'accepted', invitee_id: ctx.userId, accepted_at: new Date().toISOString() })
        .eq('id', invitationId);

      // Create partnership both ways
      const { data: partnership, error: pError } = await ctx.db.from('accountability_partnerships').insert([
        { user_id: invitation.inviter_id, partner_id: ctx.userId },
        { user_id: ctx.userId, partner_id: invitation.inviter_id },
      ]).select('*').single();
      if (pError) throw new Error(pError.message);

      const { data: inviter } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', invitation.inviter_id).single();
      const { data: user } = await ctx.db.from('users').select('id, email, name, avatar').eq('id', ctx.userId).single();

      return {
        id: toGlobalId('AccountabilityPartnership', partnership.id),
        user: { ...inviter, id: toGlobalId('User', inviter.id) },
        partner: { ...user, id: toGlobalId('User', user.id) },
        createdAt: partnership.created_at,
      };
    },

    declineAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const invitationId = requireGlobalId(args.invitationId, 'AccountabilityInvitation');

      const { data: invitation, error: invError } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      if (invError || !invitation) throw new Error('Invitation not found');

      const inviteeEmail = await getUserEmail(ctx, ctx.userId);
      if (invitation.invitee_email !== inviteeEmail && invitation.invitee_id !== ctx.userId) {
        throw new Error('Forbidden');
      }

      await ctx.db.from('accountability_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);
      return true;
    },

    removeAccountabilityPartnership: async (_: unknown, args: { partnerId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnerId = requireGlobalId(args.partnerId, 'User');

      const { error } = await ctx.db
        .from('accountability_partnerships')
        .delete()
        .or(`and(user_id.eq.${ctx.userId},partner_id.eq.${partnerId}),and(user_id.eq.${partnerId},partner_id.eq.${ctx.userId})`);
      if (error) throw new Error(error.message);
      return true;
    },

    cancelAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const invitationId = requireGlobalId(args.invitationId, 'AccountabilityInvitation');

      const { data: invitation, error: invError } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      if (invError || !invitation) throw new Error('Invitation not found');

      if (invitation.inviter_id !== ctx.userId) throw new Error('Forbidden');

      const { error } = await ctx.db.from('accountability_invitations').delete().eq('id', invitationId);
      if (error) throw new Error(error.message);
      return true;
    },

    shareHabitsWithPartner: async (_: unknown, args: { partnershipId: string; habitIds: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnershipId = requireGlobalId(args.partnershipId, 'AccountabilityPartnership');

      const { data: partnership, error: pError } = await ctx.db
        .from('accountability_partnerships')
        .select('*')
        .eq('id', partnershipId)
        .single();
      if (pError || !partnership) throw new Error('Partnership not found');
      if (partnership.user_id !== ctx.userId) throw new Error('Forbidden: only the user who shared can manage shared habits');

      const habitIds = args.habitIds.map(id => requireGlobalId(id, 'Habit'));
      const rows = habitIds.map(habitId => ({
        partnership_id: partnershipId,
        habit_id: habitId,
      }));

      const { error } = await ctx.db.from('shared_habits').upsert(rows, { onConflict: 'partnership_id,habit_id' });
      if (error) throw new Error(error.message);

      const { data } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnershipId)
        .in('habit_id', habitIds);
      if (error) throw new Error(error.message);

      return (data ?? []).map((d: any) => ({
        ...d,
        habit: d.habits ? { ...d.habits, id: toGlobalId('Habit', d.habits.id) } : null,
      }));
    },

    unshareHabitsWithPartner: async (_: unknown, args: { partnershipId: string; habitIds: string[] }, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      const partnershipId = requireGlobalId(args.partnershipId, 'AccountabilityPartnership');

      const { data: partnership, error: pError } = await ctx.db
        .from('accountability_partnerships')
        .select('*')
        .eq('id', partnershipId)
        .single();
      if (pError || !partnership) throw new Error('Partnership not found');
      if (partnership.user_id !== ctx.userId) throw new Error('Forbidden');

      const habitIds = args.habitIds.map(id => requireGlobalId(id, 'Habit'));
      const { error } = await ctx.db
        .from('shared_habits')
        .delete()
        .eq('partnership_id', partnershipId)
        .in('habit_id', habitIds);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};