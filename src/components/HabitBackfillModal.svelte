<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { Habit } from '../types';
  import { getLocalDateString, parseLocalDate, toDateStr } from '../lib/dates';
  import { formatHms } from '../lib/duration';
  import { backfillHabit, type BackfillValueMode } from '../lib/backfill';
  import Modal from './Modal.svelte';
  import DurationField from './DurationField.svelte';

  let {
    habit,
    allHabits = [] as Habit[],
    onClose,
  }: {
    habit: Habit;
    allHabits: Habit[];
    onClose: () => void;
  } = $props();

  const today = getLocalDateString();
  const startDefault = toDateStr(daysBefore(today, 29));
  const endDefault = today;

  function daysBefore(dateStr: string, n: number): Date {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() - n);
    return d;
  }

  let startDate = $state(startDefault);
  let endDate = $state(endDefault);
  let busy = $state(false);
  let error = $state('');
  let done: { totalDays: number; appliedDays: number; skippedDays: number } | null = $state(null);

  const isBinary = $derived(habit.type === 'binary');
  const hasTarget = $derived(habit.target != null && habit.target !== undefined);
  const unit = $derived(habit.unit || (habit.type === 'duration' ? 'seconds' : ''));

  let valueMode = $state<BackfillValueMode>('STANDARD');
  let quantity = $state<number>(habit.standard ?? 0);
  let durationSecs = $state<number>(habit.standard ?? 0);

  const otherHabits = $derived(allHabits.filter(h => h.id !== habit.id && h.status === 'active'));
  const linkedHabits = $derived((habit.linkedHabitIds ?? []).map(id => allHabits.find(h => h.id === id)).filter((h): h is Habit => !!h && h.status !== 'deleted'));
  let condIds = $state<string[]>(habit.dependsOn?.habitIds ?? []);
  let condMode = $state<'and' | 'or'>(habit.dependsOn?.mode ?? 'and');
  let linkHabitId = $state<string>((habit.linkedHabitIds?.[0]) ?? '');

  const WEEKDAYS = [
    { key: 1, label: 'Mon' },
    { key: 2, label: 'Tue' },
    { key: 3, label: 'Wed' },
    { key: 4, label: 'Thu' },
    { key: 5, label: 'Fri' },
    { key: 6, label: 'Sat' },
    { key: 0, label: 'Sun' },
  ];
  let skipWeekdays = $state<number[]>([]);
  let skipDates = $state<string[]>([]);
  let newSkipDate = $state('');
  let skipLogged = $state(false);
  let skipAtOrAbove = $state(false);

  let dayCount = $derived.by(() => {
    const a = parseLocalDate(startDate);
    const b = parseLocalDate(endDate);
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  });

  function toggleWeekday(key: number) {
    skipWeekdays = skipWeekdays.includes(key) ? skipWeekdays.filter(k => k !== key) : [...skipWeekdays, key];
  }

  function toggleCond(id: string) {
    condIds = condIds.includes(id) ? condIds.filter(i => i !== id) : [...condIds, id];
  }

  function addSkipDate() {
    if (!newSkipDate) return;
    if (!skipDates.includes(newSkipDate)) skipDates = [...skipDates, newSkipDate];
    newSkipDate = '';
  }

  function removeSkipDate(d: string) {
    skipDates = skipDates.filter(x => x !== d);
  }

  let valueHint = $derived.by(() => {
    if (isBinary) return 'Marks each applied day as complete.';
    if (valueMode === 'STANDARD') {
      return habit.type === 'duration'
        ? `Sets the value to Standard (${formatHms(habit.standard ?? 0)}).`
        : `Sets the value to Standard (${habit.standard ?? 0}${unit ? ` ${unit}` : ''}).`;
    }
    if (valueMode === 'TARGET') {
      return habit.type === 'duration'
        ? `Sets the value to Target (${formatHms(habit.target ?? 0)}).`
        : `Sets the value to Target (${habit.target ?? 0}${unit ? ` ${unit}` : ''}).`;
    }
    if (valueMode === 'LINKED') {
      return 'Copies each day\u2019s logged value from the linked habit you choose below.';
    }
    return 'Uses the value you enter below.';
  });

  function handleClose() {
    if (!busy) onClose();
  }

  async function submit() {
    error = '';
    if (startDate > endDate) { error = 'Start date must be on or before end date.'; return; }
    if (valueMode === 'VALUE' && !isBinary) {
      if (habit.type === 'quantity' && !(quantity >= 0)) { error = 'Enter a value.'; return; }
      if (habit.type === 'duration' && !(durationSecs >= 0)) { error = 'Enter a duration.'; return; }
    }
    if (valueMode === 'TARGET' && !hasTarget) { error = 'This habit has no target set.'; return; }
    if (valueMode === 'LINKED' && !linkHabitId) { error = 'Choose a linked habit to copy from.'; return; }

    busy = true;
    try {
      const res = await backfillHabit({
        habitId: habit.id,
        startDate,
        endDate,
        valueMode,
        value: !isBinary && valueMode === 'VALUE' ? (habit.type === 'duration' ? durationSecs : quantity) : 1,
        linkedHabitId: valueMode === 'LINKED' ? linkHabitId || undefined : undefined,
        conditionHabitIds: condIds.length ? condIds : undefined,
        conditionMode: condIds.length ? condMode : undefined,
        skipWeekdays: skipWeekdays.length ? skipWeekdays : undefined,
        skipDates: skipDates.length ? skipDates : undefined,
        skipLogged: skipLogged || undefined,
        skipAtOrAbove: skipAtOrAbove || undefined,
      });
      done = { totalDays: res.totalDays, appliedDays: res.appliedDays, skippedDays: res.skippedDays };
      setTimeout(handleClose, 1500);
    } catch (e) {
      error = (e as Error)?.message || 'Backfill failed';
    } finally {
      busy = false;
    }
  }
