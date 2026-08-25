<script lang="ts">
  import { goto } from '$app/navigation';
  import { gql } from '$lib/api';
  import Icon from '@iconify/svelte';

  let { partnerships, currentUserId, onRemove }: { partnerships: any[]; currentUserId: string; onRemove: (partnerId: string) => void } = $props();

  function getPartner(partnership: any) {
    return partnership.user_id === currentUserId ? partnership.partner : partnership.user;
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

<ul class="partnership-list">
  {#each partnerships as p}
    <li class="partnership-item">
      <div class="partner-info">
        <div class="partner-avatar">
          {#if getPartner(p).avatar}
            <img src={getPartner(p).avatar} alt="" />
          {:else}
            <Icon icon="mdi:account-circle" size="40" />
          {/if}
        </div>
        <div class="partner-details">
          <span class="partner-name">{getPartner(p).name ?? getPartner(p).email}</span>
          <span class="partner-email">{getPartner(p).email}</span>
        </div>
      </div>
      <div class="partner-actions">
        <button class="btn-icon" onclick={() => viewPartner(getPartner(p).id)} aria-label="View progress">
          <Icon icon="mdi:eye" size="20" />
        </button>
        <button class="btn-icon" onclick={() => manageSharing(getPartner(p).id)} aria-label="Manage sharing">
          <Icon icon="mdi:share-variant" size="20" />
        </button>
        <button class="btn-icon btn-danger" onclick={() => onRemove(getPartner(p).id)} aria-label="Remove partnership">
          <Icon icon="mdi:account-minus" size="20" />
        </button>
      </div>
    </li>
  {/each}
</ul>

<style>
  .partnership-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .partnership-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .partner-info { display: flex; align-items: center; gap: 0.75rem; }
  .partner-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
  .partner-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .partner-avatar :global(svg) { color: var(--text-secondary, #888); }
  .partner-details { display: flex; flex-direction: column; gap: 2px; }
  .partner-name { font-weight: 500; color: var(--text-primary, #222); }
  .partner-email { font-size: 0.75rem; color: var(--text-secondary, #888); }
  .partner-actions { display: flex; gap: 0.5rem; }
  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-secondary, #666);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .btn-icon:hover { background: var(--accent, #0066cc); color: white; }
  .btn-icon.btn-danger:hover { background: #fee2e2; color: #dc2626; }
</style>