<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '../../../../../stores/auth';
  import { gql } from '$lib/api';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { getAllRoleNames } from '../../../../../types/auth';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let partnerId = $state('');
  page.subscribe(p => { partnerId = p.params.partnerId; });

  let partner = $state<any>(null);
  let allHabits = $state<any[]>([]);
  let sharedHabitIds = $state<string[]>([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [partnerData, habitsData, sharedData] = await Promise.all([
        gql<{ usersWithRoles: any[] }>(`query { usersWithRoles { id email name avatar roles } }`),
        gql<{ habits: any[] }>(`query { habits { id title description standard target type unit schedule metadata } }`),
        gql<{ partnerSharedHabits: any[] }>(`query ($partnerId: ID!) { partnerSharedHabits(partnerId: $partnerId) { habit { id } sharedAt } }`, { partnerId })
      ]);
      const allUsers = partnerData?.usersWithRoles ?? [];
      partner = allUsers.find((u: any) => u.id === partnerId) ?? null;
      allHabits = habitsData?.habits ?? [];
      sharedHabitIds = (sharedData?.partnerSharedHabits ?? []).map((sh: any) => sh.habit?.id).filter(Boolean);
    } catch (e: any) {
      error = e.message ?? 'Failed to load data';
    }
    loading = false;
  }

  $effect(() => { loadData(); });

  function toggleHabit(habitId: string) {
    if (sharedHabitIds.includes(habitId)) {
      sharedHabitIds = sharedHabitIds.filter(id => id !== habitId);
    } else {
      sharedHabitIds = [...sharedHabitIds, habitId];
    }
  }

  async function saveSharing() {
    if (!partnerId) return;
    saving = true;
    try {
      // First get the partnership ID
      const partData = await gql<{ accountabilityPartnerships: any[] }>(`query { accountabilityPartnerships { id user_id partner_id } }`);
      const partnership = partData?.accountabilityPartnerships?.find((p: any) => 
        (p.user_id === currentUser?.id && p.partner_id === partnerId) ||
        (p.user_id === partnerId && p.partner_id === currentUser?.id)
      );
      
      if (partnership) {
        await gql(
          `mutation ($partnershipId: ID!, $habitIds: [ID!]!) { shareHabitsWithPartner(partnershipId: $partnershipId, habitIds: $habitIds) }`,
          { partnershipId: partnership.id, habitIds: sharedHabitIds }
        );
      }
      await loadData();
    } catch (e: any) {
      error = e.message ?? 'Failed to save sharing';
    }
    saving = false;
  }
</script>

<div class="page">
  <header class="page-header">
    <a href="/accountability/partner/{partnerId}" class="back-link" onclick={() => goto(`/accountability/partner/${partnerId}`)}>
      <Icon icon="mdi:chevron-left" />
    </a>
    <div class="header-info">
      <h1>Share Habits with {partner?.name ?? partner?.email ?? 'Partner'}</h1>
      <p class="partner-tag">Select which habits to share</p>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if !partner}
    <div class="error">Partner not found</div>
  {:else}
    <div class="habits-list">
      {#each allHabits as habit}
        <label class="habit-share-item" class:shared={sharedHabitIds.includes(habit.id)}>
          <div class="habit-share-info">
            {#if habit.metadata?.emoji}
              <span class="habit-emoji">{habit.metadata.emoji}</span>
            {:else if habit.metadata?.icon}
              <Icon icon={habit.metadata.icon} class="habit-icon" />
            {/if}
            <div class="habit-share-text">
              <span class="habit-share-title">{habit.title}</span>
              <span class="habit-share-type">{habit.type} · {habit.schedule.frequency}</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={sharedHabitIds.includes(habit.id)}
            onchange={() => toggleHabit(habit.id)}
          />
        </label>
      {/each}
    </div>

    <div class="save-bar">
      <button class="btn btn-secondary" onclick={() => goto(`/accountability/partner/${partnerId}`)}>Cancel</button>
      <button class="btn" onclick={saveSharing} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
    </div>
  {/if}
</div>

<style>
  .page { padding: 1rem; max-width: 600px; margin: 0 auto; }
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
  .header-info h1 { margin: 0; font-size: 1.1rem; }
  .partner-tag { font-size: 0.85rem; color: var(--text-secondary, #666); }
  .habits-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .habit-share-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .habit-share-item:hover { background: var(--btn-secondary-bg, #f5f5f5); }
  .habit-share-item.shared {
    border-color: var(--accent, #0066cc);
    background: rgba(0, 102, 204, 0.05);
  }
  .habit-share-info { display: flex; align-items: center; gap: 0.75rem; }
  .habit-emoji { font-size: 1.5rem; }
  .habit-icon { font-size: 1.5rem; color: var(--accent, #0066cc); }
  .habit-share-text { display: flex; flex-direction: column; gap: 2px; }
  .habit-share-title { font-weight: 500; color: var(--text-primary, #222); }
  .habit-share-type { font-size: 0.75rem; color: var(--text-secondary, #666); }
  .habit-share-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--accent, #0066cc);
    cursor: pointer;
  }
  .save-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 0;
    border-top: 1px solid var(--card-border, #e0e0e0);
    background: var(--page-bg, #fff);
  }
  .btn {
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-secondary:hover:not(:disabled) { background: var(--btn-secondary-hover, #ddd); }
</style>