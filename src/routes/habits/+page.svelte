<script lang="ts">
  import type { Habit, HabitEntry } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import { getAllEntries } from '../../services/storage';
  import { HabitEngine } from '../../services/habitEngine';
  import { goto } from '$app/navigation';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));

  let allEntries = $state<HabitEntry[]>([]);
  $effect(() => {
    getAllEntries().then(e => allEntries = e);
  });

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let weekStart = $derived(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  let weekDates = $derived<string[]>(() => {
    const start = weekStart();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  });

  let entryMap = $derived(() => {
    const map = new Map<string, HabitEntry>();
    for (const e of allEntries) {
      map.set(`${e.habitId}|${e.date}`, e);
    }
    return map;
  });

  function getDayEntry(habitId: string, date: string): HabitEntry | undefined {
    return entryMap().get(`${habitId}|${date}`);
  }

  async function handleBinary(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const engine = new HabitEngine(habit);
    const value = entry?.value === 1 ? 0 : 1;
    await engine.logCompletion(date, value);
    const fresh = await getAllEntries();
    allEntries = fresh;
  }

  async function handleQuantityClick(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const engine = new HabitEngine(habit);
    const current = entry?.value ?? 0;
    await engine.logCompletion(date, current + 1);
    const fresh = await getAllEntries();
    allEntries = fresh;
  }

  async function handleDuration(habit: Habit, date: string) {
    const engine = new HabitEngine(habit);
    await engine.logCompletion(date, habit.standard);
    const fresh = await getAllEntries();
    allEntries = fresh;
  }

  function isToday(date: string): boolean {
    return date === new Date().toISOString().slice(0, 10);
  }
</script>

<div class="week-view">
  <div class="header-row">
    <div class="corner-cell"></div>
    {#each DAY_NAMES as name, i}
      <div class="day-header" class:today={isToday(weekDates()[i])}>{name}<span class="day-num">{weekDates()[i].slice(8)}</span></div>
    {/each}
  </div>

  {#each habits as habit (habit.id)}
    <div class="habit-row" onclick={() => goto(`/habits/${habit.id}`)}>
      <div class="habit-label">{habit.title}</div>
      {#each weekDates() as date, i}
        {@const entry = getDayEntry(habit.id, date)}
        <div class="day-cell" class:today={isToday(date)} onclick={e => e.stopPropagation()}>
          {#if habit.type === 'binary'}
            <input type="checkbox" checked={entry?.value === 1} onchange={() => handleBinary(habit, date)} />
          {:else if habit.type === 'quantity'}
            <button class="cell-btn" onclick={() => handleQuantityClick(habit, date)}>{entry?.value ?? 0}</button>
          {:else if habit.type === 'duration'}
            <button class="cell-btn" onclick={() => handleDuration(habit, date)}>{entry?.value ? `${entry.value}m` : '-'}</button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<div style="text-align: center; padding: 1rem;">
  <a href="/habits/add" class="add-link">+ Add New Habit</a>
</div>

<style>
  .week-view {
    padding: 1rem;
    max-width: 700px;
    margin: 0 auto;
    overflow-x: auto;
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .corner-cell {
    width: 120px;
    flex-shrink: 0;
  }
  .day-header {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    padding: 4px 0;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.2;
  }
  .day-header.today {
    color: var(--accent, #0066cc);
  }
  .day-num {
    font-size: 0.6rem;
    font-weight: 400;
  }
  .habit-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
    border-bottom: 1px solid var(--card-border, #eee);
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .habit-row:hover {
    background: var(--hover-bg, rgba(0,0,0,0.03));
  }
  .habit-label {
    width: 120px;
    flex-shrink: 0;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text, #222);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 4px;
  }
  .day-cell {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
  }
  .day-cell.today {
    background: var(--today-bg, rgba(0,102,204,0.06));
    border-radius: 4px;
  }
  .day-cell input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }
  .cell-btn {
    background: none;
    border: 1px solid var(--card-border, #ddd);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--text, #222);
    min-width: 2.2rem;
    text-align: center;
  }
  .cell-btn:hover {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .add-link {
    text-decoration: none;
    color: var(--accent, #0066cc);
    font-weight: 500;
  }
</style>