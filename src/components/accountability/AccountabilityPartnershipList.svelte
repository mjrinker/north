<script lang="ts">
  import { goto } from '$app/navigation';
  import { gql } from '$lib/api';
  import Icon from '@iconify/svelte';

  let { partnerships, currentUserId, onRemove }: { partnerships: any[]; currentUserId: string; onRemove: (partnerId: string) => void } = $props();

  function getPartner(partnership: any) {
    return partnership.partner;
  }

  function getMyPartnershipId(partnership: any) {
    return partnership.id;
  }

  async function viewPartner(partnerId: string) {
    goto(`/accountability/partner/${partnerId}`);
  }

  async function manageSharing(partnerId: string) {
    goto(`/accountability/partner/${partnerId}/share`);
  }
</script>

<div class="group">
  {#each partnerships as p}
    {@const partner = getPartner(p)}
    <div class="row partner">
      <button class="partner-main" onclick={() => viewPartner(partner.id)}>
        {#if partner.avatar}
          <img class="avatar" src={partner.avatar} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="avatar placeholder"><Icon icon="mdi:account" /></span>
        {/if}
        <span class="row-label">
          <span class="partner-name">{partner.name ?? partner.email}</span>
          {#if partner.name}<span class="partner-email">{partner.email}</span>{/if}
        </span>
      </button>
      <button class="btn btn-sm btn-secondary" onclick={() => manageSharing(partner.id)}>Share habits</button>
      <button class="icon-btn" onclick={() => onRemove(partner.id)} aria-label="Remove {partner.name ?? partner.email}"><Icon icon="mdi:account-remove-outline" /></button>
    </div>
  {/each}
</div>

<style>
  .partner-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 52px;
    text-align: left;
  }

  .avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar.placeholder {
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 20px;
  }

  .row-label {
    display: flex;
    flex-direction: column;
  }

  .partner-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .partner-email {
    font-size: var(--text-sm);
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn {
    color: var(--text-3);
    font-size: 20px;
  }
</style>
