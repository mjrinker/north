<script lang="ts">
  import type { Habit, HabitEntry } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import { getEntriesByDateRangeMeta, getAllEntries } from '../../services/storage';
  import { HabitEngine } from '../../services/habitEngine';
  import { getLocalDateString, parseLocalDate, isToday } from '../../lib/dates';
  import { formatDurationLabel, hmsFromSeconds } from '../../lib/duration';
  import { autoCompleteDependencies, uncheckDependencies, cascadeCheck, cascadeUncheck } from '../../lib/dependencyEngine';
import { sortHabitsForMode, loadSortMode } from '../../lib/habitUtils';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import HabitBackfillModal from '../../components/HabitBackfillModal.svelte';
  import Icon from '@iconify/svelte';
  import { showCreateHabit } from '../../stores/createHabit';
  import { onDestroy, tick } from 'svelte';

  $effect(() => {
    if (editTarget) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  });

  let habits = $state<Habit[]>([]);
  let unsubHabits = habitsStore.subscribe(v => habits = sortHabitsForMode(v.filter(h => h.status === 'active'), loadSortMode()));
  onDestroy(() => unsubHabits());

  // --- Row virtualization ---
  const ROW_HEIGHT = 40;
  const OVERSCAN = 6;
  let tableContainer = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let totalRows = $derived(habits.length);

  let firstRow = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
  let lastRow = $derived(Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN));
  let visibleHabits = $derived(habits.slice(firstRow, lastRow));

  const LEFT_EDGE_TRIGGER = 10;

  function handleTableScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    scrollTop = el.scrollTop;
    viewportHeight = el.clientHeight;
    if (el.scrollLeft <= LEFT_EDGE_TRIGGER) loadOlder();
  }

  async function loadOlder() {
    if (!tableContainer || loadingMore || !canLoadMore) return;
    loadingMore = true;
    try {
      const el = tableContainer;
      const anchorDate = dateColumns[0];
      const anchorTh = anchorDate ? el.querySelector(`thead th[data-date="${anchorDate}"]`) : null;
      const containerLeft = el.getBoundingClientRect().left;
      const beforeLeft = anchorTh ? anchorTh.getBoundingClientRect().left - containerLeft : el.scrollLeft;

      startOffsetDays += EXTEND_CHUNK;
      await tick();

      if (anchorDate) {
        const afterTh = el.querySelector(`thead th[data-date="${anchorDate}"]`);
        if (afterTh) {
          const afterLeft = afterTh.getBoundingClientRect().left - containerLeft;
          el.scrollLeft = Math.max(0, el.scrollLeft + (afterLeft - beforeLeft));
        }
      }
    } finally {
      loadingMore = false;
    }
  }

  function measureViewport() {
    if (tableContainer) viewportHeight = tableContainer.clientHeight;
  }
  $effect(() => {
    measureViewport();
    const ro = new ResizeObserver(measureViewport);
    if (tableContainer) ro.observe(tableContainer);
    return () => ro.disconnect();
  });

  let allEntries = $state<HabitEntry[]>([]);
  let entriesReady = $state(false);
  let earliestEntryDate = $state<string | null>(null);

  const INITIAL_DAYS_BACK = 89;
  const EXTEND_CHUNK = 60;
  let startOffsetDays = $state(INITIAL_DAYS_BACK);
  let loadingMore = $state(false);

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function getDates(): string[] {
    const today = new Date();
    const dates: string[] = [];
    const d = new Date(today);
    d.setDate(d.getDate() - startOffsetDays);
    for (let i = 0; i <= startOffsetDays; i++) {
      dates.push(getLocalDateString(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  let dateColumns = $derived(getDates());
  let canLoadMore = $derived(earliestEntryDate !== null && dateColumns[0] > earliestEntryDate);

  $effect(() => {
    const dates = getDates();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    getEntriesByDateRangeMeta(startDate, endDate)
      .then(meta => {
        allEntries = meta.entries;
        earliestEntryDate = meta.earliestDate;
      })
      .catch(err => console.error('load entries error:', err))
      .finally(() => { entriesReady = true; });
  });

  $effect(() => {
    if (!tableContainer || !entriesReady) return;
    requestAnimationFrame(() => {
      if (tableContainer && tableContainer.scrollWidth > tableContainer.clientWidth) {
        tableContainer.scrollLeft = tableContainer.scrollWidth;
      }
    });
  });

  let showCreate = $state(false);

  {
    let skip = true;
    onDestroy(showCreateHabit.subscribe(() => {
      if (skip) { skip = false; return; }
      showCreate = true;
    }));
  }
  let editingHabit = $state<Habit | null>(null);
  let backfillTarget = $state<Habit | null>(null);

  let entryMap = $derived.by(() => {
    const map = new Map<string, HabitEntry>();
    for (const e of allEntries) {
      map.set(`${e.habitId}|${e.date}`, e);
    }
    return map;
  });

  function getDayEntry(habitId: string, date: string): HabitEntry | undefined {
    return entryMap.get(`${habitId}|${date}`);
  }

  function upsertEntry(habitId: string, date: string, value: number) {
    const idx = allEntries.findIndex(e => e.habitId === habitId && e.date === date);
    if (idx >= 0) {
      const updated = [...allEntries];
      updated[idx] = { ...updated[idx], value, standardMet: value >= 1 };
      allEntries = updated;
    } else {
      allEntries = [...allEntries, {
        id: crypto.randomUUID(),
        habitId,
        date,
        value,
        standardMet: value >= 1,
        targetMet: false,
        updatedAt: new Date(),
      } as HabitEntry];
    }
  }

  async function refreshEntries() {
    allEntries = await getAllEntries();
  }

  async function handleBinary(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const wasChecked = entry?.value === 1;
    const value = wasChecked ? 0 : 1;
    await HabitEngine.logCompletion(habit, date, value);
    upsertEntry(habit.id, date, value);
    if (value === 1 && habit.dependsOn) {
      await autoCompleteDependencies(habit, date, habits, getDayEntryAsync, afterUpsert);
    }
    if (wasChecked && habit.dependsOn) {
      await uncheckDependencies(habit, date, habits, getDayEntryAsync, afterUpsert);
    }
    await refreshEntries();
    await cascadeCheck(habit, date, habits, getDayEntryAsync, afterUpsert);
    await cascadeUncheck(habit, date, habits, getDayEntryAsync, afterUpsert);
  }

  const getDayEntryAsync = (hid: string, d: string) => Promise.resolve(getDayEntry(hid, d));
  const afterUpsert = (hid: string, d: string, v: number) => upsertEntry(hid, d, v);

  // --- Long-press edit modal for quantity/duration ---
  let isLongPress = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let editTarget: { habit: Habit; date: string; type: 'quantity' | 'duration' } | null = $state(null);
  let editValue = $state(0);
  let editHours = $state(0);
  let editMinutes = $state(0);
  let editSeconds = $state(0);

  function cellPointerDown(e: Event, habit: Habit, date: string) {
    e.preventDefault();
    e.stopPropagation();
    isLongPress = false;
    pressTimer = setTimeout(() => {
      isLongPress = true;
      openEditModal(habit, date);
    }, 500);
  }

  function cellPointerUp(e: Event) {
    e.stopPropagation();
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function cellPointerLeave() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  async function handleCellTap(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const current = entry?.value ?? 0;
    await HabitEngine.logCompletion(habit, date, current + 1);
    await afterLogCompletion(habit, date);
  }

  function cellClick(e: MouseEvent, habit: Habit, date: string) {
    e.stopPropagation();
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    handleCellTap(habit, date);
  }

  async function afterLogCompletion(habit: Habit, date: string) {
    await refreshEntries();
    await cascadeCheck(habit, date, habits, getDayEntryAsync, afterUpsert);
    await cascadeUncheck(habit, date, habits, getDayEntryAsync, afterUpsert);
  }

  function openEditModal(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const current = entry?.value ?? 0;
    editTarget = { habit, date, type: habit.type as 'quantity' | 'duration' };
    if (habit.type === 'quantity') {
      editValue = current;
    } else {
      const { h, m, s } = hmsFromSeconds(current);
      editHours = h;
      editMinutes = m;
      editSeconds = s;
    }
  }

  async function saveEdit() {
    if (!editTarget) return;
    const { habit, date, type } = editTarget;
    const value = type === 'quantity' ? editValue : editHours * 3600 + editMinutes * 60 + editSeconds;
    await HabitEngine.logCompletion(habit, date, value);
    await afterLogCompletion(habit, date);
    editTarget = null;
  }

  async function resetEdit() {
    if (!editTarget) return;
    const { habit, date } = editTarget;
    await HabitEngine.logCompletion(habit, date, 0);
    await afterLogCompletion(habit, date);
    editTarget = null;
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

<h1>History</h1>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
{/if}

{#if backfillTarget}
  <HabitBackfillModal
    habit={backfillTarget}
    allHabits={habits}
    onClose={async () => { backfillTarget = null; await refreshEntries(); }}
  />
{/if}

<div class="table-scroll" bind:this={tableContainer} onscroll={handleTableScroll}>
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
      {#if firstRow > 0}
        <tr aria-hidden="true">
          <td colspan={dateColumns.length + 1} style="height: {firstRow * ROW_HEIGHT}px" class="v-spacer"></td>
        </tr>
      {/if}
      {#each visibleHabits as habit (habit.id)}
        <tr>
          {#each dateColumns as date}
            {@const entry = getDayEntry(habit.id, date)}
            <td class="day-cell {cellClass(entry)}" class:today={isToday(date)}>
              {#if habit.type === 'binary'}
                <label class="hist-check-wrap" class:checked={entry?.value === 1} onclick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={entry?.value === 1} onchange={() => handleBinary(habit, date)} />
                  {#if entry?.value === 1}
                    {#if habit.metadata?.category === 'break'}
                      <Icon icon="mdi:close" class="hist-check-icon break" />
                    {:else}
                      <Icon icon="mdi:check" class="hist-check-icon" />
                    {/if}
                  {/if}
                </label>
              {:else if habit.type === 'quantity'}
                <button class="cell-btn"
                  onclick={(e) => cellClick(e, habit, date)}
                  onpointerdown={(e) => cellPointerDown(e, habit, date)}
                  onpointerup={cellPointerUp}
                  onpointerleave={cellPointerLeave}
                >{entry?.value ?? 0}</button>
              {:else if habit.type === 'duration'}
                <button class="cell-btn"
                  onclick={(e) => cellClick(e, habit, date)}
                  onpointerdown={(e) => cellPointerDown(e, habit, date)}
                  onpointerup={cellPointerUp}
                  onpointerleave={cellPointerLeave}
                >{entry?.value ? formatDurationLabel(entry.value) : '-'}</button>
              {/if}
            </td>
          {/each}
          <td class="name-col habit-name"><button class="name-btn" onclick={() => backfillTarget = habit} title="Backfill {habit.title}">{habit.title}</button></td>
        </tr>
      {/each}
      {#if lastRow < totalRows}
        <tr aria-hidden="true">
          <td colspan={dateColumns.length + 1} style="height: {(totalRows - lastRow) * ROW_HEIGHT}px" class="v-spacer"></td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>

{#if editTarget}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => editTarget = null}>
    <div class="edit-modal" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close" onclick={() => editTarget = null}>×</button>
      <h3>{editTarget.habit.title}</h3>
      <p class="modal-date">{editTarget.date}</p>
      {#if editTarget.type === 'quantity'}
        <label class="modal-field">
          <span>Value</span>
          <input type="number" bind:value={editValue} min="0" />
        </label>
      {:else}
        <div class="time-fields">
          <label class="modal-field">
            <span>Hours</span>
            <input type="number" bind:value={editHours} min="0" />
          </label>
          <label class="modal-field">
            <span>Minutes</span>
            <input type="number" bind:value={editMinutes} min="0" max="59" />
          </label>
          <label class="modal-field">
            <span>Seconds</span>
            <input type="number" bind:value={editSeconds} min="0" max="59" />
          </label>
        </div>
      {/if}
      <div class="modal-actions">
        <button class="icon-btn save-btn" onclick={saveEdit} aria-label="Save"><Icon icon="mdi:check" style="color: inherit" /></button>
        <button class="icon-btn reset-btn" onclick={resetEdit} aria-label="Reset"><Icon icon="mdi:restart" style="color: inherit" /></button>
        <button class="icon-btn cancel-btn" onclick={() => editTarget = null} aria-label="Cancel"><Icon icon="mdi:close" style="color: inherit" /></button>
      </div>
    </div>
  </div>
{/if}

<style>
  h1 {
    font-size: 1.5rem;
    color: var(--text-primary, #222);
    margin-bottom: 0.5rem;
  }
  .table-scroll {
    overflow: auto;
    max-width: 100%;
    max-height: calc(100vh - 130px);
  }
  .table-scroll thead {
    position: sticky;
    top: 0;
    z-index: 3;
  }
  .v-spacer {
    padding: 0;
    margin: 0;
    border: none;
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
    background: var(--card-bg, #fff);
  }
  th.today { color: var(--text-primary, #222); font-weight: 700; }
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
    padding: 0;
    border-bottom: 1px solid var(--card-border, #eee);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name-btn {
    display: block;
    width: 100%;
    padding: 8px;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary, #222);
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name-btn:hover {
    background: var(--hover-bg, rgba(0, 0, 0, 0.03));
    color: #0066cc;
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
  .hist-check-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--input-bg, #f5f5f5);
    border-radius: 0;
    height: 1.6rem;
    width: 1.6rem;
    cursor: pointer;
    position: relative;
    vertical-align: middle;
  }
  .hist-check-wrap input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  :global(.hist-check-icon) {
    font-size: 1.4rem;
    color: #2e7d32;
    pointer-events: none;
    line-height: 1;
  }
  :global(.hist-check-icon.break) {
    color: #d32f2f;
  }
  .cell-btn {
    background: none;
    border: 1px solid var(--card-border, #ddd);
    border-radius: 0;
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--text-primary, #222);
    min-width: 2.4rem;
    text-align: center;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .cell-btn:hover {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    border-color: var(--text-secondary, #888);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  .edit-modal {
    background: var(--card-bg, #fff);
    border-radius: 8px;
    padding: 1.25rem;
    min-width: 220px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    position: relative;
  }
  .edit-modal h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .modal-date {
    margin: 0 0 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }
  .modal-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-secondary, #999);
    line-height: 1;
  }
  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 0.75rem;
  }
  .modal-field span {
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }
  .modal-field input {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 0.9rem;
    width: 100%;
    box-sizing: border-box;
  }
  .time-fields {
    display: flex;
    gap: 0.75rem;
  }
  .time-fields .modal-field {
    flex: 1;
  }
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .modal-actions .icon-btn {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-sizing: border-box;
  }
  .modal-actions .icon-btn :global(svg), .modal-actions .icon-btn :global(.iconify) { font-size: 1.3rem; color: inherit; }
  .modal-actions .icon-btn.save-btn { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .modal-actions .icon-btn.reset-btn { background: #d32f2f; color: white; }
  .modal-actions .icon-btn.cancel-btn { background: transparent; color: var(--text-primary, #333); border: 1px solid var(--card-border, #ccc); }
  .modal-actions .icon-btn:hover { opacity: 0.85; }
</style>
