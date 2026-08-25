<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '../../../../stores/auth';
  import { gql } from '$lib/api';
  import { getLocalDateString } from '$lib/dates';
  import { HabitEngine } from '../../../../services/habitEngine';
  import { getEntry } from '../../../../services/storage';
  import { isStandardMet, isTargetMet } from '$lib/thresholds';
  import { pluralizeUnit } from '$lib/units';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import PartnerHabitCard from '../../../../components/accountability/PartnerHabitCard.svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let partnerId = $state('');
  page.subscribe(p => { partnerId = p.params.partnerId; });

  let partner = $state<any>(null);
  let sharedHabits = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let viewDate = $state(getLocalDateString());

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [partnerData, habitsData] = await Promise.all([
        gql<{ usersWithRoles: any[] }>(`query { usersWithRoles { id email name avatar roles } }`),
        gql<{ partnerSharedHabits: any[] }>(`query ($partnerId: ID!) { partnerSharedHabits(partnerId: $partnerId) { habit { id title description standard target type unit schedule metadata } todayEntry { id value standardMet targetMet } standardMet targetMet sharedAt } }`, { partnerId })
      ]);
      const allUsers = partnerData?.usersWithRoles ?? [];
      partner = allUsers.find((u: any) => u.id === partnerId) ?? null;
      sharedHabits = habitsData?.partnerSharedHabits ?? [];
    } catch (e: any) {
      error = e.message ?? 'Failed to load data';
    }
    loading = false;
  }

  $effect(() => { loadData(); });

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function goToShare() {
    goto(`/accountability/partner/${partnerId}/share`);
  }

  async function logForPartner(habitId: string, value: number) {
    // Partners can't log for the partner - this is view-only
  }
</script>

<div class="page">
  <header class="page-header">
    <a href="/accountability" class="back-link" onclick={() => goto('/accountability')}>
      <Icon icon="mdi:chevron-left" />
    </a>
    <div class="header-info">
      <h1>{partner?.name ?? partner?.email ?? 'Partner'}</h1>
      <p class="partner-tag">Viewing shared habits</p>
    </div>
    <button class="btn-share" onclick={goToShare}>
      <Icon icon="mdi:share-variant" /> Manage Sharing
    </button>
  </header>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if !partner}
    <div class="error">Partner not found</div>
  {:else if sharedHabits.length === 0}
    <div class="empty-state">
      <Icon icon="mdi:account-heart" size="64" />
      <h2>No shared habits yet</h2>
      <p>Your partner hasn't shared any habits with you.</p>
    </div>
  {:else}
    <div class="date-nav">
      <button class="date-arrow" onclick={() => viewDate = getLocalDateString(new Date(viewDate).getTime() - 86400000)}>
        <Icon icon="mdi:chevron-left" />
      </button>
      <span class="date-display">{formatDate(viewDate)}</span>
      <button class="date-arrow" onclick={() => viewDate = getLocalDateString(new Date(viewDate).getTime() + 86400000)}>
        <Icon icon="mdi:chevron-right" />
      </button>
    </div>

    <div class="habits-grid">
      {#each sharedHabits as sh}
        <PartnerHabitCard {sh} date={viewDate} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 1rem; max-width: 800px; margin: 0 auto; }
  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--card-border, #e0e0e0);
    margin-bottom: 1rem;
  }
  .back-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-secondary, #666);
    border-radius: 8px;
    cursor: pointer;
  }
  .header-info { flex: 1; }
  .header-info h1 { margin: 0; font-size: 1.25rem; }
  .partner-tag { font-size: 0.8rem; color: var(--accent, #0066cc); font-weight: 500; }
  .btn-share {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-share:hover { background: var(--btn-secondary-bg, #f5f5f5); }
  .date-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--card-border, #e0e0e0);
    margin-bottom: 1rem;
  }
  .date-arrow {
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
  }
  .date-arrow:hover { background: var(--accent, #0066cc); color: white; }
  .date-display { font-weight: 600; color: var(--text-primary, #222); }
  .habits-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .loading, .error { text-align: center; padding: 2rem; color: var(--text-secondary, #888); }
  .error { color: #dc2626; }
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary, #888);
  }
  .empty-state h2 { margin: 1rem 0 0.5rem; color: var(--text-primary, #222); }
</style>