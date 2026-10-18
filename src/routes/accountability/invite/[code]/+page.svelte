<script lang="ts">
  import { page } from '$app/stores';
  import { user, isLoading as authLoading } from '../../../../stores/auth';
  import { gql } from '../../../../lib/api';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let shortCode = $state('');
  page.subscribe(p => { shortCode = p.params.code ?? ''; });

  let invitation = $state<any>(null);
  let loading = $state(true);
  let error = $state('');
  let actionLoading = $state(false);

  async function loadInvitation() {
    loading = true;
    try {
      const data = await gql<{ accountabilityInvitationByCode: any }>(
        `query ($code: String!) { accountabilityInvitationByCode(code: $code) { id inviter { id email name avatar } inviteeEmail invitee { id email name avatar } status message createdAt expiresAt } }`,
        { code: shortCode }
      );
      invitation = data?.accountabilityInvitationByCode ?? null;
      if (!invitation) error = 'Invitation not found';
      else if (invitation.status !== 'pending') error = 'This invitation has already been ' + invitation.status;
    } catch (e: any) {
      error = e.message ?? 'Failed to load invitation';
    }
    loading = false;
  }

  let authPending = $state(true);
  authLoading.subscribe(v => authPending = v);

  // The invitation can only be read when signed in.
  $effect(() => {
    if (authPending) return;
    if (currentUser && shortCode) loadInvitation();
    else loading = false;
  });

  async function acceptInvitation() {
    if (!currentUser) {
      goto('/settings'); // triggers sign in
      return;
    }
    actionLoading = true;
    try {
      await gql(`mutation ($invitationId: ID!) { acceptAccountabilityInvitation(invitationId: $invitationId) { id } }`, { invitationId: invitation.id });
      goto('/accountability');
    } catch (e: any) {
      alert(e.message ?? 'Failed to accept invitation');
    }
    actionLoading = false;
  }

  async function declineInvitation() {
    if (!currentUser) {
      goto('/settings');
      return;
    }
    actionLoading = true;
    try {
      await gql(`mutation ($invitationId: ID!) { declineAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId: invitation.id });
      goto('/accountability');
    } catch (e: any) {
      alert(e.message ?? 'Failed to decline invitation');
    }
    actionLoading = false;
  }
</script>

<div class="page invite">
  {#if loading || authPending}
    <p class="empty">Loading invitation…</p>
  {:else if !currentUser}
    <div class="centered">
      <h1 class="page-title">You’ve been invited</h1>
      <p class="lede">Sign in to see who invited you and accept. North is free and works offline.</p>
      <a class="btn" href="/settings">Sign in</a>
    </div>
  {:else if error}
    <div class="centered">
      <h1 class="page-title">Can’t open this invitation</h1>
      <p class="lede">{error}</p>
      <a href="/accountability" class="btn btn-secondary">Go to Partners</a>
    </div>
  {:else if invitation}
    <div class="centered">
      {#if invitation.inviter?.avatar}
        <img class="avatar" src={invitation.inviter.avatar} alt="" referrerpolicy="no-referrer" />
      {:else}
        <span class="avatar placeholder"><Icon icon="mdi:account" /></span>
      {/if}
      <h1 class="page-title">{invitation.inviter?.name ?? invitation.inviter?.email} wants to be accountability partners</h1>
      {#if invitation.message}
        <blockquote class="message">{invitation.message}</blockquote>
      {/if}
      <p class="lede">You’ll each choose which habits to share. You can stop sharing or remove the partnership any time.</p>
      <div class="actions">
        <button class="btn btn-secondary" onclick={declineInvitation} disabled={actionLoading}>Decline</button>
        <button class="btn" onclick={acceptInvitation} disabled={actionLoading}>{actionLoading ? 'Accepting…' : 'Accept'}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: 56px;
  }

  .centered .page-title {
    font-size: var(--text-lg);
    max-width: 22em;
    margin-bottom: var(--space-3);
  }

  .lede {
    color: var(--text-2);
    max-width: 26em;
    margin-bottom: var(--space-5);
  }

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: var(--space-4);
  }

  .avatar.placeholder {
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 40px;
  }

  .message {
    max-width: 26em;
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-style: italic;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .actions .btn { min-width: 120px; }
</style>