</script>

<Modal onClose={handleClose}>
  <div class="modal-head">
    <h2>Fill in days</h2>
    <button class="icon-btn" onclick={handleClose} aria-label="Close"><Icon icon="mdi:close" /></button>
  </div>

  {#if done}
    <div class="done-box">
      <p class="done-title">Done</p>
      <p>Applied <strong>{done.appliedDays}</strong> of {done.totalDays} days{done.skippedDays > 0 ? ` (skipped ${done.skippedDays})` : ''}.</p>
    </div>
  {:else}
    <div class="habit-line">for <strong>{habit.title}</strong></div>

    <span class="field-label">Date range</span>
    <div class="range-row">
      <label>
        <span class="mini">From</span>
        <input type="date" bind:value={startDate} />
      </label>
      <label>
        <span class="mini">To</span>
        <input type="date" bind:value={endDate} />
      </label>
    </div>
    <p class="hint">{dayCount} day{dayCount === 1 ? '' : 's'} in range</p>

    {#if isBinary}
      <span class="field-label">Value</span>
      <p class="hint">{valueHint}</p>
      {#if linkedHabits.length > 0}
        <div class="mode-chips">
          <button type="button" class:active={valueMode === 'STANDARD'} onclick={() => valueMode = 'STANDARD'}>Complete</button>
          <button type="button" class:active={valueMode === 'LINKED'} onclick={() => valueMode = 'LINKED'}>From linked habit</button>
        </div>
        {#if valueMode === 'LINKED'}
          <label class="value-field">
            <span class="mini">Linked habit</span>
            <select bind:value={linkHabitId}>
              {#each linkedHabits as lh (lh.id)}
                <option value={lh.id}>{lh.title}</option>
              {/each}
            </select>
          </label>
        {/if}
        <p class="hint">Copies each day's value from one linked habit. Days it has no entry are skipped.</p>
      {/if}
    {:else}
      <span class="field-label">Value</span>
      <div class="mode-chips">
        <button type="button" class:active={valueMode === 'STANDARD'} onclick={() => valueMode = 'STANDARD'}>Minimum</button>
        {#if hasTarget}
          <button type="button" class:active={valueMode === 'TARGET'} onclick={() => valueMode = 'TARGET'}>Stretch goal</button>
        {/if}
        <button type="button" class:active={valueMode === 'VALUE'} onclick={() => valueMode = 'VALUE'}>Custom value</button>
        {#if linkedHabits.length > 0}
          <button type="button" class:active={valueMode === 'LINKED'} onclick={() => valueMode = 'LINKED'}>Linked habit</button>
        {/if}
      </div>
      {#if valueMode === 'VALUE'}
        {#if habit.type === 'duration'}
          <label class="value-field">
            <span class="mini">Duration</span>
            <DurationField bind:value={durationSecs} placeholder="e.g. 30:00" />
          </label>
        {:else}
          <label class="value-field">
            <span class="mini">Value{unit ? ` (${unit})` : ''}</span>
            <input type="number" bind:value={quantity} min="0" step="any" />
          </label>
        {/if}
      {:else if valueMode === 'LINKED'}
        <label class="value-field">
          <span class="mini">Linked habit</span>
          <select bind:value={linkHabitId}>
            {#each linkedHabits as lh (lh.id)}
              <option value={lh.id}>{lh.title}</option>
            {/each}
          </select>
        </label>
      {/if}
      <p class="hint">{valueHint}</p>
    {/if}

    {#if otherHabits.length > 0}
      <div class="section">
        <span class="field-label">Only on days when</span>
        <div class="cond-mode">
          <button type="button" class:active={condMode === 'and'} onclick={() => condMode = 'and'}>All of them</button>
          <button type="button" class:active={condMode === 'or'} onclick={() => condMode = 'or'}>Any of them</button>
        </div>
        <div class="chip-row">
          {#each otherHabits as h (h.id)}
            <button type="button" class="chip" class:selected={condIds.includes(h.id)} onclick={() => toggleCond(h.id)}>{h.title}</button>
          {/each}
        </div>
        <p class="hint">Skip a day unless the chosen habits reached their minimum that day.</p>
      </div>
    {/if}

    <div class="section">
      <span class="field-label">Skip days</span>
      <span class="mini block">Days of the week</span>
      <div class="chip-row">
        {#each WEEKDAYS as w (w.key)}
          <button type="button" class="chip" class:selected={skipWeekdays.includes(w.key)} onclick={() => toggleWeekday(w.key)}>{w.label}</button>
        {/each}
      </div>

      <span class="mini block">Specific days</span>
      <div class="date-add-row">
        <input type="date" bind:value={newSkipDate} min={startDate} max={endDate} />
        <button type="button" class="add-btn" onclick={addSkipDate} disabled={!newSkipDate}>Add</button>
      </div>
      {#if skipDates.length > 0}
        <div class="chip-row">
          {#each skipDates as d (d)}
            <button type="button" class="chip selected" onclick={() => removeSkipDate(d)}>
              {d} <span class="chip-x">×</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="toggle-row">
        <span>Days already logged</span>
        <input type="checkbox" class="switch" bind:checked={skipLogged} aria-label="Skip days already logged" />
      </div>
      <p class="hint">Skip days that already have a logged value, even if below the backfill value.</p>

      <div class="toggle-row">
        <span>Days already at or above the value</span>
        <input type="checkbox" class="switch" bind:checked={skipAtOrAbove} aria-label="Skip days already at or above the value" />
      </div>
      <p class="hint">Skip days whose existing value already meets the backfill value.</p>
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="btn btn-secondary" onclick={handleClose}>Cancel</button>
      <button type="button" class="btn" onclick={submit} disabled={busy}>
        {busy ? 'Filling in…' : `Fill in ${dayCount} day${dayCount === 1 ? '' : 's'}`}
      </button>
    </div>
  {/if}
</Modal>

<style>
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-right: calc(-1 * var(--space-2));
  }

  .modal-head h2 {
    margin: 0;
  }

  .habit-line {
    margin: 2px 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .habit-line strong {
    color: var(--text);
    font-weight: 600;
  }

  .field-label {
    display: block;
    margin: var(--space-4) 0 6px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
  }

  .mini {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-2);
  }

  .mini.block {
    display: block;
    margin: var(--space-3) 0 6px;
  }

  .range-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .range-row label,
  .value-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .value-field {
    margin-top: var(--space-3);
  }

  .hint {
    margin-top: 6px;
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .mode-chips,
  .cond-mode {
    display: flex;
    flex-wrap: wrap;
    padding: 2px;
    border-radius: 10px;
    background: var(--surface-3);
    margin-bottom: var(--space-2);
  }

  .mode-chips button,
  .cond-mode button {
    flex: 1;
    min-height: 32px;
    padding: 0 var(--space-2);
    border-radius: 8px;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
    white-space: nowrap;
  }

  .mode-chips button.active,
  .cond-mode button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: inset 0 0 0 1px var(--separator);
  }

  .chip.selected {
    background: var(--accent-soft);
    color: var(--accent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .chip-x {
    color: var(--text-3);
  }

  .section {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--separator-strong);
  }

  .date-add-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .add-btn {
    flex-shrink: 0;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--accent);
    font-weight: 600;
  }

  .add-btn:disabled {
    color: var(--text-3);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .toggle-row + .hint {
    margin: 6px var(--space-4) 0;
  }

  .form-error {
    margin-top: var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-sm);
  }

  .done-box {
    padding: var(--space-5) var(--space-4);
    border-radius: var(--radius);
    background: var(--success-soft);
    text-align: center;
  }

  .done-title {
    font-weight: 600;
    color: var(--success);
    margin-bottom: 4px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }
</style>
