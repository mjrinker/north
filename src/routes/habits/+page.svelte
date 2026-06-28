<script lang="ts">
  import type { Habit, HabitEntry } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import { getAllEntries } from '../../services/storage';
  import { HabitEngine } from '../../services/habitEngine';
  import { getLocalDateString } from '../../lib/dates';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import { tick } from 'svelte';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v.filter(h => h.status === 'active')));

  let allEntries = $state<HabitEntry[]>([]);
  $effect(() => {
    getAllEntries().then(e => allEntries = e);
  });

  let showCreate = $state(false);
  let editingHabit = $state<Habit | null>(null);
  let scrollContainer = $state<HTMLDivElement | null>(null);
  let hasScrolled = $state(false);
  let windowStart = $state(89);
  let shifting = $state(false);

  const WINDOW_SIZE = 90;
  const SHIFT_SIZE = 45;
  const COL_WIDTH = 44;

  $effect(() => {
    if (allEntries.length > 0 && scrollContainer && !hasScrolled) {
      requestAnimationFrame(() => {
        scrollContainer!.scrollLeft = scrollContainer!.scrollWidth;
        hasScrolled = true;
      });
    }
  });

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function getDates(): string[] {
    const today = new Date();
    const dates: string[] = [];
    const d = new Date(today);
    d.setDate(d.getDate() - windowStart);
    for (let i = 0; i < WINDOW_SIZE; i++) {
      dates.push(getLocalDateString(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  let dateColumns = $derived(getDates());

  function canShiftLeft(): boolean {
    return true;
  }

  function canShiftRight(): boolean {
    return dateColumns[WINDOW_SIZE - 1] < getLocalDateString();
  }

  function onScroll() {
    if (!scrollContainer || shifting) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    if (scrollLeft < COL_WIDTH * 3 && canShiftLeft()) {
      shiftLeft();
    } else if (scrollLeft + clientWidth > scrollWidth - COL_WIDTH * 3 && canShiftRight()) {
      shiftRight();
    }
  }

  async function shiftLeft() {
    shifting = true;
    windowStart += SHIFT_SIZE;
    await tick();
    if (scrollContainer) {
      scrollContainer.scrollLeft += SHIFT_SIZE * COL_WIDTH;
    }
    shifting = false;
  }

  async function shiftRight() {
    shifting = true;
    windowStart -= SHIFT_SIZE;
    await tick();
    if (scrollContainer) {
      scrollContainer.scrollLeft -= SHIFT_SIZE * COL_WIDTH;
    }
    shifting = false;
  }

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

  async function refreshEntries() {
    allEntries = await getAllEntries();
  }

  async function handleBinary(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const wasChecked = entry?.value === 1;
    const value = wasChecked ? 0 : 1;
    const engine = new HabitEngine(habit);
    await engine.logCompletion(date, value);
    if (value === 1 && habit.dependsOn) {
      await autoCompleteDeps(habit, date);
    }
    if (wasChecked) {
      await cascadeUncheck(habit, date);
    }
    await refreshEntries();
  }

  async function autoCompleteDeps(habit: Habit, date: string) {
    for (const hid of habit.dependsOn!.habitIds) {
      const entry = getDayEntry(hid, date);
      if (entry?.value && entry.value > 0) continue;
      const dep = habits.find(h => h.id === hid);
      if (!dep) continue;
      await new HabitEngine(dep).logCompletion(date, dep.standard);
    }
  }

  async function cascadeUncheck(habit: Habit, date: string) {
    const dependents = habits.filter(h => h.type === 'binary' && h.dependsOn?.habitIds.includes(habit.id));
    for (const dep of dependents) {
      const depEntry = getDayEntry(dep.id, date);
      if (!depEntry || depEntry.value === 0) continue;
      const otherDeps = dep.dependsOn!.habitIds.filter(id => id !== habit.id);
      if (otherDeps.length === 0) {
        await new HabitEngine(dep).logCompletion(date, 0);
        continue;
      }
      const results = otherDeps.map(id => {
        const e = getDayEntry(id, date);
        const h = habits.find(x => x.id === id);
        return (e?.value ?? 0) >= (h?.standard ?? 1);
      });
      const otherMet = dep.dependsOn!.mode === 'and' ? results.every(Boolean) : results.some(Boolean);
      if (!otherMet) {
        await new HabitEngine(dep).logCompletion(date, 0);
      }
    }
  }

  async function handleQuantityClick(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const engine = new HabitEngine(habit);
    const current = entry?.value ?? 0;
    await engine.logCompletion(date, current + 1);
    await refreshEntries();
  }

  async function handleDuration(habit: Habit, date: string) {
    const val = prompt('Duration (minutes):', '');
    if (val === null) return;
    const mins = parseInt(val);
    if (isNaN(mins) || mins < 1) return;
    const engine = new HabitEngine(habit);
    await engine.logCompletion(date, mins);
    await refreshEntries();
  }

  function isToday(date: string): boolean {
    return date === getLocalDateString();
  }

  function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function getDayName(dateStr: string): string {
    const d = parseLocalDate(dateStr);
    return DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
  }

  let monthSpans = $derived.by(() => {
    const spans: { label: string; count: number }[] = [];
    let currentMonth = '';
    let currentYear = '';
    let span: { label: string; count: number } | null = null;
    for (const date of dateColumns) {
      const month = date.slice(0, 7);
      if (month !== currentMonth) {
        if (span) spans.push(span);
        const d = parseLocalDate(date);
        const y = date.slice(0, 4);
        const showYear = y !== currentYear;
        span = {
          label: d.toLocaleDateString('en-US', showYear ? { month: 'short', year: 'numeric' } : { month: 'short' }),
          count: 1
        };
        currentMonth = month;
        currentYear = y;
      } else if (span) {
        span.count++;
      }
    }
    if (span) spans.push(span);
    return spans;
  });

  function cellClass(entry: HabitEntry | undefined): string {
    if (!entry || entry.value === 0) return '';
    if (entry.targetMet) return 'target-met';
    if (entry.standardMet) return 'standard-met';
    return '';
  }
</script>

<h1>Habit History</h1>

<button class="add-btn" onclick={() => showCreate = true}>+ Add New Habit</button>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} {habits} onClose={() => editingHabit = null} />
{/if}

<div class="table-scroll" bind:this={scrollContainer} onscroll={onScroll}>
  <table>
    <thead>
      <tr class="month-row">
        {#each monthSpans as span}
          <th colspan={span.count} class="month-label">{span.label}</th>
        {/each}
        <th class="name-col"></th>
      </tr>
      <tr>
        {#each dateColumns as date, i}
          <th class:today={isToday(date)} data-date={date}>
            <span class="day-name">{getDayName(date)}</span>
            <span class="day-num">{date.slice(8)}</span>
          </th>
        {/each}
        <th class="name-col">Habit</th>
      </tr>
    </thead>
    <tbody>
      {#each habits as habit (habit.id)}
        <tr onclick={() => editingHabit = habit}>
          {#each dateColumns as date}
            {@const entry = getDayEntry(habit.id, date)}
            <td class="day-cell {cellClass(entry)}" class:today={isToday(date)}>
              {#if habit.type === 'binary'}
                <input type="checkbox" checked={entry?.value === 1} onclick={(e) => e.stopPropagation()} onchange={() => handleBinary(habit, date)} />
              {:else if habit.type === 'quantity'}
                <button class="cell-btn" onclick={(e) => { e.stopPropagation(); handleQuantityClick(habit, date); }}>{entry?.value ?? 0}</button>
              {:else if habit.type === 'duration'}
                <button class="cell-btn" onclick={(e) => { e.stopPropagation(); handleDuration(habit, date); }}>{entry?.value ? Math.floor(entry.value) + 'm' : '-'}</button>
              {/if}
            </td>
          {/each}
          <td class="name-col habit-name">{habit.title}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  h1 {
    font-size: 1.5rem;
    color: var(--text-primary, #222);
    margin-bottom: 0.5rem;
  }
  .add-btn {
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  .add-btn:hover { opacity: 0.9; }

  .table-scroll {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: max-content;
  }
  th {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    padding: 4px 6px;
    border-bottom: 2px solid var(--card-border, #eee);
    line-height: 1.2;
    white-space: nowrap;
  }
  th.today { color: var(--accent, #0066cc); }
  .month-label { font-size: 0.7rem; font-weight: 700; padding: 2px 6px; color: var(--text-primary, #222); text-align: left; }
  .day-name { display: block; }
  .day-num { font-size: 0.6rem; font-weight: 400; }
  th.name-col, td.name-col {
    position: sticky;
    right: 0;
    background: var(--card-bg, #fff);
    z-index: 2;
  }
  th.name-col {
    text-align: left;
    padding-left: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    min-width: 120px;
  }
  td.name-col.habit-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary, #222);
    padding: 8px;
    border-bottom: 1px solid var(--card-border, #eee);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr {
    cursor: pointer;
  }
  tr:hover td:not(.name-col) { background: var(--hover-bg, rgba(0,0,0,0.02)); }
  tr:hover td.name-col { filter: brightness(0.97); }
  .day-cell {
    text-align: center;
    padding: 4px;
    border-bottom: 1px solid var(--card-border, #eee);
    min-width: 36px;
  }
  .day-cell.today { background: var(--today-bg, rgba(0,102,204,0.06)); }
  .day-cell.standard-met { background: rgba(46,125,50,0.08); }
  .day-cell.target-met { background: rgba(46,125,50,0.15); }
  .day-cell input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }
  .cell-btn {
    background: none;
    border: 1px solid var(--card-border, #ddd);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--text-primary, #222);
    min-width: 2.4rem;
    text-align: center;
  }
  .cell-btn:hover {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
</style>
