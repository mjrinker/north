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
  import Modal from '../../components/Modal.svelte';
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
  const ROW_HEIGHT = 44;
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

<div class="page history">
  <header class="history-header">
    <h1 class="page-title">History</h1>
    <button class="icon-btn add" onclick={() => showCreate = true} aria-label="New habit"><Icon icon="mdi:plus" /></button>
  </header>
  <p class="hint">Tap a day to change it. Tap a habit’s name to fill in a range of days.</p>

  <div class="table-card">
    <div class="table-scroll" bind:this={tableContainer} onscroll={handleTableScroll}>
      <table>
        <thead>
          <tr class="month-row">
            {#each monthSpans as span}
              <th colspan={span.count} class="month-label"><span>{span.label}</span></th>
            {/each}
            <th class="name-col"></th>
          </tr>
          <tr>
            {#each dateColumns as date}
              <th class="day-head" class:today={isToday(date)} data-date={date}>
                <span class="day-name">{getDayName(date).slice(0, 1)}</span>
                <span class="day-num tabular">{Number(date.slice(8))}</span>
              </th>
            {/each}
            <th class="name-col"></th>
          </tr>
        </thead>
        <tbody>
          {#if firstRow > 0}
            <tr aria-hidden="true">
              <td colspan={dateColumns.length + 1} style="height: {firstRow * ROW_HEIGHT}px" class="v-spacer"></td>
            </tr>
          {/if}
          {#each visibleHabits as habit (habit.id)}
            <tr style="--habit: {habit.metadata?.color || 'var(--accent)'}">
              {#each dateColumns as date}
                {@const entry = getDayEntry(habit.id, date)}
                <td class="day-cell {cellClass(entry)}" class:today={isToday(date)}>
                  {#if habit.type === 'binary'}
                    {@const isBreak = habit.metadata?.category === 'break'}
                    {@const logged = entry?.value === 1}
                    <label class="dot" class:on={isBreak || logged} class:break={isBreak && logged}>
                      <input type="checkbox" checked={logged} onchange={() => handleBinary(habit, date)} aria-label="{habit.title}, {date}{isBreak ? (logged ? ', slipped' : ', kept') : ''}" />
                      {#if isBreak}<Icon icon={logged ? 'mdi:close' : 'mdi:check'} />{/if}
                    </label>
                  {:else}
                    <button class="cell-btn tabular"
                      class:zero={!entry?.value}
                      onclick={(e) => cellClick(e, habit, date)}
                      onpointerdown={(e) => cellPointerDown(e, habit, date)}
                      onpointerup={cellPointerUp}
                      onpointerleave={cellPointerLeave}
                      aria-label="{habit.title}, {date}"
                    >{#if habit.type === 'duration'}{entry?.value ? formatDurationLabel(entry.value) : '–'}{:else}{entry?.value || '–'}{/if}</button>
                  {/if}
                </td>
              {/each}
              <td class="name-col habit-name"><button class="name-btn" onclick={() => backfillTarget = habit} title="Fill in {habit.title}">{habit.title}</button></td>
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
  </div>
</div>

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

{#if editTarget}
  <Modal onClose={() => editTarget = null}>
    <h2 class="edit-title">{editTarget.habit.title}</h2>
    <p class="edit-date">{parseLocalDate(editTarget.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    {#if editTarget.type === 'quantity'}
      <div class="field">
        <label for="hist-value">{editTarget.habit.unit ? editTarget.habit.unit : 'Value'}</label>
        <input id="hist-value" type="number" inputmode="numeric" bind:value={editValue} min="0" />
      </div>
    {:else}
      <div class="time-fields">
        <div class="field">
          <label for="hist-h">Hours</label>
          <input id="hist-h" type="number" inputmode="numeric" bind:value={editHours} min="0" />
        </div>
        <div class="field">
          <label for="hist-m">Minutes</label>
          <input id="hist-m" type="number" inputmode="numeric" bind:value={editMinutes} min="0" max="59" />
        </div>
        <div class="field">
          <label for="hist-s">Seconds</label>
          <input id="hist-s" type="number" inputmode="numeric" bind:value={editSeconds} min="0" max="59" />
        </div>
      </div>
    {/if}
    <div class="edit-actions">
      <button class="btn btn-plain clear" onclick={resetEdit}>Clear</button>
      <span class="spacer"></span>
      <button class="btn btn-secondary" onclick={() => editTarget = null}>Cancel</button>
      <button class="btn" onclick={saveEdit}>Save</button>
    </div>
  </Modal>
{/if}

<style>
  .history {
    max-width: none;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .history .page-title {
    margin-bottom: var(--space-1);
  }

  .icon-btn.add {
    color: var(--accent);
    font-size: 26px;
    margin-right: calc(-1 * var(--space-2));
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--text-2);
    margin-bottom: var(--space-4);
  }

  .table-card {
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }

  .table-scroll {
    overflow: auto;
    max-width: 100%;
    max-height: calc(100dvh - 210px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overscroll-behavior: contain;
  }

  .table-scroll thead {
    position: sticky;
    top: 0;
    z-index: 3;
  }

  .v-spacer {
    padding: 0;
    border: none;
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: max-content;
  }

  th {
    background: var(--surface);
    font-weight: 500;
    color: var(--text-3);
    white-space: nowrap;
    line-height: 1.15;
  }

  .month-label {
    padding: var(--space-2) 0 0;
    text-align: left;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-2);
  }

  .month-label span {
    position: sticky;
    left: var(--space-3);
    padding: 0 var(--space-3);
  }

  .day-head {
    padding: var(--space-1) 0 var(--space-2);
    border-bottom: 0.5px solid var(--separator-strong);
    text-align: center;
  }

  .day-name {
    display: block;
    font-size: 10.5px;
  }

  .day-num {
    display: block;
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .day-head.today .day-num {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  th.name-col,
  td.name-col {
    position: sticky;
    right: 0;
    z-index: 2;
    background: var(--surface);
    box-shadow: -0.5px 0 0 var(--separator-strong);
  }

  th.name-col {
    border-bottom: 0.5px solid var(--separator-strong);
  }

  td.name-col.habit-name {
    padding: 0;
    max-width: 150px;
    border-bottom: 0.5px solid var(--separator);
  }

  .name-btn {
    display: block;
    width: 100%;
    height: 44px;
    padding: 0 var(--space-3);
    text-align: left;
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name-btn:active {
    color: var(--accent);
  }

  .day-cell {
    height: 44px;
    min-width: 40px;
    padding: 0 2px;
    text-align: center;
    border-bottom: 0.5px solid var(--separator);
  }

  .day-cell.today {
    background: var(--accent-soft);
  }

  /* Binary: dot that fills with the habit color */
  .dot {
    position: relative;
    display: inline-block;
    width: 22px;
    height: 22px;
    vertical-align: middle;
    border-radius: 50%;
    border: 1.5px solid var(--separator-strong);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .dot.on {
    background: var(--habit);
    border-color: var(--habit);
  }

  .dot :global(svg) {
    position: absolute;
    inset: 0;
    margin: auto;
    color: #fff;
    font-size: 15px;
    pointer-events: none;
  }

  .dot.on.break {
    background: var(--danger);
    border-color: var(--danger);
  }

  .dot input {
    position: absolute;
    inset: -9px;
    opacity: 0;
    cursor: pointer;
  }

  .cell-btn {
    min-width: 36px;
    height: 32px;
    padding: 0 4px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text);
    touch-action: manipulation;
    -webkit-touch-callout: none;
  }

  .cell-btn {
    color: var(--text-2);
  }

  .cell-btn.zero {
    color: var(--text-3);
    font-weight: 400;
  }

  .cell-btn:active {
    background: var(--surface-2);
  }

  /* Met days get a tint of the habit color; text stays in neutral ink. */
  .standard-met .cell-btn {
    background: color-mix(in srgb, var(--habit) 13%, transparent);
    color: var(--text);
    font-weight: 600;
  }

  .target-met .cell-btn {
    background: color-mix(in srgb, var(--habit) 26%, transparent);
    color: var(--text);
    font-weight: 650;
  }

  /* Day editor */
  .history .edit-title,
  .edit-title {
    margin-bottom: 2px;
  }

  .edit-date {
    font-size: var(--text-sm);
    color: var(--text-2);
    margin-bottom: var(--space-4);
  }

  .time-fields {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }

  .spacer {
    flex: 1;
  }

  .clear {
    color: var(--danger);
    padding-left: 0;
  }
</style>
