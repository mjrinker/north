<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '../../../../../stores/auth';
  import { gql } from '$lib/api';
  import { goto } from '$app/navigation';
  import { habitColorVars } from '$lib/color';
  import Icon from '@iconify/svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let partnerId = $state('');
  page.subscribe(p => { partnerId = p.params.partnerId ?? ''; });

  let partner = $state<any>(null);
  let allHabits = $state<any[]>([]);
  let partnershipId = $state('');
  let sharedHabitIds = $state<string[]>([]);
  let savedHabitIds: string[] = [];
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [partnerData, habitsData] = await Promise.all([
        gql<{ accountabilityPartnership: any }>(`query ($partnerId: ID!) { accountabilityPartnership(partnerId: $partnerId) { id partner { id email name avatar } } }`, { partnerId }),
        gql<{ habits: any[] }>(`query { habits { id title description standard target type unit schedule metadata status } }`),
      ]);
      const partnership = partnerData?.accountabilityPartnership ?? null;
      partner = partnership?.partner ?? null;
      partnershipId = partnership?.id ?? '';
      allHabits = (habitsData?.habits ?? []).filter((h: any) => h.status !== 'deleted');
      if (partnershipId) {
        const sharedData = await gql<{ sharedHabits: any[] }>(`query ($partnershipId: ID!) { sharedHabits(partnershipId: $partnershipId) { habit { id } } }`, { partnershipId });
        sharedHabitIds = (sharedData?.sharedHabits ?? []).map((sh: any) => sh.habit?.id).filter(Boolean);
      } else {
        sharedHabitIds = [];
      }
      savedHabitIds = [...sharedHabitIds];
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
    if (!partnershipId) return;
    saving = true;
    try {
      const added = sharedHabitIds.filter(id => !savedHabitIds.includes(id));
      const removed = savedHabitIds.filter(id => !sharedHabitIds.includes(id));
      if (added.length) {
        await gql(
          `mutation ($partnershipId: ID!, $habitIds: [ID!]!) { shareHabitsWithPartner(partnershipId: $partnershipId, habitIds: $habitIds) { id } }`,
          { partnershipId, habitIds: added }
        );
      }
      if (removed.length) {
        await gql(
          `mutation ($partnershipId: ID!, $habitIds: [ID!]!) { unshareHabitsWithPartner(partnershipId: $partnershipId, habitIds: $habitIds) }`,
          { partnershipId, habitIds: removed }
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
  <a class="back" href="/accountability/partner/{partnerId}"><Icon icon="mdi:chevron-left" />{partner?.name ?? 'Partner'}</a>
  <h1 class="page-title">Share habits</h1>
  {#if partner}<p class="intro">{partner.name ?? partner.email} will see your progress on the habits you pick.</p>{/if}

  {#if loading}
    <p class="empty">Loading…</p>
  {:else if error}
    <p class="empty">{error}</p>
  {:else if !partner}
    <p class="empty">You’re not partners with this person anymore.</p>
  {:else}
    <div class="group">
      {#each allHabits as habit (habit.id)}
        <label class="row habit-row" style={habitColorVars(habit.metadata?.color)}>
          <span class="glyph" aria-hidden="true">
            {#if habit.metadata?.emoji}{habit.metadata.emoji}{:else if habit.metadata?.icon}<Icon icon={habit.metadata.icon} />{:else}{habit.title.slice(0, 1)}{/if}
          </span>
          <span class="row-label">{habit.title}</span>
          <input type="checkbox" class="switch" checked={sharedHabitIds.includes(habit.id)} onchange={() => toggleHabit(habit.id)} />
        </label>
      {/each}
    </div>

    <div class="save-bar">
      <button class="btn btn-secondary" onclick={() => goto(`/accountability/partner/${partnerId}`)}>Cancel</button>
      <button class="btn" onclick={saveSharing} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .page-title { margin-bottom: var(--space-2); }

  .intro {
    color: var(--text-2);
    margin-bottom: var(--space-4);
  }

  .habit-row { cursor: pointer; min-height: 52px; }

  .glyph {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--habit) 14%, transparent);
    color: var(--habit-ink);
    font-size: 16px;
    font-weight: 600;
  }

  .save-bar {
    position: sticky;
    bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--space-2));
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .save-bar .btn { min-width: 110px; }
</style>
