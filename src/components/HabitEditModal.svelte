<script lang="ts">
  import type { Habit, HabitCategory, HabitWebhooks, HabitShortcuts } from '../types';
  import { updateHabit, setLinkedHabits } from '../stores/habits';
  import { isHabitPaused } from '../lib/habitUtils';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyDropdownPicker from './DependencyDropdownPicker.svelte';
  import LinkedDropdownPicker from './LinkedDropdownPicker.svelte';
  import ModalActions from './ModalActions.svelte';
  import HabitColorPicker from './HabitColorPicker.svelte';
  import HabitIconPicker from './HabitIconPicker.svelte';
  import HabitWebhookSection from './HabitWebhookSection.svelte';
  import HabitShortcutSection from './HabitShortcutSection.svelte';
  import DurationField from './DurationField.svelte';
  import HabitLogTab from './HabitLogTab.svelte';
  import Icon from '@iconify/svelte';

  let {
    habit,
    allHabits = [] as Habit[],
    onClose
  }: {
    habit: Habit;
    allHabits: Habit[];
    onClose: () => void;
  } = $props();

  let title = $state(habit.title);
  let tab = $state<'log' | 'settings'>('log');
  let description = $state(habit.description ?? '');
  let standard = $state(habit.standard);
  let target = $state<number | undefined>(habit.target);
  let type = $state<Habit['type']>(habit.type);
  let errorMsg = $state('');
  let depIds = $state<string[]>(habit.dependsOn?.habitIds ?? []);
  let depMode = $state<'and' | 'or'>(habit.dependsOn?.mode ?? 'and');
  let linkIds = $state<string[]>([...(habit.linkedHabitIds ?? [])]);
  let frequency = $state(habit.schedule.frequency);
  let interval = $state(habit.schedule.interval);
  let habitTags = $state<string[]>(habit.tags ?? []);
  let existingTags = $derived(Array.from(new Set(allHabits.flatMap(h => h.tags ?? []))));
  let showStandard = $derived(type !== 'binary');
  let showDeps = $derived(type === 'binary' && allHabits.filter(h => h.id !== habit.id).length > 0);
  let linkCandidates = $derived(allHabits.filter(h => h.id !== habit.id && h.type === type && h.status !== 'deleted'));

  let category = $state<HabitCategory>(habit.metadata?.category ?? 'build');
  let color = $state(habit.metadata?.color ?? '');
  let icon = $state(habit.metadata?.icon ?? '');
  let emoji = $state(habit.metadata?.emoji ?? '');
  let webhooks = $state<HabitWebhooks>(habit.webhooks ?? {});
  let shortcuts = $state<HabitShortcuts>(habit.shortcuts ?? {});
  let unit = $state(habit.unit || (habit.type === 'duration' ? 'second' : 'time'));
  let startOfWeek = $state(habit.schedule.startOfWeek ?? 1);
  let showStartOfWeek = $derived(frequency === 'weekly' || frequency === 'days_per_week');

  let paused = $state(isHabitPaused(habit));
  let pauseMode = $state(habit.metadata?.pauseUntil ? 'until' : 'indefinite');
  let pauseUntilDate = $state(habit.metadata?.pauseUntil ?? '');
  let hidden = $state(!!habit.metadata?.hidden);
  let advancedOpen = $state(false);

  function handleSave() {
    if (type !== 'binary') {
      if (category === 'break' && standard < (target ?? 0)) {
        errorMsg = 'For a Break habit, Standard must be higher than Target.';
        return;
      }
      if (category === 'build' && standard > (target ?? 0)) {
        errorMsg = 'For a Build habit, Standard must be lower than Target.';
        return;
      }
    }
    errorMsg = '';
    const dependsOn = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
    const effectiveLinks = linkIds.filter(id => allHabits.find(h => h.id === id)?.type === type);
    let status = habit.status;
    if (paused) status = 'paused';
    else if (habit.status === 'paused') status = 'active';
    const updated: Habit = {
      ...habit,
      title,
      description: description.trim() || undefined,
      standard,
      target: type !== 'binary' ? target : undefined,
      type,
      unit: unit.trim() || (type === 'duration' ? 'seconds' : 'times'),
      dependsOn,
      linkedHabitIds: effectiveLinks.length ? [...effectiveLinks] : undefined,
      tags: habitTags,
      status,
      webhooks,
      shortcuts,
      metadata: {
        ...habit.metadata,
        hidden: hidden || undefined,
        category,
        color: color || undefined,
        icon: icon || undefined,
        emoji: emoji || undefined,
        pauseUntil: paused ? (pauseMode === 'until' ? pauseUntilDate || undefined : undefined) : undefined,
      },
      schedule: { ...habit.schedule, frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'days_per_week', interval, daysPerWeek: frequency === 'days_per_week' ? interval : undefined, startOfWeek }
    };
    updateHabit(updated);
    if (effectiveLinks.length || habit.linkedHabitIds?.length) setLinkedHabits(updated, effectiveLinks);
    onClose();
  }

  function handleDelete() {
    const updated: Habit = { ...habit, status: 'deleted', updatedAt: new Date(), linkedHabitIds: undefined };
    updateHabit(updated);
    onClose();
  }
