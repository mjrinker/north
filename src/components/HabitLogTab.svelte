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
  import { habitColorVars } from '../lib/color';

  let { habit, date = getLocalDateString() }: { habit: Habit; date?: string } = $props();

  let entryValue = $state(0);

  onMount(async () => {
    const e = await getEntry(habit.id, date);
    entryValue = e?.value ?? 0;
  });

  let standardMet = $derived(isStandardMet(habit, entryValue));
  let isBreak = $derived(habit.metadata?.category === 'break');
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

<div class="log-tab" style={habitColorVars(habit.metadata?.color)}>
  {#if habit.type === 'binary'}
    <button
      class="dial binary"
      class:checked={isBreak || entryValue === 1}
      class:slip={isBreak && entryValue === 1}
      class:met={standardMet}
      class:empty={entryValue === 0}
      onclick={toggleBinary}
      aria-label={isBreak ? (entryValue === 1 ? 'Undo slip' : 'Log a slip') : (entryValue === 1 ? 'Mark not done' : 'Mark done')}
    >
      {#if isBreak}
        <Icon icon={entryValue === 1 ? 'mdi:close' : 'mdi:check'} />
      {:else if entryValue === 1}
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
      <div class="dial-hint">Drag the ring to adjust</div>
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
                <button class="add-ok" onclick={saveEditStep} aria-label="Save"><Icon icon="mdi:check" /></button>
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
        {:else if showAddStep}
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
            <button class="add-ok" onclick={handleAddStep}>Add</button>
            <button class="step-btn add-close" onclick={() => { showAddStep = false; stepInput = ''; stepLabel = ''; }} aria-label="Cancel"><Icon icon="mdi:close" /></button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="status">
    <span class="status-dot" class:met={standardMet}></span>
    <span>{standardMet ? 'Minimum reached' : 'Below minimum'} · minimum {habit.type === 'duration' ? formatHms(habit.standard) : habit.standard + (habit.unit ? ' ' + pluralizeUnit(habit.unit, habit.standard) : '')}</span>
  </div>
</div>

<style>
  .log-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-2) 0;
  }

  .dial {
    position: relative;
    width: 232px;
    height: 232px;
    border-radius: 50%;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    color: var(--text);
  }

  .dial.met {
    color: var(--habit-ink);
  }

  .dial-num {
    font-size: 56px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .dial-unit {
    font-size: var(--text-sm);
    color: var(--text-2);
    max-width: 70%;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dial-time {
    font-size: 36px;
    font-weight: 650;
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  .dial-hint {
    position: absolute;
    bottom: -28px;
    font-size: var(--text-xs);
    color: var(--text-3);
  }

  .dial.binary {
    cursor: pointer;
    border: 3px solid var(--separator-strong);
    transition: background 0.2s, border-color 0.2s, transform 0.1s var(--ease);
  }

  .dial.binary:active {
    transform: scale(0.97);
  }

  .dial.binary.checked {
    background: var(--habit);
    border-color: var(--habit);
  }

  .dial.binary.slip {
    background: var(--danger);
    border-color: var(--danger);
  }

  .dial.binary :global(svg) {
    font-size: 96px;
    color: var(--habit-on);
  }

  .dial.binary.slip :global(svg) {
    color: #fff;
  }

  .dial-actions {
    position: relative;
    z-index: 3;
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-1);
    touch-action: none;
  }

  .dial-actions .act {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: var(--surface-2);
    color: var(--text);
  }

  .dial-actions .act.play,
  .dial-actions .act.pause { background: var(--habit); color: var(--habit-on); }
  .dial-actions .act.done { background: var(--success-soft); color: var(--success); }
  .dial-actions .act.cancel { color: var(--danger); }
  .dial-actions .act.reset { color: var(--text-2); }

  .stepper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
  }

  .stepper-default {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .stepper-custom {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    width: 100%;
  }

  .stepper-custom-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  .step-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .step-btn:active:not(:disabled) { background: var(--surface-2); }
  .step-btn:disabled { opacity: 0.4; }
  .step-default { width: 56px; height: 56px; font-size: 26px; }
  .step-btn.custom { width: auto; min-width: 48px; height: 36px; padding: 0 var(--space-3); border-radius: 999px; font-size: var(--text-sm); }
  .step-btn :global(svg) { font-size: 22px; }

  .step-fab {
    height: 36px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    border: 1px dashed var(--separator-strong);
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .step-wrap { position: relative; }

  .step-del {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--danger);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    display: grid;
    place-items: center;
  }

  .add-step {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: center;
  }

  .log-tab .add-step input,
  .log-tab .add-step select {
    width: 76px;
    min-height: 36px;
    padding: 6px var(--space-2);
    font-size: 15px;
  }

  .log-tab .add-step input[type='text'] { width: 132px; }
  .log-tab .add-step select { width: 72px; padding-right: 24px; background-position: right 8px center; }

  .sign-toggle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
    font-size: 18px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .add-ok {
    height: 36px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  .step-btn.add-close { width: 32px; height: 32px; background: transparent; color: var(--text-2); }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--surface-3);
  }

  .status-dot.met { background: var(--success); }

  .edit-toggle {
    height: 30px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    font-size: 18px;
  }
</style>
