<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '../../../../stores/auth';
  import { gql } from '../../../../lib/api';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let invitationId = $state('');
  page.subscribe(p => { invitationId = p.params.invitationId; });

  let invitation = $state<any>(null);
  let loading = $state(true);
  let error = $state('');
  let actionLoading = $state(false);

  async function loadInvitation() {
    loading = true;
    try {
      const data = await gql<{ accountabilityInvitation: any }>(
        `query ($id: ID!) { accountabilityInvitation(id: $id) { id inviter { id email name avatar } inviteeEmail invitee { id email name avatar } status message createdAt expiresAt } }`,
        { id: invitationId }
      );
      invitation = data?.accountabilityInvitation ?? null;
      if (!invitation) error = 'Invitation not found';
      else if (invitation.status !== 'pending') error = 'This invitation has already been ' + invitation.status;
    } catch (e: any) {
      error = e.message ?? 'Failed to load invitation';
    }
    loading = false;
  }

  $effect(() => { loadInvitation(); });

  async function acceptInvitation() {
    if (!currentUser) {
      goto('/settings'); // triggers sign in
      return;
    }
    actionLoading = true;
    try {
      await gql(`mutation ($invitationId: ID!) { acceptAccountabilityInvitation(invitationId: $invitationId) { id } }`, { invitationId });
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
      await gql(`mutation ($invitationId: ID!) { declineAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId });
      goto('/accountability');
    } catch (e: any) {
      alert(e.message ?? 'Failed to decline invitation');
    }
    actionLoading = false;
  }
</script>

<div class="page">
  {#if loading}
    <div class="loading">Loading invitation...</div>
  {:else if error}
    <div class="error-state">
      <Icon icon="mdi:alert-circle-outline" size="64" />
      <h2>Unable to Load Invitation</h2>
      <p>{error}</p>
      <a href="/accountability" class="btn" onclick={() => goto('/accountability')}>Back to Accountability</a>
    </div>
  {:else if invitation}
    <div class="invite-card">
      <div class="invite-header">
        <div class="inviter-info">
          <div class="avatar">
            {#if invitation.inviter?.avatar}
              <img src={invitation.inviter.avatar} alt="" />
            {:else}
              <Icon icon="mdi:account-circle" size="64" />
            {/if}
          </div>
          <div>
            <h1>{invitation.inviter?.name ?? invitation.inviter?.email}</h1>
            <p class="inviter-email">{invitation.inviter?.email}</p>
          </div>
        </div>
        <div class="invite-badge pending">Pending</div>
      </div>

      {#if invitation.message}
        <div class="invite-message">
          <Icon icon="mdi:message-text-outline" />
          <p>{invitation.message}</p>
        </div>
      {/if}

      <div class="invite-details">
        <p>This link was created to invite you as an accountability partner.</p>
        <p>By accepting, you'll be able to see each other's shared habit progress.</p>
      </div>

      {#if !currentUser}
        <div class="auth-prompt">
          <p>You need to be signed in to accept this invitation.</p>
          <button class="btn btn-primary" onclick={() => goto('/settings')}>
            <Icon icon="mdi:login" /> Sign In / Create Account
          </button>
        </div>
      {:else}
        <div class="invite-actions">
          <button class="btn btn-danger" onclick={declineInvitation} disabled={actionLoading}>
            Decline
          </button>
          <button class="btn btn-primary" onclick={acceptInvitation} disabled={actionLoading}>
            {actionLoading ? 'Accepting...' : 'Accept Invitation'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { padding: 2rem 1rem; max-width: 500px; margin: 0 auto; min-height: 60vh; display: flex; align-items: center; justify-content: center; }
  .loading { text-align: center; color: var(--text-secondary, #666); }
  .invite-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    width: 100%;
  }
  .invite-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .inviter-info { display: flex; align-items: center; gap: 1rem; flex: 1; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--btn-secondary-bg, #eee); display: flex; align-items: center; justify-content: center; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar :global(svg) { color: var(--accent, #0066cc); }
  .inviter-info h1 { margin: 0; font-size: 1.2rem; color: var(--text-primary, #222); }
  .inviter-email { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary, #666); }
  .invite-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: #fef3c7;
    color: #92400e;
  }
  .invite-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--btn-secondary-bg, #f5f5f5);
    border-radius: 12px;
    margin-bottom: 1.5rem;
    color: var(--text-secondary, #666);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .invite-message :global(svg) { flex-shrink: 0; margin-top: 0.125rem; }
  .invite-details {
    color: var(--text-secondary, #666);
    font-size: 0.9rem;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
  .invite-details p { margin: 0 0 0.5rem; }
  .auth-prompt {
    text-align: center;
    padding: 1.5rem;
    background: var(--btn-secondary-bg, #f5f5f5);
    border-radius: 12px;
    margin-bottom: 1rem;
  }
  .auth-prompt p { margin: 0 0 1rem; color: var(--text-secondary, #666); }
  .invite-actions {
    display: flex;
    gap: 0.75rem;
  }
  .invite-actions .btn { flex: 1; }
  .error-state {
    text-align: center;
    padding: 2rem;
  }
  .error-state h2 { margin: 1rem 0 0.5rem; color: var(--text-primary, #222); }
  .error-state p { color: var(--text-secondary, #666); margin-bottom: 1.5rem; }
</style>