</script>

<Modal {onClose}>
  <div class="modal-head">
    <h2>{habit.title}</h2>
    <button class="modal-close" onclick={onClose} aria-label="Close">×</button>
  </div>
  <div class="tabs" role="tablist">
    <button class:active={tab === 'log'} onclick={() => tab = 'log'} role="tab">Log</button>
    <button class:active={tab === 'settings'} onclick={() => tab = 'settings'} role="tab">Settings</button>
  </div>

  {#if tab === 'log'}
    <HabitLogTab {habit} />
  {:else}
  <div class="form-grid">
    <label>Title <input bind:value={title} /></label>

    <label>Description (supports Markdown)
      <textarea bind:value={description} class="desc-input" placeholder="Add details about this habit..."></textarea>
    </label>

    <div class="form-row">
      <label>Color
        <HabitColorPicker bind:color />
      </label>
      <label>Icon
        <HabitIconPicker bind:icon bind:emoji />
      </label>
    </div>

    <div class="form-row">
      <label>Category
        <select bind:value={category}>
          <option value="build">Build</option>
          <option value="break">Break</option>
        </select>
      </label>
      <label>Type
        <select bind:value={type}>
          <option value="binary">Binary (Done / Not Done)</option>
          <option value="quantity">Quantity (Count)</option>
          <option value="duration">Duration (Time)</option>
        </select>
      </label>
    </div>

    {#if showStandard}
      <label>Unit <input type="text" bind:value={unit} placeholder={type === 'duration' ? 'seconds' : 'singular, e.g. cup'} /></label>

      <div class="section-header">Goals</div>
      <div class="form-row">
        <label>Minimum
          {#if type === 'duration'}
            <DurationField bind:value={standard} placeholder="e.g. 5:00" />
          {:else}
            <input type="number" bind:value={standard} min="1" />
          {/if}
        </label>
        <label>Stretch goal
          {#if type === 'duration'}
            <DurationField bind:value={target} placeholder="e.g. 1:00:00" />
          {:else}
            <input type="number" bind:value={target} min="1" />
          {/if}
        </label>
      </div>
    {/if}

    <div class="form-row">
      <label>Frequency
        <select bind:value={frequency}>
          <option value="daily">Daily</option>
          <option value="days_per_week">X Days/Week</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Every X Days</option>
        </select>
      </label>
      <label>Interval
        {#if frequency === 'days_per_week'}
          <input type="number" bind:value={interval} min="1" max="7" />
        {:else}
          <input type="number" bind:value={interval} min="1" />
        {/if}
      </label>
    </div>

    {#if showStartOfWeek}
      <label>Start of week
        <select bind:value={startOfWeek}>
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </label>
    {/if}

    <div class="advanced-section">
      <button class="advanced-toggle" onclick={() => advancedOpen = !advancedOpen} aria-expanded={advancedOpen}>
        <span>Advanced</span>
        <span class:rotated={advancedOpen}><Icon icon="mdi:chevron-down" /></span>
      </button>

      {#if advancedOpen}
        <div class="advanced-content">
          {#if showDeps}
            <DependencyDropdownPicker habits={allHabits} bind:depIds bind:depMode excludeId={habit.id} />
          {/if}

          <LinkedDropdownPicker habits={linkCandidates} bind:linkedIds={linkIds} excludeId={habit.id} />

          <label class="pause-row">
            <span class="pause-label">Paused</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={paused} />
              <span class="toggle-slider"></span>
            </label>
          </label>
          {#if paused}
            <label>Pause
              <select bind:value={pauseMode}>
                <option value="until">Until a date</option>
                <option value="indefinite">Indefinitely</option>
              </select>
            </label>
            {#if pauseMode === 'until'}
              <label>Pause until <input type="date" bind:value={pauseUntilDate} /></label>
            {/if}
          {/if}

          <label class="pause-row">
            <span class="pause-label">Hidden</span>
            <label class="toggle toggle-hidden">
              <input type="checkbox" bind:checked={hidden} />
              <span class="toggle-slider"></span>
            </label>
          </label>
          <p class="hidden-hint">Hidden habits stay active but are hidden from the Today view until you reveal them.</p>

          <HabitWebhookSection bind:webhooks {type} />

          <HabitShortcutSection bind:shortcuts {type} />
        </div>
      {/if}
    </div>

    <span class="field-label">Tags</span>
    <TagInput bind:tags={habitTags} allTags={existingTags} />

    {#if errorMsg}
      <p class="form-error">{errorMsg}</p>
    {/if}
    <ModalActions onSave={handleSave} onCancel={onClose} onDelete={handleDelete} />
  </div>
  {/if}
</Modal>

<style>
  h2 { margin: 0; color: var(--text-primary, #222); font-size: 1.1rem; }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .modal-close {
    border: none;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--input-bg, #f5f5f5);
    border-radius: 8px;
    padding: 0.25rem;
    margin-bottom: 1rem;
  }
  .tabs button {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-secondary, #666);
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0.5rem;
    border-radius: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .tabs button.active {
    background: var(--card-bg, #fff);
    color: var(--text-primary, #222);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .form-grid { display: flex; flex-direction: column; gap: 0.75rem; }
  .form-error {
    margin: 0.5rem 0 0.75rem;
    padding: 0.5rem;
    border: 1px solid #c62828;
    background: rgba(198, 40, 40, 0.1);
    color: #c62828;
    font-size: 0.85rem;
  }
  label {
    font-weight: 500;
    color: var(--text-primary, #222);
    display: block;
  }
  input, select, .desc-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 1rem;
    box-sizing: border-box;
    margin-top: 0.25rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .desc-input {
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
    font-size: 0.85rem;
    min-height: 4rem;
    resize: vertical;
  }
  .field-label {
    display: block;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .form-row > * { margin-bottom: 0; }
  .form-row > label { display: flex; flex-direction: column; gap: 0.25rem; }
  .pause-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pause-label { font-weight: 500; color: var(--text-primary, #222); }
  .hidden-hint { font-size: 0.75rem; color: var(--text-secondary, #888); margin: -0.4rem 0 0; }
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
  .toggle input:checked + .toggle-slider { background: #f59e0b; }
  .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
  .toggle-hidden input:checked + .toggle-slider { background: var(--accent, #0066cc); }
  .advanced-section {
    margin-top: 0.5rem;
    border-top: 1px solid var(--card-border, #ccc);
    padding-top: 0.75rem;
  }
  .advanced-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0;
    border: none;
    background: none;
    color: var(--accent, #0066cc);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    font-family: inherit;
  }
  .advanced-toggle:hover { color: var(--accent-hover, #0052a3); }
  .advanced-toggle :global(svg) {
    transition: transform 0.2s;
    font-size: 1.2rem;
  }
  .advanced-toggle :global(svg).rotated { transform: rotate(180deg); }
  .section-header {
    margin: 1rem 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .advanced-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
    animation: slideDown 0.2s ease;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
