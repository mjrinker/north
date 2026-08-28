<script lang="ts">
  import { user } from '../../stores/auth';
  import { userHasPermission } from '../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { gql } from '../../lib/api';
  import { userRoles as userRolesStore } from '../../stores/roles';
  import { page } from '$app/stores';
  import Icon from '@iconify/svelte';
  import AccountabilityInviteModal from '../../components/accountability/AccountabilityInviteModal.svelte';
  import AccountabilityPartnershipList from '../../components/accountability/AccountabilityPartnershipList.svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let roles = $state<string[]>([]);
  userRolesStore.subscribe(v => { roles = v; });

  let invitations = $state<any[]>([]);
  let partnerships = $state<any[]>([]);
  let loading = $state(true);
  let showInviteModal = $state(false);
  let invitationTab = $state<'sent' | 'received'>('sent');

  let sentInvitations = $derived(invitations.filter(i => i.inviter_id === currentUser?.id));
  let receivedInvitations = $derived(invitations.filter(i => i.invitee_id === currentUser?.id || i.inviteeEmail === currentUser?.email));
  let uniquePartnerships = $derived.by(() => {
    if (!currentUser?.id) return [];
    return partnerships.filter(p => p.user?.id === currentUser.id);
  });

  async function loadData() {
    loading = true;
    try {
      const [invData, partData] = await Promise.all([
        gql<{ accountabilityInvitations: any[] }>(`query { accountabilityInvitations { id shortCode inviter { id email name avatar } inviteeEmail invitee { id email name avatar } status message createdAt acceptedAt expiresAt } }`),
        gql<{ accountabilityPartnerships: any[] }>(`query { accountabilityPartnerships { id user { id email name avatar } partner { id email name avatar } createdAt } }`)
      ]);
      invitations = invData?.accountabilityInvitations ?? [];
      partnerships = partData?.accountabilityPartnerships ?? [];
    } catch (e) {
      console.error('loadData error:', e);
    }
    loading = false;
  }

  $effect(() => { loadData(); });

  async function cancelInvitation(id: string) {
    await gql(`mutation ($id: ID!) { deleteAccountabilityInvitation(id: $id) }`, { id });
    await loadData();
  }

  async function acceptInvitation(id: string) {
    await gql(`mutation ($invitationId: ID!) { acceptAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId: id });
    await loadData();
  }

  async function declineInvitation(id: string) {
    await gql(`mutation ($invitationId: ID!) { declineAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId: id });
    await loadData();
  }

  function copyInviteLink(invitation: any) {
    const url = `${window.location.origin}/accountability/invite/${invitation.shortCode}`;
    navigator.clipboard.writeText(url);
    alert('Invitation link copied!');
  }

  async function removePartnership(partnerId: string) {
    await gql(`mutation ($partnerId: ID!) { removeAccountabilityPartnership(partnerId: $partnerId) }`, { partnerId });
    await loadData();
  }

  function openInviteModal() {
    showInviteModal = true;
  }

  function closeInviteModal() {
    showInviteModal = false;
  }
</script>

<div class="page">
  <h1>Accountability Partners</h1>
  <p class="subtitle">Share your habit progress with trusted partners</p>

  <div class="actions">
    <button class="btn" onclick={openInviteModal}>
      <Icon icon="mdi:account-plus" /> Invite Partner
    </button>
  </div>

  {#if loading}
    <p class="status">Loading...</p>
  {:else}
    <section class="section">
      <h2>Your Partnerships</h2>
      {#if uniquePartnerships.length === 0}
        <p class="empty">No partnerships yet. Invite someone to get started!</p>
      {:else}
        <AccountabilityPartnershipList 
          partnerships={uniquePartnerships} 
          currentUserId={currentUser?.id}
          onRemove={removePartnership}
        />
      {/if}
    </section>

    <section class="section">
      <h2>Invitations</h2>
      <div class="invitation-tabs">
        <button class:active={invitationTab === 'sent'} onclick={() => invitationTab = 'sent'}>Sent</button>
        <button class:active={invitationTab === 'received'} onclick={() => invitationTab = 'received'}>Received</button>
      </div>
      {#if invitationTab === 'sent'}
        {#if sentInvitations.length === 0}
          <p class="empty">No sent invitations.</p>
        {:else}
          <ul class="invitation-list">
            {#each sentInvitations as inv}
              <li class="invitation-item">
                <div class="inv-info">
                  <span class="inv-email">{inv.inviteeEmail}</span>
                  <span class="inv-status" class:pending={inv.status === 'pending'} class:accepted={inv.status === 'accepted'} class:declined={inv.status === 'declined'}>{inv.status}</span>
                </div>
                <div class="inv-actions">
                  {#if inv.status === 'pending'}
                    <button class="btn-small" onclick={() => copyInviteLink(inv)}>Copy Link</button>
                    <button class="btn-small btn-danger" onclick={() => cancelInvitation(inv.id)}>Cancel</button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#if receivedInvitations.length === 0}
          <p class="empty">No received invitations.</p>
        {:else}
          <ul class="invitation-list">
            {#each receivedInvitations as inv}
              <li class="invitation-item">
                <div class="inv-info">
                  <span class="inv-email">{inv.inviter?.email}</span>
                  <span class="inv-status" class:pending={inv.status === 'pending'} class:accepted={inv.status === 'accepted'} class:declined={inv.status === 'declined'}>{inv.status}</span>
                </div>
                <div class="inv-actions">
                  {#if inv.status === 'pending'}
                    <button class="btn-small" onclick={() => acceptInvitation(inv.id)}>Accept</button>
                    <button class="btn-small btn-secondary" onclick={() => declineInvitation(inv.id)}>Decline</button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </section>
  {/if}
</div>

{#if showInviteModal}
  <AccountabilityInviteModal onClose={closeInviteModal} onInviteSent={loadData} />
{/if}

<style>
  .page { padding: 1.5rem; max-width: 700px; margin: 0 auto; }
  h1 { color: var(--text-primary, #222); margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary, #666); margin-bottom: 1.5rem; }
  .actions { margin-bottom: 1.5rem; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
    background: var(--accent, #0066cc);
    color: white;
  }
  .btn:hover { opacity: 0.9; }
  .section { margin-bottom: 2rem; }
  .section h2 { font-size: 1.1rem; color: var(--text-primary, #222); margin-bottom: 1rem; }
  .empty { color: var(--text-secondary, #888); text-align: center; padding: 2rem; }
  .invitation-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .invitation-tabs button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    background: var(--input-bg, #fff);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .invitation-tabs button.active {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .invitation-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .invitation-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .inv-info { display: flex; flex-direction: column; gap: 0.25rem; }
  .inv-email { font-weight: 500; color: var(--text-primary, #222); }
  .inv-status { font-size: 0.75rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 999px; width: fit-content; }
  .inv-status.pending { background: var(--badge-pending-bg, #fef3c7); color: var(--badge-pending-text, #92400e); }
  .inv-status.accepted { background: var(--badge-accepted-bg, #dcfce7); color: var(--badge-accepted-text, #166534); }
  .inv-status.declined { background: var(--badge-declined-bg, #fee2e2); color: var(--badge-declined-text, #991b1b); }
  .inv-actions { display: flex; gap: 0.5rem; }
  .btn-small {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    border-radius: 4px;
  }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; }
  .btn-secondary { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
</style>