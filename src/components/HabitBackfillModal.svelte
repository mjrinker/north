<script lang="ts">
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
  let condIds = $state<string[]>(habit.dependsOn?.habitIds ?? []);
  let condMode = $state<'and' | 'or'>(habit.dependsOn?.mode ?? 'and');

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

    busy = true;
    try {
      const res = await backfillHabit({
        habitId: habit.id,
        startDate,
        endDate,
        valueMode,
        value: !isBinary && valueMode === 'VALUE' ? (habit.type === 'duration' ? durationSecs : quantity) : 1,
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
    <h2>Backfill</h2>
    <button class="modal-close" onclick={handleClose} aria-label="Close">×</button>
  </div>

  {#if done}
    <div class="done-box">
      <p class="done-title">Backfill complete</p>
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
    {:else}
      <span class="field-label">Value</span>
      <div class="mode-chips">
        <button type="button" class:active={valueMode === 'STANDARD'} onclick={() => valueMode = 'STANDARD'}>Standard</button>
        {#if hasTarget}
          <button type="button" class:active={valueMode === 'TARGET'} onclick={() => valueMode = 'TARGET'}>Target</button>
        {/if}
        <button type="button" class:active={valueMode === 'VALUE'} onclick={() => valueMode = 'VALUE'}>Custom value</button>
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
      {/if}
      <p class="hint">{valueHint}</p>
    {/if}

    {#if otherHabits.length > 0}
      <div class="section">
        <span class="field-label">Only on days when</span>
        <div class="cond-mode">
          <button type="button" class:active={condMode === 'and'} onclick={() => condMode = 'and'}>All selected complete</button>
          <button type="button" class:active={condMode === 'or'} onclick={() => condMode = 'or'}>Any selected complete</button>
        </div>
        <div class="chip-row">
          {#each otherHabits as h (h.id)}
            <button type="button" class="chip" class:selected={condIds.includes(h.id)} onclick={() => toggleCond(h.id)}>{h.title}</button>
          {/each}
        </div>
        <p class="hint">Skip a day unless the chosen habits met their Standard that day.</p>
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
        <label class="toggle">
          <input type="checkbox" bind:checked={skipLogged} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="hint">Skip days that already have a logged value, even if below the backfill value.</p>

      <div class="toggle-row">
        <span>Days already at or above the value</span>
        <label class="toggle">
          <input type="checkbox" bind:checked={skipAtOrAbove} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="hint">Skip days whose existing value already meets the backfill value.</p>
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="btn-cancel" onclick={handleClose}>Cancel</button>
      <button type="button" class="btn-backfill" onclick={submit} disabled={busy}>
        {busy ? 'Backfilling…' : `Backfill ${dayCount} day${dayCount === 1 ? '' : 's'}`}
      </button>
    </div>
  {/if}
</Modal>

<style>
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  h2 { margin: 0; color: var(--text-primary, #222); font-size: 1.1rem; }
  .modal-close {
    border: none;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
  .habit-line {
    color: var(--text-secondary, #555);
    font-size: 0.9rem;
    margin-bottom: 0.9rem;
  }
  .habit-line strong { color: var(--text-primary, #222); }
  .field-label {
    display: block;
    font-weight: 500;
    color: var(--text-primary, #222);
    margin-bottom: 0.3rem;
  }
  .mini {
    display: block;
    font-size: 0.72rem;
    color: var(--text-secondary, #666);
    margin-bottom: 0.2rem;
  }
  .mini.block { margin-top: 0.75rem; }
  .range-row {
    display: flex;
    gap: 0.6rem;
  }
  .range-row label { flex: 1; }
  input[type='date'],
  input[type='number'] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 0.95rem;
    box-sizing: border-box;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .hint {
    font-size: 0.78rem;
    color: var(--text-secondary, #666);
    margin: 0.3rem 0 0.9rem;
  }
  .section { margin-top: 0.25rem; }
  .mode-chips,
  .cond-mode {
    display: flex;
    gap: 4px;
    margin: 0 0 0.5rem;
  }
  .mode-chips button,
  .cond-mode button {
    flex: 1;
    padding: 0.35rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
    font-family: inherit;
  }
  .mode-chips button.active,
  .cond-mode button.active {
    background: #0066cc;
    color: #fff;
    border-color: #0066cc;
  }
  .value-field { display: block; margin-bottom: 0.4rem; }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 0.25rem;
  }
  .chip {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 999px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
    font-family: inherit;
  }
  .chip.selected {
    background: #0066cc;
    color: #fff;
    border-color: #0066cc;
  }
  .chip-x { margin-left: 0.25rem; opacity: 0.75; }
  .date-add-row {
    display: flex;
    gap: 0.4rem;
  }
  .date-add-row input { flex: 1; }
  .add-btn {
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary, #222);
  }
  .add-btn:disabled { opacity: 0.5; cursor: default; }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }
  .toggle input { display: none; }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--card-border, #ccc);
    border-radius: 999px;
    transition: background 0.2s;
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    left: 3px;
    top: 3px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle input:checked + .toggle-slider { background: #0066cc; }
  .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
  .form-error {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border: 1px solid #c62828;
    background: rgba(198, 40, 40, 0.1);
    color: #c62828;
    font-size: 0.85rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 1rem;
  }
  .btn-cancel,
  .btn-backfill {
    padding: 0.55rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
  }
  .btn-cancel {
    background: transparent;
    color: var(--text-primary, #333);
  }
  .btn-backfill {
    background: #0066cc;
    color: #fff;
    border-color: #0066cc;
  }
  .btn-backfill:disabled { opacity: 0.6; cursor: default; }
  .done-box {
    text-align: center;
    padding: 1rem 0;
  }
  .done-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary, #222);
    margin: 0 0 0.35rem;
  }
  .done-box p { margin: 0 0 0.25rem; color: var(--text-secondary, #555); }
</style>