<script lang="ts">
  import type { Habit } from '../types';
  import { getEntry } from '../services/storage';
  import { HabitEngine } from '../services/habitEngine';
  import { getLocalDateString } from '../lib/dates';
  import { updateHabit } from '../stores/habits';
  import { timerStates, setTimerState, clearTimerState, defaultTimer, type AllTimers } from '../lib/timerStore';
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';
  import { pluralizeUnit } from '../lib/units';
  import { formatHms } from '../lib/duration';
  import { isStandardMet } from '../lib/thresholds';
  import { fireHabitStart } from '../services/webhooks';
  import ProgressRing from './ProgressRing.svelte';

  let { habit, date = getLocalDateString() }: { habit: Habit; date?: string } = $props();

  let entryValue = $state(0);

  onMount(async () => {
    const e = await getEntry(habit.id, date);
    entryValue = e?.value ?? 0;
  });

  let standardMet = $derived(isStandardMet(habit, entryValue));
  let unitLabel = $derived(habit.unit ? pluralizeUnit(habit.unit, Math.round(entryValue)) : '');

  // Progress ring: a full revolution = the standard goal.
  let targetSec = $derived(habit.target ?? null);
  let ringRev = $derived(habit.standard > 0 ? habit.standard : (habit.type === 'duration' ? 3600 : 10));

  function pauseIfRunning() {
    if (timer.running && !timer.paused) pauseTimer();
  }
  function handleRingChange(v: number) {
    log(v);
    const s = allTimerStates[habit.id];
    if (s && (s.running || s.paused)) {
      setTimerState(habit.id, { ...s, elapsed: v, pausedElapsed: v });
    }
  }

  async function log(value: number) {
    const v = Math.max(0, value);
    entryValue = v;
    try { await HabitEngine.logCompletion(habit, date, v); } catch (e) { console.error('log error:', e); }
  }

  // ---- Binary ----
  async function toggleBinary() {
    await log(entryValue === 1 ? 0 : 1);
  }

  // ---- Default steppers ----
  function baseStep(): number {
    return habit.type === 'duration' ? 60 : 1; // 1 count for quantity, 1 minute of seconds for duration
  }
  async function inc() { await log(entryValue + baseStep()); }
  async function dec() { await log(entryValue - baseStep()); }

  // ---- Custom quick steps ----
  type QuickStep = { value: number; label?: string };
  let steps = $state<QuickStep[]>([...(habit.metadata?.quickSteps ?? [])].map(v => typeof v === 'number' ? { value: v } : v));
  let stepInput = $state('');
  let stepLabel = $state('');
  let stepUnit = $state<'min' | 'sec'>('min');
  let stepSign = $state<'inc' | 'dec'>('inc');
  let showAddStep = $state(false);
  let editSteps = $state(false);
  let editingStepIdx = $state<number | null>(null);

  // Sorted steps: ascending by value (negative first, then positive)
  let sortedSteps = $derived([...steps].sort((a, b) => a.value - b.value));

  function persistSteps(next: QuickStep[]) {
    steps = next;
    updateHabit({ ...habit, metadata: { ...habit.metadata, quickSteps: next } });
  }
  function handleAddStep() {
    const n = parseInt(stepInput);
    if (isNaN(n) || n <= 0) return;
    const amt = habit.type === 'duration' ? (stepUnit === 'min' ? n * 60 : n) : n;
    persistSteps([...steps, { value: stepSign === 'dec' ? -amt : amt, label: stepLabel.trim() || undefined }]);
    stepInput = '';
    stepLabel = '';
    showAddStep = false;
  }
  function removeStep(i: number) {
    persistSteps(steps.filter((_, idx) => idx !== i));
  }

  function startEditStep(idx: number) {
    editingStepIdx = idx;
    const step = steps[idx];
    stepInput = String(Math.abs(step.value));
    stepLabel = step.label ?? '';
    stepSign = step.value < 0 ? 'dec' : 'inc';
    stepUnit = 'min';
    showAddStep = false;
  }

  function saveEditStep() {
    if (editingStepIdx === null) return;
    const n = parseInt(stepInput);
    if (isNaN(n) || n <= 0) return;
    const amt = habit.type === 'duration' ? (stepUnit === 'min' ? n * 60 : n) : n;
    persistSteps(steps.map((s, i) => i === editingStepIdx ? { value: stepSign === 'dec' ? -amt : amt, label: stepLabel.trim() || undefined } : s));
    editingStepIdx = null;
    stepInput = '';
    stepLabel = '';
  }

  function cancelEditStep() {
    editingStepIdx = null;
    stepInput = '';
    stepLabel = '';
  }

  async function applyStep(sec: number) {
    await log(entryValue + sec);
  }
  function fmtStep(v: number): string {
    const sign = v < 0 ? '−' : '+';
    const abs = Math.abs(v);
    if (habit.type === 'quantity') return sign + abs;
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    if (m > 0 && s > 0) return `${sign}${m}m ${s}s`;
    if (m > 0) return `${sign}${m}m`;
    return `${sign}${s}s`;
  }

  // ---- Duration timer ----
  let allTimerStates = $state<AllTimers>({});
  let unsubTimer = timerStates.subscribe(v => allTimerStates = v);
  let timer = $derived(allTimerStates[habit.id] ?? defaultTimer);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function tick() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    if (!s.running || s.paused || s.startedAt === 0) {
      // A stray interval (e.g. from the habit row still mounted behind the
      // modal) must not keep accumulating with startedAt=0, which produces
      // now-since-epoch. Self-cancel instead.
      stopInterval();
      return;
    }
    setTimerState(habit.id, { ...s, elapsed: s.pausedElapsed + Math.floor((Date.now() - s.startedAt) / 1000) });
  }
  function startInterval() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 200);
  }
  function stopInterval() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function startTimer() {
    const initial = Math.round(entryValue);
    setTimerState(habit.id, { running: true, paused: false, elapsed: initial, pausedElapsed: initial, startedAt: Date.now() });
    startInterval();
    fireHabitStart(habit, date, initial);
  }
  function pauseTimer() {
    stopInterval();
    const s = allTimerStates[habit.id];
    if (!s) return;
    setTimerState(habit.id, { ...s, paused: true, pausedElapsed: s.elapsed, startedAt: 0 });
  }
  function resumeTimer() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    setTimerState(habit.id, { ...s, paused: false, startedAt: Date.now() });
    startInterval();
  }
  function doneTimer() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    stopInterval();
    const seconds = s.elapsed;
    clearTimerState(habit.id);
    log(seconds);
  }
  function cancelTimer() {
    stopInterval();
    clearTimerState(habit.id);
  }
  async function resetValue() {
    stopInterval();
    clearTimerState(habit.id);
    await log(0);
  }

  onMount(() => {
    if (timer.running && !timer.paused) startInterval();
  });
  onDestroy(() => {
    unsubTimer();
    stopInterval();
  });

  let totalSec = $derived(timer.running ? timer.elapsed : Math.round(entryValue));
  let dispH = $derived(Math.floor(totalSec / 3600));
  let dispM = $derived(Math.floor((totalSec % 3600) / 60));
  let dispS = $derived(totalSec % 60);
  function pad(n: number): string { return String(n).padStart(2, '0'); }
