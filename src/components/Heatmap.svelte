<script lang="ts">
  import type { HeatmapDay } from '../services/analytics';

  // Calendar heatmap: one column per week, one row per weekday, a single-hue
  // ramp of the accent (darker = more habits met). Hover or tap a day for its count.
  let { data, max = 1, unitLabel = 'met' }: { data: HeatmapDay[]; max?: number; unitLabel?: string } = $props();

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  let weeks = $derived.by(() => {
    const groups: (HeatmapDay | null)[][] = [];
    for (const d of data) {
      if (!groups[d.weekOffset]) groups[d.weekOffset] = Array(7).fill(null);
      groups[d.weekOffset][d.dayOfWeek] = d;
    }
    return groups.filter(Boolean);
  });

  let monthLabels = $derived.by(() => {
    const labels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const first = week.find(d => d);
      if (!first) return;
      const month = new Date(first.date + 'T12:00:00').getMonth();
      if (month !== lastMonth) {
        labels.push({ index: i, label: new Date(first.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' }) });
        lastMonth = month;
      }
    });
    return labels;
  });

  function level(value: number): number {
    if (value <= 0) return 0;
    const r = Math.min(value / Math.max(max, 1), 1);
    return r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4;
  }

  let active = $state<HeatmapDay | null>(null);

  function fmt(date: string) {
    return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
</script>

<div class="heatmap">
  <div class="grid-wrap" style="--cols: {weeks.length}">
    <div class="months" aria-hidden="true">
      {#each monthLabels as ml}
        <span style="grid-column: {ml.index + 1}">{ml.label}</span>
      {/each}
    </div>
    <div class="days" aria-hidden="true">
      {#each DAY_LABELS as label, i}
        <span>{i % 2 === 1 ? label : ''}</span>
      {/each}
    </div>
    <div class="cells" role="group" aria-label="Daily activity" onpointerleave={() => active = null}>
      {#each weeks as week, wi}
        {#each week as day, di}
          {#if day}
            <button
              type="button"
              class="cell l{level(day.value)}"
              class:sel={active?.date === day.date}
              style="grid-column: {wi + 1}; grid-row: {di + 1}"
              onpointerenter={() => active = day}
              onclick={() => active = day}
              aria-label="{fmt(day.date)}: {day.value} {unitLabel}"
            ></button>
          {/if}
        {/each}
      {/each}
    </div>
  </div>
  <div class="foot">
    <span class="readout tabular">
      {#if active}{fmt(active.date)} · {active.value} {unitLabel}{:else}Last {weeks.length} weeks{/if}
    </span>
    <span class="legend" aria-hidden="true">
      Less
      {#each [0, 1, 2, 3, 4] as l}<i class="cell l{l}"></i>{/each}
      More
    </span>
  </div>
</div>

<style>
  .heatmap {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .grid-wrap {
    display: grid;
    grid-template-columns: 14px 1fr;
    grid-template-rows: auto auto;
    column-gap: 6px;
    row-gap: 4px;
  }

  .months {
    grid-column: 2;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 3px;
    font-size: 11px;
    color: var(--text-3);
  }

  .months span {
    white-space: nowrap;
  }

  .days {
    grid-column: 1;
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
    font-size: 10px;
    line-height: 1;
    color: var(--text-3);
    align-items: center;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(7, auto);
    gap: 3px;
  }

  .cell {
    display: block;
    aspect-ratio: 1;
    width: 100%;
    border-radius: 3px;
    padding: 0;
  }

  .cell.l0 { background: var(--surface-2); }
  .cell.l1 { background: color-mix(in srgb, var(--accent) 28%, var(--surface)); }
  .cell.l2 { background: color-mix(in srgb, var(--accent) 52%, var(--surface)); }
  .cell.l3 { background: color-mix(in srgb, var(--accent) 76%, var(--surface)); }
  .cell.l4 { background: var(--accent); }

  .cell.sel {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--text);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-2);
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--text-3);
  }

  .legend .cell {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>
