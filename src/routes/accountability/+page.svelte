<script lang="ts">
  import { user } from '../../stores/auth';
  import { userHasPermission } from '../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { gql } from '../../lib/api';
  import { decodeId } from '../../lib/globalId';
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

  let sentInvitations = $derived(invitations.filter(i => decodeId(i.inviter?.id) === currentUser?.id));
  let receivedInvitations = $derived(invitations.filter(i => decodeId(i.inviter?.id) !== currentUser?.id));
  let uniquePartnerships = $derived(partnerships);

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
    await gql(`mutation ($invitationId: ID!) { cancelAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId: id });
    await loadData();
  }

  async function acceptInvitation(id: string) {
    await gql(`mutation ($invitationId: ID!) { acceptAccountabilityInvitation(invitationId: $invitationId) { id } }`, { invitationId: id });
    await loadData();
  }

  async function declineInvitation(id: string) {
    await gql(`mutation ($invitationId: ID!) { declineAccountabilityInvitation(invitationId: $invitationId) }`, { invitationId: id });
    await loadData();
  }

  let copiedId = $state<string | null>(null);

  async function copyInviteLink(invitation: any) {
    const url = `${window.location.origin}/accountability/invite/${invitation.shortCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Be my accountability partner on North', url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    copiedId = invitation.id;
    setTimeout(() => { if (copiedId === invitation.id) copiedId = null; }, 2000);
  }

  const STATUS_TONE: Record<string, string> = { pending: 'warning', accepted: 'success', declined: 'danger', expired: '' };

  async function removePartnership(partnerId: string) {
    if (!confirm('Remove this partner? You’ll both stop seeing each other’s shared habits.')) return;
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
  <a class="back" href="/settings"><Icon icon="mdi:chevron-left" />Settings</a>
  <div class="title-row">
    <h1 class="page-title">Partners</h1>
    <button class="btn btn-sm" onclick={openInviteModal}><Icon icon="mdi:plus" />Invite</button>
  </div>
  <p class="intro">Share chosen habits with someone you trust, and see theirs.</p>

  {#if loading}
    <p class="empty">Loading…</p>
  {:else}
    <h2 class="section-label">Your partners</h2>
    {#if uniquePartnerships.length === 0}
      <div class="group empty-group">
        <p>No partners yet. Invite someone with a link.</p>
      </div>
    {:else}
      <AccountabilityPartnershipList
        partnerships={uniquePartnerships}
        currentUserId={currentUser?.id}
        onRemove={removePartnership}
      />
    {/if}

    <div class="section-head">
      <h2 class="section-label">Invitations</h2>
      <div class="segmented small">
        <button class:active={invitationTab === 'sent'} onclick={() => invitationTab = 'sent'}>Sent</button>
        <button class:active={invitationTab === 'received'} onclick={() => invitationTab = 'received'}>Received</button>
      </div>
    </div>
    {@const list = invitationTab === 'sent' ? sentInvitations : receivedInvitations}
    {#if list.length === 0}
      <div class="group empty-group"><p>No {invitationTab} invitations.</p></div>
    {:else}
      <div class="group">
        {#each list as inv (inv.id)}
          <div class="row inv">
            <div class="row-label">
              <div class="inv-who">
                {#if invitationTab === 'sent'}
                  {inv.invitee?.name ?? inv.invitee?.email ?? inv.inviteeEmail ?? 'Invite link'}
                {:else}
                  {inv.inviter?.name ?? inv.inviter?.email}
                {/if}
              </div>
              <div class="inv-meta"><span class="pill {STATUS_TONE[inv.status] ?? ''}">{inv.status}</span></div>
            </div>
            {#if inv.status === 'pending'}
              {#if invitationTab === 'sent'}
                <button class="btn btn-sm btn-secondary" onclick={() => copyInviteLink(inv)}>{copiedId === inv.id ? 'Copied' : 'Share link'}</button>
                <button class="icon-btn" onclick={() => cancelInvitation(inv.id)} aria-label="Cancel invitation"><Icon icon="mdi:close" /></button>
              {:else}
                <button class="btn btn-sm btn-secondary" onclick={() => declineInvitation(inv.id)}>Decline</button>
                <button class="btn btn-sm" onclick={() => acceptInvitation(inv.id)}>Accept</button>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#if showInviteModal}
  <AccountabilityInviteModal onClose={closeInviteModal} onInviteSent={loadData} />
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title-row .page-title { margin-bottom: var(--space-1); }

  .intro {
    color: var(--text-2);
    margin-bottom: var(--space-2);
  }

  .section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin: var(--space-5) 0 var(--space-2);
  }

  .section-head .section-label { margin: 0; }

  .segmented.small > button {
    min-height: 28px;
    font-size: var(--text-xs);
  }

  .empty-group {
    padding: var(--space-4);
    color: var(--text-2);
    font-size: var(--text-sm);
  }

  .inv-who {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inv-meta { margin-top: 2px; }

  .pill { text-transform: capitalize; }

  .icon-btn { color: var(--text-3); font-size: 20px; }
</style>