</script>

<div class="log-tab">
  {#if habit.type === 'binary'}
    <button
      class="dial binary"
      class:checked={entryValue === 1}
      class:met={standardMet}
      class:empty={entryValue === 0}
      onclick={toggleBinary}
      aria-label={entryValue === 1 ? 'Mark not done' : 'Mark done'}
    >
      {#if entryValue === 1}
        <Icon icon="mdi:check" />
      {/if}
    </button>
  {:else}
    <div
      class="dial"
      class:met={standardMet}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <ProgressRing
        value={habit.type === 'quantity' ? entryValue : (timer.running ? timer.elapsed : entryValue)}
        rev={ringRev}
        dragRev={habit.type === 'quantity' ? Math.max(ringRev, 15) : ringRev}
        target={targetSec}
        uid={habit.id}
        onchange={handleRingChange}
        ondragstart={habit.type === 'duration' ? pauseIfRunning : undefined}
      />
      {#if habit.type === 'quantity'}
        <span class="dial-num">{Math.round(entryValue)}</span>
        {#if habit.unit}<span class="dial-unit">{unitLabel}</span>{/if}
        <div class="dial-actions">
          {#if entryValue > 0}
            <button class="act reset" onclick={resetValue} aria-label="Reset to 0"><Icon icon="mdi:rotate-left" /></button>
          {/if}
        </div>
      {:else}
        <span class="dial-time">
          {#if dispH > 0}{pad(dispH)}:{/if}{pad(dispM)}:{pad(dispS)}
        </span>
        <div class="dial-actions">
          {#if (timer.running ? timer.elapsed : entryValue) > 0}
            <button class="act reset" onclick={resetValue} aria-label="Reset to 0"><Icon icon="mdi:rotate-left" /></button>
          {/if}
          {#if timer.running}
            {#if timer.paused}
              <button class="act play" onclick={resumeTimer} aria-label="Resume"><Icon icon="mdi:play" /></button>
            {:else}
              <button class="act pause" onclick={pauseTimer} aria-label="Pause"><Icon icon="mdi:pause" /></button>
            {/if}
            <button class="act done" onclick={doneTimer} aria-label="Done"><Icon icon="mdi:check" /></button>
            <button class="act cancel" onclick={cancelTimer} aria-label="Cancel"><Icon icon="mdi:close" /></button>
          {:else}
            <button class="act play" onclick={startTimer} aria-label="Start"><Icon icon="mdi:play" /></button>
          {/if}
        </div>
      {/if}
      <div class="dial-hint">{habit.type === 'quantity' ? 'swipe to change' : 'swipe to adjust'}</div>
    </div>
  {/if}

  {#if habit.type !== 'binary'}
    <div class="stepper">
      <div class="stepper-default">
        <button class="step-btn step-default minus" onclick={dec} aria-label="Decrease"><Icon icon="mdi:minus" /></button>
        <button class="step-btn step-default plus" onclick={inc} aria-label="Increase"><Icon icon="mdi:plus" /></button>
      </div>
      <div class="stepper-custom">
        <div class="stepper-custom-header">
          <span>Quick steps</span>
          <button class="edit-toggle" onclick={() => editSteps = !editSteps} aria-label={editSteps ? 'Done editing' : 'Edit steps'}>
            <Icon icon={editSteps ? 'mdi:check' : 'mdi:pencil'} />
          </button>
        </div>
        {#each sortedSteps as step (step.value)}
          <div class="step-wrap">
            {#if editingStepIdx === steps.indexOf(step)}
              <div class="add-step">
                <button class="sign-toggle" onclick={() => stepSign = stepSign === 'inc' ? 'dec' : 'inc'} aria-label="Toggle sign">{stepSign === 'inc' ? '+' : '−'}</button>
                <input type="number" min="1" placeholder={habit.type === 'duration' ? 'e.g. 5' : 'e.g. 3'} bind:value={stepInput} onkeydown={(e) => { if (e.key === 'Enter') saveEditStep(); if (e.key === 'Escape') cancelEditStep(); }} />
                {#if habit.type === 'duration'}
                  <select bind:value={stepUnit}>
                    <option value="min">min</option>
                    <option value="sec">sec</option>
                  </select>
                {/if}
                <input type="text" placeholder="Label (optional)" bind:value={stepLabel} />
                <button class="add-ok" onclick={saveEditStep}>Save</button>
                <button class="step-btn add-close" onclick={cancelEditStep} aria-label="Cancel"><Icon icon="mdi:close" /></button>
              </div>
            {:else}
              <button class="step-btn custom" onclick={() => editSteps ? startEditStep(steps.indexOf(step)) : applyStep(step.value)}>
                {step.label ? step.label : fmtStep(step.value)}
              </button>
              {#if editSteps}
                <button class="step-del" aria-label="Remove step" onclick={() => removeStep(steps.indexOf(step))}>×</button>
              {/if}
            {/if}
          </div>
        {/each}
        {#if !showAddStep && editingStepIdx === null}
          <button class="step-fab" onclick={() => showAddStep = true} aria-label="Add custom step"><Icon icon="mdi:bookmark-plus-outline" /></button>
        {:else if showAddStep || editingStepIdx !== null}
          <div class="add-step">
            <button class="sign-toggle" onclick={() => stepSign = stepSign === 'inc' ? 'dec' : 'inc'} aria-label="Toggle sign">{stepSign === 'inc' ? '+' : '−'}</button>
            <input type="number" min="1" placeholder={habit.type === 'duration' ? 'e.g. 5' : 'e.g. 3'} bind:value={stepInput} onkeydown={(e) => { if (e.key === 'Enter') handleAddStep(); }} />
            {#if habit.type === 'duration'}
              <select bind:value={stepUnit}>
                <option value="min">min</option>
                <option value="sec">sec</option>
              </select>
            {/if}
            <input type="text" placeholder="Label (optional)" bind:value={stepLabel} />
            <button class="add-ok" onclick={editingStepIdx !== null ? saveEditStep : handleAddStep}>{editingStepIdx !== null ? 'Save' : 'Add'}</button>
            <button class="step-btn add-close" onclick={() => { showAddStep = false; editingStepIdx = null; stepInput = ''; stepLabel = ''; }} aria-label="Cancel"><Icon icon="mdi:close" /></button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="status">
    <span class="status-dot" class:met={standardMet}></span>
    <span>{standardMet ? 'Standard met' : 'Not at standard'} · standard {habit.type === 'duration' ? formatHms(habit.standard) : habit.standard + (habit.unit ? ' ' + pluralizeUnit(habit.unit, habit.standard) : '')}</span>
  </div>
</div>

<style>
  .log-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 0.5rem 0 0.25rem;
  }
  .dial {
    position: relative;
    width: 230px;
    height: 230px;
    border-radius: 50%;
    background: var(--input-bg, #f5f5f5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    box-sizing: border-box;
    color: var(--text-primary, #222);
  }
  .dial.met {
    background: rgba(46, 125, 50, 0.08);
    color: #2e7d32;
  }
  .dial-num {
    font-size: 4rem;
    font-weight: 800;
    line-height: 1;
  }
  .dial-unit {
    font-size: 0.9rem;
    color: var(--text-secondary, #888);
    max-width: 90%;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dial-time {
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .dial-hint {
    position: absolute;
    bottom: 10px;
    font-size: 0.6rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-secondary, #999);
  }
  .dial.binary {
    cursor: pointer;
    border: none;
    background: var(--input-bg, #f5f5f5);
  }
  .dial.binary :global(svg), .dial.binary :global(.iconify) {
    font-size: 7rem;
    color: #2e7d32;
  }
  .dial.binary.checked.met { background: rgba(46, 125, 50, 0.15); }
  .dial-actions {
    position: relative;
    z-index: 3;
    display: flex;
    gap: 0.5rem;
    margin-top: 0.15rem;
    touch-action: none;
  }
  .dial-actions .act {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    box-sizing: border-box;
  }
  .dial-actions .act :global(svg), .dial-actions .act :global(.iconify) { font-size: 1.3rem; }
  .dial-actions .act.play { background: #0066cc; }
  .dial-actions .act.pause { background: #f59e0b; }
  .dial-actions .act.done { background: #2e7d32; }
  .dial-actions .act.cancel { background: #d32f2f; }
  .dial-actions .act.reset { background: #757575; }
  .stepper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }
  .stepper-default {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .stepper-custom {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .step-btn {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 1px solid var(--card-border, #ccc);
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    font-weight: 700;
  }
  .step-btn:disabled { opacity: 0.4; }
  .step-default { width: 3.75rem; height: 3.75rem; }
  .step-default :global(svg), .step-default :global(.iconify) { font-size: 1.8rem; }
  .step-btn.custom { width: auto; min-width: 2.6rem; height: 2.6rem; padding: 0 0.6rem; border-radius: 999px; font-size: 0.9rem; }
  .step-btn :global(svg), .step-btn :global(.iconify) { font-size: 1.4rem; }
  .step-fab {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    border: 1px dashed var(--card-border, #ccc);
    background: transparent;
    color: var(--text-secondary, #888);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .step-fab :global(svg), .step-fab :global(.iconify) { font-size: 1.3rem; }
  .step-wrap { position: relative; }
  .step-del {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
    border: none;
    background: #d32f2f;
    color: #fff;
    font-size: 0.7rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .add-step {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .add-step input, .add-step select {
    width: 4.5rem;
    padding: 0.35rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 0.9rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
  }
  .add-step select { width: 3.6rem; }
  .sign-toggle {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: 1px solid var(--card-border, #ccc);
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .add-ok { width: auto; padding: 0 0.7rem; height: 2.2rem; border-radius: 999px; background: var(--accent, #0066cc); color: var(--accent-text, #fff); border: none; font-weight: 600; cursor: pointer; }
  .step-btn.add-close { width: 1.9rem; height: 1.9rem; background: transparent; border: none; }
  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
  }
  .status-dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: var(--card-border, #ccc);
  }
  .status-dot.met { background: #2e7d32; }
  .stepper-custom-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 400px;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
  }
  .edit-toggle {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 1px solid var(--card-border, #ccc);
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .edit-toggle:hover {
    background: var(--accent, #0066cc);
    color: var(--accent-text, #fff);
    border-color: var(--accent, #0066cc);
  }
  .edit-toggle :global(svg), .edit-toggle :global(.iconify) { font-size: 1.1rem; }
  .step-edit {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
    max-width: 200px;
  }
  .step-edit input {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--accent, #0066cc);
    border-radius: 0;
    font-size: 0.9rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
  }
  .edit-save, .edit-cancel {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .edit-save {
    background: var(--accent, #0066cc);
    color: var(--accent-text, #fff);
  }
  .edit-cancel {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }
  .edit-save:hover { opacity: 0.85; }
  .edit-cancel:hover { background: var(--btn-secondary-hover, #ddd); }
  .edit-save :global(svg), .edit-cancel :global(svg), .edit-save :global(.iconify), .edit-cancel :global(.iconify) { font-size: 1rem; }
</style>