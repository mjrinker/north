<script lang="ts">
  import { habitsStore } from '../../stores/habits';
  import { entriesStore } from '../../stores/entries';
  import type { Habit, HabitEntry } from '../../types';
  import { computeHabitStats, computeGlobalStats, getLastNDays, buildHeatmapData, rangeDays, bucketDaily, type StatsRange, type RateBucket } from '../../services/analytics';
  import Heatmap from '../../components/Heatmap.svelte';
  import Icon from '@iconify/svelte';
  import { habitColorVars } from '../../lib/color';

  let allHabits = $state<Habit[]>([]);
  let allEntries = $state<HabitEntry[]>([]);
  habitsStore.subscribe(v => allHabits = v);
  entriesStore.subscribe(v => allEntries = v);

  // Archived and deleted habits don't count towards stats.
  let habits = $derived(allHabits.filter(h => h.status === 'active' || h.status === 'paused'));
  let habitIds = $derived(new Set(habits.map(h => h.id)));
  let entries = $derived(allEntries.filter(e => habitIds.has(e.habitId)));

  let selectedHabitId = $state<string>('all');

  const RANGES: { value: StatsRange; short: string; label: string }[] = [
    { value: 7, short: '7D', label: 'Last 7 days' },
    { value: 30, short: '30D', label: 'Last 30 days' },
    { value: 90, short: '90D', label: 'Last 90 days' },
    { value: 365, short: '1Y', label: 'Last 12 months' },
    { value: null, short: 'All', label: 'All time' },
  ];

  // Remembered per device; falls back to 30 days.
  let range = $state<StatsRange>((() => {
    try {
      const saved = localStorage.getItem('statsRange');
      if (saved === 'all') return null;
      const n = Number(saved);
      if (RANGES.some(r => r.value === n)) return n as StatsRange;
    } catch {}
    return 30;
  })());

  $effect(() => {
    try { localStorage.setItem('statsRange', range == null ? 'all' : String(range)); } catch {}
  });

  let rangeLabel = $derived(RANGES.find(r => r.value === range)!.label);
  let rangeWindow = $derived(rangeDays(habits, entries, range));

  let days = $derived(getLastNDays(7 * 15));
  let globalStats = $derived(computeGlobalStats(habits, entries, rangeWindow));
  let habitStatsList = $derived(habits.map(h => computeHabitStats(h, entries, rangeWindow)).sort((a, b) => b.completionRate - a.completionRate));

  // Up to ~5 weeks shows a bar per day; up to ~6 months, per week; longer, per month.
  let bucketSize = $derived<'day' | 'week' | 'month'>(rangeWindow.length <= 35 ? 'day' : rangeWindow.length <= 190 ? 'week' : 'month');
  let bars = $derived(bucketDaily(globalStats.daily, bucketSize));

  let heatmapData = $derived(buildHeatmapData(entries, days, selectedHabitId === 'all' ? undefined : selectedHabitId));
  let heatmapMax = $derived(selectedHabitId === 'all' ? Math.max(habits.length, 1) : 1);

  function pct(v: number): string {
    return Math.round(v * 100) + '%';
  }

  function fmtDay(date: string) {
    return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  let activeBar = $state<RateBucket | null>(null);

  function fmtBucket(b: RateBucket): string {
    if (bucketSize === 'day') return fmtDay(b.start);
    if (bucketSize === 'month') {
      const d = new Date(b.start + 'T12:00:00');
      return d.toLocaleDateString(undefined, { month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    }
    return `${fmtDay(b.start)} – ${fmtDay(b.end)}`;
  }

  let currentBucketLabel = $derived(bucketSize === 'day' ? 'Today' : bucketSize === 'week' ? 'This week' : 'This month');

  function streakUnit(h: Habit, n: number) {
    const unit = h.schedule.daysPerWeek ? 'week' : 'day';
    return `${n} ${unit}${n === 1 ? '' : 's'}`;
  }
</script>

<div class="page stats">
  <h1 class="page-title">Stats</h1>

  {#if habits.length > 0}
    <div class="segmented range" role="radiogroup" aria-label="Time range">
      {#each RANGES as r (r.short)}
        <button role="radio" aria-checked={range === r.value} aria-label={r.label} class:active={range === r.value} onclick={() => { range = r.value; activeBar = null; }}>{r.short}</button>
      {/each}
    </div>
  {/if}

  {#if habits.length === 0}
    <div class="empty">
      <p>Stats show up once you’ve added a habit and logged a few days.</p>
      <a class="btn" href="/today">Go to Today</a>
    </div>
  {:else}
    <section class="group hero">
      <div class="hero-label">{rangeLabel}</div>
      <div class="hero-row">
        <span class="hero-num tabular">{pct(globalStats.averageCompletionRate)}</span>
        <span class="hero-caption">
          {#if activeBar}
            <strong>{fmtBucket(activeBar)}</strong> · {activeBar.total ? Math.round((activeBar.met / activeBar.total) * 100) : 0}%{#if bucketSize === 'day'} ({activeBar.met} of {activeBar.total}){/if}
          {:else}
            of habits done, {bucketSize === 'day' ? 'day by day' : bucketSize === 'week' ? 'week by week' : 'month by month'}
          {/if}
        </span>
      </div>
      <div class="bars" style="--n: {bars.length}" role="img" aria-label="Share of habits done per {bucketSize}, {rangeLabel.toLowerCase()}" onpointerleave={() => activeBar = null}>
        {#each bars as b (b.start)}
          {@const r = b.total ? b.met / b.total : 0}
          <button
            type="button"
            class="bar-hit"
            class:active={activeBar?.start === b.start}
            onpointerenter={() => activeBar = b}
            onclick={() => activeBar = b}
            aria-label="{fmtBucket(b)}: {Math.round(r * 100)}%"
          >
            <span class="bar" style="height: {Math.max(r * 100, r > 0 ? 4 : 0)}%"></span>
          </button>
        {/each}
      </div>
      <div class="bars-axis">
        <span>{bars[0] ? fmtBucket(bars[0]).split(' – ')[0] : ''}</span>
        <span>{currentBucketLabel}</span>
      </div>
    </section>

    {#if habits.length > 1 && globalStats.strongestHabit && globalStats.weakestHabit}
      <div class="group facts">
        <div class="row">
          <span class="row-label">Most consistent</span>
          <span class="fact-value">{globalStats.strongestHabit.title}</span>
          <span class="fact-pct tabular">{pct(globalStats.strongestHabit.rate)}</span>
        </div>
        <div class="row">
          <span class="row-label">Needs attention</span>
          <span class="fact-value">{globalStats.weakestHabit.title}</span>
          <span class="fact-pct tabular">{pct(globalStats.weakestHabit.rate)}</span>
        </div>
      </div>
    {/if}

    <div class="section-head">
      <h2 class="section-label">Activity</h2>
      <select class="input inline-select" bind:value={selectedHabitId} aria-label="Habit">
        <option value="all">All habits</option>
        {#each habits as habit (habit.id)}
          <option value={habit.id}>{habit.title}</option>
        {/each}
      </select>
    </div>
    <section class="group heat">
      <Heatmap data={heatmapData} max={heatmapMax} unitLabel={selectedHabitId === 'all' ? 'habits done' : 'done'} />
    </section>

    <h2 class="section-label">By habit</h2>
    <div class="group">
      {#each habitStatsList as stats (stats.habit.id)}
        {@const h = stats.habit}
        <div class="row habit" style={habitColorVars(h.metadata?.color)}>
          <span class="glyph" aria-hidden="true">
            {#if h.metadata?.emoji}{h.metadata.emoji}{:else if h.metadata?.icon}<Icon icon={h.metadata.icon} />{:else}{h.title.slice(0, 1)}{/if}
          </span>
          <div class="row-label">
            <div class="habit-title">{h.title}</div>
            <div class="habit-sub">
              {#if stats.currentStreak > 0}Streak {streakUnit(h, stats.currentStreak)}{:else}No current streak{/if}
              {#if stats.longestStreak > 0} · best {streakUnit(h, stats.longestStreak)}{/if}
            </div>
          </div>
          <div class="rate">
            <span class="rate-num tabular">{pct(stats.completionRate)}</span>
            <span class="rate-track"><span class="rate-fill" style="width: {stats.completionRate * 100}%"></span></span>
          </div>
        </div>
      {/each}
    </div>
    <p class="section-footnote">Rates cover {rangeLabel.toLowerCase()}, counted from when each habit started. Streaks always use your full history. Habits you’re breaking count a day as done unless you went over the limit.</p>
  {/if}
</div>

<style>
  .hero {
    padding: var(--space-4);
  }

  .hero-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  .hero-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: 2px 0 var(--space-4);
  }

  .hero-num {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .hero-caption {
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .hero-caption strong {
    color: var(--text);
    font-weight: 600;
  }

  /* 30 thin bars, rounded tops, 2px gaps, anchored to a baseline */
  .range {
    margin-bottom: var(--space-4);
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    height: 88px;
    border-bottom: 1px solid var(--separator-strong);
  }

  .bar-hit {
    display: flex;
    align-items: flex-end;
    height: 100%;
    padding: 0 1px;
  }

  .bar {
    display: block;
    width: 100%;
    border-radius: 3px 3px 0 0;
    background: var(--accent);
    opacity: 0.9;
    transition: opacity 0.15s;
  }

  .bars:hover .bar,
  .bars:has(.active) .bar {
    opacity: 0.35;
  }

  .bar-hit.active .bar,
  .bars:hover .bar-hit:hover .bar {
    opacity: 1;
  }

  .bars-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: var(--text-xs);
    color: var(--text-3);
  }

  .facts {
    margin-top: var(--space-3);
  }

  .facts .row-label {
    flex: 0 0 auto;
    color: var(--text-2);
  }

  .fact-value {
    flex: 1;
    min-width: 0;
    text-align: right;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fact-pct {
    width: 3em;
    text-align: right;
    color: var(--text-2);
  }

  .section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin: var(--space-5) 0 var(--space-2);
  }

  .section-head .section-label {
    margin: 0;
  }

  .inline-select {
    width: auto;
    max-width: 55%;
    min-height: 32px;
    padding: 4px 32px 4px var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--surface);
    font-size: var(--text-sm);
    background-position: right 12px center;
  }

  .heat {
    padding: var(--space-4);
  }

  .habit {
    min-height: 60px;
  }

  .glyph {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--habit) 14%, transparent);
    color: var(--habit-ink);
    font-size: 17px;
    font-weight: 600;
  }

  .habit-title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .habit-sub {
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .rate {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    width: 56px;
  }

  .rate-num {
    font-weight: 600;
  }

  .rate-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .rate-fill {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--habit-ink);
  }

  .empty .btn {
    margin-top: var(--space-4);
  }
</style>
