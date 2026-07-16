<script lang="ts">
  import type { Habit, HabitEntry } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import { getAllEntries } from '../../services/storage';
  import { HabitEngine } from '../../services/habitEngine';
  import { getLocalDateString, parseLocalDate, isToday } from '../../lib/dates';
  import { autoCompleteDependencies, uncheckDependencies, cascadeCheck, cascadeUncheck } from '../../lib/dependencyEngine';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import Icon from '@iconify/svelte';
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

  function handleCellTap(habit: Habit, date: string) {
    const entry = getDayEntry(habit.id, date);
    const current = entry?.value ?? 0;
    HabitEngine.logCompletion(habit, date, current + 1).then(() => afterLogCompletion(habit, date));
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
      editHours = Math.floor(current / 60);
      editMinutes = Math.round(current % 60);
    }
  }

  async function saveEdit() {
    if (!editTarget) return;
    const { habit, date, type } = editTarget;
    const value = type === 'quantity' ? editValue : editHours * 60 + editMinutes;
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

<button class="fab" onclick={() => showCreate = true} aria-label="Add Habit"><Icon icon="mdi:plus" style="color: inherit" /></button>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
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
                >{entry?.value ? Math.floor(entry.value) + 'm' : '-'}</button>
              {/if}
            </td>
          {/each}
          <td class="name-col habit-name">{habit.title}</td>
        </tr>
      {/each}
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
  .fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    z-index: 50;
  }
  .fab :global(svg), .fab :global(.iconify) { font-size: 1.75rem; color: inherit; }
  .fab:hover { opacity: 0.9; }

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
    touch-action: manipulation;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .cell-btn:hover {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
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
    border-radius: 4px;
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
  .modal-actions .icon-btn.save-btn { background: var(--accent, #0066cc); color: white; }
  .modal-actions .icon-btn.reset-btn { background: #d32f2f; color: white; }
  .modal-actions .icon-btn.cancel-btn { background: transparent; color: var(--text-primary, #333); border: 1px solid var(--card-border, #ccc); }
  .modal-actions .icon-btn:hover { opacity: 0.85; }
</style>
