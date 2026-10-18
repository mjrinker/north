import type { GraphQLContext } from '../context.js';
import { toGlobalId, fromGlobalId } from '../ids.js';
import { escapeLike } from '../db.js';
import { toHabit, type HabitRow } from './habits.js';
import { toEntry, type EntryRow } from './entries.js';

// Queries return raw DB rows; the type resolvers below map them to the GraphQL
// shape (global ids, camelCase, nested users/habits).

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  created_at: string | null;
}

interface InvitationRow {
  id: string;
  short_code: string;
  inviter_id: string;
  invitee_email: string | null;
  invitee_id: string | null;
  status: string;
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
}

interface PartnershipRow {
  id: string;
  user_id: string;
  partner_id: string;
  created_at: string;
}

interface SharedHabitRow {
  id: string;
  partnership_id: string;
  habit_id: string;
  shared_at: string;
  habits?: HabitRow | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireAuth(ctx: GraphQLContext): string {
  if (!ctx.userId) throw new Error('Unauthorized');
  return ctx.userId;
}

// Accepts a global id of `type` or a raw UUID (invite links carry raw ids).
function parseId(id: string, type: string): string {
  const parsed = fromGlobalId(id);
  if (parsed && parsed.type === type && UUID_RE.test(parsed.id)) return parsed.id;
  if (UUID_RE.test(id)) return id;
  throw new Error(`Invalid ${type} id`);
}

function toUser(row: UserRow) {
  return {
    id: toGlobalId('User', row.id),
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

async function loadUser(ctx: GraphQLContext, id: string | null) {
  if (!id) return null;
  const { data } = await ctx.db.from('users').select('id, email, name, avatar, created_at').eq('id', id).maybeSingle();
  return data ? toUser(data as UserRow) : null;
}

function utcToday(): string {
  return new Date().toISOString().split('T')[0];
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = '';
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

async function loadInvitation(ctx: GraphQLContext, rawId: string): Promise<InvitationRow> {
  const { data, error } = await ctx.db.from('accountability_invitations').select('*').eq('id', rawId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Invitation not found');
  return data as InvitationRow;
}

async function getUserEmail(ctx: GraphQLContext, userId: string): Promise<string | null> {
  const { data } = await ctx.db.from('users').select('email').eq('id', userId).maybeSingle();
  return (data as { email: string } | null)?.email ?? null;
}

// The caller's own partnership row towards `partnerId` (rows exist both ways).
async function ownPartnership(ctx: GraphQLContext, userId: string, partnerId: string): Promise<PartnershipRow | null> {
  const { data } = await ctx.db
    .from('accountability_partnerships')
    .select('*')
    .eq('user_id', userId)
    .eq('partner_id', partnerId)
    .maybeSingle();
  return (data as PartnershipRow | null) ?? null;
}

async function ownPartnershipById(ctx: GraphQLContext, userId: string, partnershipId: string): Promise<PartnershipRow> {
  const { data } = await ctx.db.from('accountability_partnerships').select('*').eq('id', partnershipId).maybeSingle();
  const row = data as PartnershipRow | null;
  if (!row) throw new Error('Partnership not found');
  if (row.user_id !== userId) throw new Error('Forbidden');
  return row;
}

export const accountabilityResolvers = {
  AccountabilityInvitation: {
    id: (inv: InvitationRow) => toGlobalId('AccountabilityInvitation', inv.id),
    shortCode: (inv: InvitationRow) => inv.short_code,
    inviter: (inv: InvitationRow, _: unknown, ctx: GraphQLContext) => loadUser(ctx, inv.inviter_id),
    invitee: (inv: InvitationRow, _: unknown, ctx: GraphQLContext) => loadUser(ctx, inv.invitee_id),
    inviteeEmail: (inv: InvitationRow) => inv.invitee_email,
    status: (inv: InvitationRow) =>
      inv.status === 'pending' && new Date(inv.expires_at).getTime() < Date.now() ? 'expired' : inv.status,
    message: (inv: InvitationRow) => inv.message,
    createdAt: (inv: InvitationRow) => inv.created_at,
    acceptedAt: (inv: InvitationRow) => inv.accepted_at,
    expiresAt: (inv: InvitationRow) => inv.expires_at,
  },

  AccountabilityPartnership: {
    id: (p: PartnershipRow) => toGlobalId('AccountabilityPartnership', p.id),
    user: (p: PartnershipRow, _: unknown, ctx: GraphQLContext) => loadUser(ctx, p.user_id),
    partner: (p: PartnershipRow, _: unknown, ctx: GraphQLContext) => loadUser(ctx, p.partner_id),
    createdAt: (p: PartnershipRow) => p.created_at,
  },

  SharedHabit: {
    id: (s: SharedHabitRow) => toGlobalId('SharedHabit', s.id),
    partnership: async (s: SharedHabitRow, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.db.from('accountability_partnerships').select('*').eq('id', s.partnership_id).maybeSingle();
      return data;
    },
    habit: (s: SharedHabitRow) => (s.habits ? toHabit(s.habits) : null),
    sharedAt: (s: SharedHabitRow) => s.shared_at,
  },

  Query: {
    accountabilityInvitation: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return loadInvitation(ctx, parseId(args.id, 'AccountabilityInvitation'));
    },

    accountabilityInvitationByCode: async (_: unknown, args: { code: string }, ctx: GraphQLContext) => {
      requireAuth(ctx);
      const { data } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .eq('short_code', args.code.trim().toUpperCase())
        .maybeSingle();
      if (!data) throw new Error('Invitation not found');
      return data;
    },

    accountabilityInvitations: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const { data, error } = await ctx.db
        .from('accountability_invitations')
        .select('*')
        .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    accountabilityPartnerships: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const { data, error } = await ctx.db
        .from('accountability_partnerships')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    accountabilityPartnership: async (_: unknown, args: { partnerId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      return ownPartnership(ctx, userId, parseId(args.partnerId, 'User'));
    },

    // Habits the caller shares with a partner (via the caller's own partnership row).
    sharedHabits: async (_: unknown, args: { partnershipId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnership = await ownPartnershipById(ctx, userId, parseId(args.partnershipId, 'AccountabilityPartnership'));
      const { data, error } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnership.id)
        .order('shared_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    // Habits a partner shares with the caller, with the partner's entry for `date`.
    partnerSharedHabits: async (_: unknown, args: { partnerId: string; date?: string | null }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnerId = parseId(args.partnerId, 'User');
      const date = args.date && DATE_RE.test(args.date) ? args.date : utcToday();
      const partnership = await ownPartnership(ctx, partnerId, userId);
      if (!partnership) return [];

      const { data, error } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnership.id)
        .order('shared_at', { ascending: false });
      if (error) throw new Error(error.message);
      const rows = ((data ?? []) as SharedHabitRow[]).filter((d) => d.habits && d.habits.user_id === partnerId && d.habits.status !== 'deleted');

      const habitIds = rows.map((d) => d.habit_id);
      const entryByHabit = new Map<string, EntryRow>();
      if (habitIds.length > 0) {
        const { data: eData } = await ctx.db
          .from('entries')
          .select('*')
          .in('habit_id', habitIds)
          .eq('user_id', partnerId)
          .eq('date', date);
        for (const e of (eData ?? []) as EntryRow[]) entryByHabit.set(e.habit_id, e);
      }

      return rows.map((d) => {
        const entry = entryByHabit.get(d.habit_id);
        return {
          habit: toHabit(d.habits as HabitRow),
          sharedAt: d.shared_at,
          todayEntry: entry ? toEntry(entry) : null,
          standardMet: entry?.standard_met ?? false,
          targetMet: entry?.target_met ?? false,
        };
      });
    },

    partnerHistory: async (_: unknown, args: { partnerId: string; habitId: string; dateFrom?: string; dateTo?: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnerId = parseId(args.partnerId, 'User');
      const habitId = parseId(args.habitId, 'Habit');

      const partnership = await ownPartnership(ctx, partnerId, userId);
      if (!partnership) throw new Error('Partnership not found');

      const { data: shared } = await ctx.db
        .from('shared_habits')
        .select('id')
        .eq('partnership_id', partnership.id)
        .eq('habit_id', habitId)
        .maybeSingle();
      if (!shared) throw new Error('Habit not shared with you');

      let query = ctx.db
        .from('entries')
        .select('date, value, standard_met, target_met')
        .eq('habit_id', habitId)
        .eq('user_id', partnerId);
      if (args.dateFrom) query = query.gte('date', args.dateFrom);
      if (args.dateTo) query = query.lte('date', args.dateTo);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((e: { date: string; value: number; standard_met: boolean; target_met: boolean | null }) => ({
        date: e.date,
        value: e.value,
        standardMet: e.standard_met,
        targetMet: e.target_met ?? false,
      }));
    },
  },

  Mutation: {
    createAccountabilityInvitation: async (_: unknown, args: { email?: string | null; message?: string | null }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const email = args.email?.trim().toLowerCase() || null;

      let inviteeId: string | null = null;
      if (email) {
        if (email === (await getUserEmail(ctx, userId))?.toLowerCase()) throw new Error('Cannot invite yourself');
        const { data } = await ctx.db.from('users').select('id').ilike('email', escapeLike(email)).maybeSingle();
        inviteeId = (data as { id: string } | null)?.id ?? null;
      }

      // Retry on the (unlikely) short-code collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await ctx.db
          .from('accountability_invitations')
          .insert({
            inviter_id: userId,
            invitee_email: email,
            invitee_id: inviteeId,
            message: args.message ?? null,
            short_code: generateShortCode(),
          })
          .select('*')
          .single();
        if (!error) return data;
        if (error.code !== '23505') throw new Error(error.message);
      }
      throw new Error('Could not generate an invitation code');
    },

    acceptAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const invitation = await loadInvitation(ctx, parseId(args.invitationId, 'AccountabilityInvitation'));

      if (invitation.inviter_id === userId) throw new Error('You cannot accept your own invitation');
      // Shareable links (no invitee_email) can be accepted by any signed-in user;
      // email invites only by the intended invitee.
      if (invitation.invitee_email && invitation.invitee_id !== userId) {
        const email = (await getUserEmail(ctx, userId))?.toLowerCase();
        if (invitation.invitee_email.toLowerCase() !== email) throw new Error('Forbidden');
      }
      if (invitation.status !== 'pending') throw new Error('Invitation already processed');
      if (new Date(invitation.expires_at).getTime() < Date.now()) throw new Error('Invitation has expired');

      // Partnerships exist both ways; ignore rows that already exist (re-invites).
      const { error: pError } = await ctx.db.from('accountability_partnerships').upsert(
        [
          { user_id: invitation.inviter_id, partner_id: userId },
          { user_id: userId, partner_id: invitation.inviter_id },
        ],
        { onConflict: 'user_id,partner_id', ignoreDuplicates: true },
      );
      if (pError) throw new Error(pError.message);

      const { error: uError } = await ctx.db
        .from('accountability_invitations')
        .update({ status: 'accepted', invitee_id: userId, accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);
      if (uError) throw new Error(uError.message);

      const partnership = await ownPartnership(ctx, invitation.inviter_id, userId);
      if (!partnership) throw new Error('Partnership not found');
      return partnership;
    },

    declineAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const invitation = await loadInvitation(ctx, parseId(args.invitationId, 'AccountabilityInvitation'));

      if (invitation.inviter_id === userId) throw new Error('Use cancel for your own invitation');
      if (invitation.invitee_email && invitation.invitee_id !== userId) {
        const email = (await getUserEmail(ctx, userId))?.toLowerCase();
        if (invitation.invitee_email.toLowerCase() !== email) throw new Error('Forbidden');
      }
      if (invitation.status !== 'pending') throw new Error('Invitation already processed');

      const { error } = await ctx.db
        .from('accountability_invitations')
        .update({ status: 'declined', invitee_id: userId })
        .eq('id', invitation.id);
      if (error) throw new Error(error.message);
      return true;
    },

    cancelAccountabilityInvitation: async (_: unknown, args: { invitationId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const invitation = await loadInvitation(ctx, parseId(args.invitationId, 'AccountabilityInvitation'));
      if (invitation.inviter_id !== userId) throw new Error('Forbidden');
      const { error } = await ctx.db.from('accountability_invitations').delete().eq('id', invitation.id);
      if (error) throw new Error(error.message);
      return true;
    },

    removeAccountabilityPartnership: async (_: unknown, args: { partnerId: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnerId = parseId(args.partnerId, 'User');
      const { error } = await ctx.db
        .from('accountability_partnerships')
        .delete()
        .or(`and(user_id.eq.${userId},partner_id.eq.${partnerId}),and(user_id.eq.${partnerId},partner_id.eq.${userId})`);
      if (error) throw new Error(error.message);
      return true;
    },

    shareHabitsWithPartner: async (_: unknown, args: { partnershipId: string; habitIds: string[] }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnership = await ownPartnershipById(ctx, userId, parseId(args.partnershipId, 'AccountabilityPartnership'));
      const habitIds = [...new Set(args.habitIds.map((id) => parseId(id, 'Habit')))];
      if (habitIds.length === 0) return [];

      const { data: owned, error: ownErr } = await ctx.db.from('habits').select('id').in('id', habitIds).eq('user_id', userId);
      if (ownErr) throw new Error(ownErr.message);
      if ((owned ?? []).length !== habitIds.length) throw new Error('Habit not found');

      const { error: upsertError } = await ctx.db
        .from('shared_habits')
        .upsert(habitIds.map((habit_id) => ({ partnership_id: partnership.id, habit_id })), { onConflict: 'partnership_id,habit_id' });
      if (upsertError) throw new Error(upsertError.message);

      const { data, error } = await ctx.db
        .from('shared_habits')
        .select('*, habits(*)')
        .eq('partnership_id', partnership.id)
        .in('habit_id', habitIds);
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    unshareHabitsWithPartner: async (_: unknown, args: { partnershipId: string; habitIds: string[] }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);
      const partnership = await ownPartnershipById(ctx, userId, parseId(args.partnershipId, 'AccountabilityPartnership'));
      const habitIds = args.habitIds.map((id) => parseId(id, 'Habit'));
      if (habitIds.length === 0) return true;
      const { error } = await ctx.db
        .from('shared_habits')
        .delete()
        .eq('partnership_id', partnership.id)
        .in('habit_id', habitIds);
      if (error) throw new Error(error.message);
      return true;
    },
  },
};
