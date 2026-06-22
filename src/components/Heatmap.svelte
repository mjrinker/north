<script lang="ts">
  import type { HeatmapDay } from '../services/analytics';

  let { data, days }: { data: HeatmapDay[]; days: string[] } = $props();

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let maxValue = $derived(Math.max(...data.map(d => d.value), 1));

  let weeks = $derived<HeatmapDay[][]>(() => {
    const groups: HeatmapDay[][] = [];
    let current: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = data.find(d => d.dayOfWeek === i && d.weekOffset === 0);
      if (!day) current.push({ date: '', dayOfWeek: i, weekOffset: 0, value: 0 });
      else current.push(day);
    }
    groups.push(current);
    for (const d of data) {
      if (d.weekOffset === 0) continue;
      if (!groups[d.weekOffset]) groups[d.weekOffset] = [];
      groups[d.weekOffset][d.dayOfWeek] = d;
    }
    return groups;
  });

  function color(value: number): string {
    if (value === 0) return 'var(--heatmap-empty, #ebedf0)';
    const intensity = Math.min(value / maxValue, 1);
    if (intensity < 0.25) return 'var(--heatmap-low, #9be9a8)';
    if (intensity < 0.5) return 'var(--heatmap-mid, #40c463)';
    if (intensity < 0.75) return 'var(--heatmap-high, #30a14e)';
    return 'var(--heatmap-max, #216e39)';
  }

  let firstDate = $derived(days[0] || '');
  let monthLabels = $derived(() => {
    const labels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < weeks.length; i++) {
      const day = weeks[i]?.find(d => d.date);
      if (!day) continue;
      const month = new Date(day.date + 'T00:00:00').getMonth();
      if (month !== lastMonth) {
        labels.push({ index: i, label: MONTH_LABELS[month] });
        lastMonth = month;
      }
    }
    return labels;
  });
</script>

<div class="heatmap">
  <div class="heatmap-months">
    <span class="spacer"></span>
    {#each monthLabels as ml}
      <span style="grid-column: {ml.index + 2}; font-size: 0.7rem; color: var(--text-secondary, #666);">{ml.label}</span>
    {/each}
  </div>
  <div class="heatmap-body">
    <div class="day-labels">
      {#each DAY_LABELS as label}
        <span class="day-label">{label}</span>
      {/each}
    </div>
    <div class="heatmap-grid" style="grid-template-columns: repeat({weeks.length}, 14px);">
      {#each weeks as week, wi}
        {#each week as day}
          {#if day.date}
            <div class="cell" style="background: {color(day.value)};" title="{day.date}: {day.value} completions"></div>
          {:else}
            <div class="cell empty"></div>
          {/if}
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .heatmap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-x: auto;
  }
  .heatmap-months {
    display: flex;
    gap: 2px;
    padding-left: 32px;
  }
  .spacer {
    width: 0;
  }
  .heatmap-body {
    display: flex;
    gap: 4px;
  }
  .day-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .day-label {
    font-size: 0.65rem;
    color: var(--text-secondary, #666);
    height: 14px;
    line-height: 14px;
  }
  .heatmap-grid {
    display: grid;
    gap: 2px;
  }
  .cell {
    width: 14px;
    height: 14px;
    border-radius: 2px;
  }
  .cell.empty {
    background: transparent;
  }
</style>
