<script lang="ts">
  console.log('[stats] script start');
  import { habitsStore } from '../../stores/habits';
  import { entriesStore } from '../../stores/entries';
  import type { Habit, HabitEntry } from '../../types';
  import { computeHabitStats, computeGlobalStats, getLastNDays, buildHeatmapData, type HabitStats } from '../../services/analytics';
  import StatCard from '../../components/StatCard.svelte';
  import Heatmap from '../../components/Heatmap.svelte';

  let habits = $state<Habit[]>([]);
  let entries = $state<HabitEntry[]>([]);
  habitsStore.subscribe(v => { habits = v; console.log('[stats] habits loaded:', v.length); });
  entriesStore.subscribe(v => { entries = v; console.log('[stats] entries loaded:', v.length); });
  console.log('[stats] script body done');

  let selectedHabitId = $state<string>('all');

  let days = $derived(getLastNDays(91));

  let globalStats = $derived(computeGlobalStats(habits, entries));
  let habitStatsList = $derived(habits.map(h => computeHabitStats(h, entries)));

  let selectedHabitStats = $derived<HabitStats | undefined>(
    selectedHabitId === 'all' ? undefined : habitStatsList.find(s => s.habit.id === selectedHabitId)
  );

  let heatmapData = $derived(
    selectedHabitId === 'all'
      ? buildHeatmapData(entries, days)
      : buildHeatmapData(entries, days, selectedHabitId)
  );

  function formatPct(v: number): string {
    return (v * 100).toFixed(1) + '%';
  }
</script>

<div class="stats-page">
  <h1>Statistics</h1>

  <!-- Global stats -->
  <div class="stat-row">
    <StatCard label="Completion Rate" value={formatPct(globalStats.averageCompletionRate)} />
    <StatCard label="Total Completions" value={globalStats.totalCompletions} />
    <StatCard
      label="Strongest"
      value={globalStats.strongestHabit?.title ?? '-'}
      sub={globalStats.strongestHabit ? formatPct(globalStats.strongestHabit.rate) : ''}
    />
    <StatCard
      label="Weakest"
      value={globalStats.weakestHabit?.title ?? '-'}
      sub={globalStats.weakestHabit ? formatPct(globalStats.weakestHabit.rate) : ''}
    />
  </div>

  <!-- Heatmap section -->
  <div class="section">
    <div class="section-header">
      <h2>Activity</h2>
      <select bind:value={selectedHabitId}>
        <option value="all">All Habits</option>
        {#each habits as habit (habit.id)}
          <option value={habit.id}>{habit.title}</option>
        {/each}
      </select>
    </div>
    {#if days.length > 0}
      <Heatmap data={heatmapData} {days} />
    {/if}
  </div>

  <!-- Per-habit stats -->
  <div class="section">
    <h2>Habit Breakdown</h2>
    {#each habitStatsList as stats (stats.habit.id)}
      <div class="habit-row">
        <h3>{stats.habit.title}</h3>
        <div class="habit-stats">
          <StatCard label="Rate" value={formatPct(stats.completionRate)} sub="{stats.standardMetCount}/{stats.totalEntries}" />
          <StatCard label="Current Streak" value={stats.currentStreak} sub="days" />
          <StatCard label="Longest Streak" value={stats.longestStreak} sub="days" />
          <StatCard label="Best Day" value={stats.bestDay?.value ?? '-'} sub={stats.bestDay?.date ?? ''} />
        </div>
      </div>
    {/each}
    {#if habits.length === 0}
      <p class="empty">No habits yet. <a href="/history">Create one</a> to see stats.</p>
    {/if}
  </div>
</div>

<style>
  .stats-page {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 1rem;
    color: var(--text-primary, #222);
  }
  h2 {
    margin: 0;
    color: var(--text-primary, #222);
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .section {
    margin-bottom: 2rem;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  .section-header select {
    margin-left: auto;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--card-bg, #fff);
    color: var(--text-primary, #222);
  }
  .habit-row {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  .habit-row h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--text-primary, #222);
  }
  .habit-stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.5rem;
  }
  .empty {
    color: var(--text-secondary, #888);
  }
</style>
