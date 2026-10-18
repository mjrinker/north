<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '../../../../stores/auth';
  import { gql } from '$lib/api';
  import { getLocalDateString, parseLocalDate, toDateStr } from '$lib/dates';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import PartnerHabitCard from '../../../../components/accountability/PartnerHabitCard.svelte';

export const ssr = false;

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let partnerId = $state('');
  page.subscribe(p => { partnerId = p.params.partnerId ?? ''; });

  let partner = $state<any>(null);
  let sharedHabits = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let viewDate = $state(getLocalDateString());

  let loaded = false;

  async function loadData(date: string) {
    if (!loaded) loading = true;
    error = '';
    try {
      const [partnerData, habitsData] = await Promise.all([
        gql<{ accountabilityPartnership: any }>(`query ($partnerId: ID!) { accountabilityPartnership(partnerId: $partnerId) { id partner { id email name avatar } } }`, { partnerId }),
        gql<{ partnerSharedHabits: any[] }>(`query ($partnerId: ID!, $date: String) { partnerSharedHabits(partnerId: $partnerId, date: $date) { habit { id title description standard target type unit schedule metadata } todayEntry { id value standardMet targetMet } standardMet targetMet sharedAt } }`, { partnerId, date })
      ]);
      partner = partnerData?.accountabilityPartnership?.partner ?? null;
      sharedHabits = habitsData?.partnerSharedHabits ?? [];
    } catch (e: any) {
      error = e.message ?? 'Failed to load data';
    }
    loaded = true;
    loading = false;
  }

  $effect(() => { if (partnerId) loadData(viewDate); });

  function shiftDate(days: number) {
    const d = parseLocalDate(viewDate);
    d.setDate(d.getDate() + days);
    viewDate = toDateStr(d);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function goToShare() {
    goto(`/accountability/partner/${partnerId}/share`);
  }
</script>

<div class="page">
  <a class="back" href="/accountability"><Icon icon="mdi:chevron-left" />Partners</a>
  <div class="title-row">
    <h1 class="page-title">{partner?.name ?? partner?.email ?? 'Partner'}</h1>
    <button class="btn btn-sm btn-secondary" onclick={goToShare}>Share habits</button>
  </div>

  {#if loading}
    <p class="empty">Loading…</p>
  {:else if error}
    <p class="empty">{error}</p>
  {:else if !partner}
    <p class="empty">You’re not partners with this person anymore.</p>
  {:else if sharedHabits.length === 0}
    <p class="empty">{partner.name ?? 'Your partner'} hasn’t shared any habits with you yet.</p>
  {:else}
    <div class="date-nav">
      <button class="icon-btn" onclick={() => shiftDate(-1)} aria-label="Previous day"><Icon icon="mdi:chevron-left" /></button>
      <span class="date-display">{formatDate(viewDate)}</span>
      <button class="icon-btn" onclick={() => shiftDate(1)} disabled={viewDate >= getLocalDateString()} aria-label="Next day"><Icon icon="mdi:chevron-right" /></button>
    </div>

    <div class="group list">
      {#each sharedHabits as sh (sh.habit.id)}
        <PartnerHabitCard {sh} />
      {/each}
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

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .title-row .page-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .date-display {
    font-weight: 600;
  }

  .list > :global(* + *) {
    border-top: 0.5px solid var(--separator-strong);
  }
</style>
