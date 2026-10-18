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
        errorMsg = 'For a habit you’re breaking, the limit must be higher than the stricter limit.';
        return;
      }
      if (category === 'build' && standard > (target ?? 0)) {
        errorMsg = 'The minimum must be lower than the stretch goal.';
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
    <button class="icon-btn" onclick={onClose} aria-label="Close"><Icon icon="mdi:close" /></button>
  </div>
  <div class="segmented tabs" role="tablist">
    <button class:active={tab === 'log'} onclick={() => tab = 'log'} role="tab" aria-selected={tab === 'log'}>Log</button>
    <button class:active={tab === 'settings'} onclick={() => tab = 'settings'} role="tab" aria-selected={tab === 'settings'}>Edit</button>
  </div>

  {#if tab === 'log'}
    <HabitLogTab {habit} />
  {:else}
  <div class="habit-form">
    <div class="field">
      <label for="edit-title">Name</label>
      <input id="edit-title" bind:value={title} autocomplete="off" />
    </div>

    <div class="field">
      <label for="edit-desc">Notes <span class="hint">Markdown supported</span></label>
      <textarea id="edit-desc" bind:value={description} placeholder="Why it matters, how you’ll do it"></textarea>
    </div>

    <div class="field-row">
      <div class="field">
        <span class="field-label">Color</span>
        <HabitColorPicker bind:color />
      </div>
      <div class="field">
        <span class="field-label">Icon</span>
        <HabitIconPicker bind:icon bind:emoji />
      </div>
    </div>

    <div class="field">
      <span class="field-label">I want to</span>
      <div class="segmented" role="radiogroup" aria-label="Category">
        <button type="button" role="radio" aria-checked={category === 'build'} class:active={category === 'build'} onclick={() => category = 'build'}>Build a habit</button>
        <button type="button" role="radio" aria-checked={category === 'break'} class:active={category === 'break'} onclick={() => category = 'break'}>Break a habit</button>
      </div>
    </div>

    <div class="field">
      <span class="field-label">Track it by</span>
      <div class="segmented" role="radiogroup" aria-label="Type">
        <button type="button" role="radio" aria-checked={type === 'binary'} class:active={type === 'binary'} onclick={() => type = 'binary'}>Check off</button>
        <button type="button" role="radio" aria-checked={type === 'quantity'} class:active={type === 'quantity'} onclick={() => type = 'quantity'}>Count</button>
        <button type="button" role="radio" aria-checked={type === 'duration'} class:active={type === 'duration'} onclick={() => type = 'duration'}>Time</button>
      </div>
    </div>

    {#if showStandard}
      <div class="field-row">
        <div class="field">
          <label for="edit-standard">{category === 'break' ? 'Limit' : 'Minimum'}</label>
          {#if type === 'duration'}
            <DurationField id="edit-standard" bind:value={standard} placeholder="5:00" />
          {:else}
            <input id="edit-standard" type="number" inputmode="numeric" bind:value={standard} min="1" />
          {/if}
        </div>
        <div class="field">
          <label for="edit-target">{category === 'break' ? 'Stricter limit' : 'Stretch goal'}</label>
          {#if type === 'duration'}
            <DurationField id="edit-target" bind:value={target} placeholder="1:00:00" />
          {:else}
            <input id="edit-target" type="number" inputmode="numeric" bind:value={target} placeholder="Optional" min="1" />
          {/if}
        </div>
      </div>
      {#if type === 'quantity'}
        <div class="field">
          <label for="edit-unit">Unit</label>
          <input id="edit-unit" type="text" bind:value={unit} placeholder="singular, e.g. cup" />
        </div>
      {/if}
    {/if}

    <div class="field-row">
      <div class="field">
        <label for="edit-frequency">Repeat</label>
        <select id="edit-frequency" bind:value={frequency}>
          <option value="daily">Every day</option>
          <option value="days_per_week">Days per week</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Every few days</option>
        </select>
      </div>
      {#if frequency !== 'daily'}
        <div class="field">
          <label for="edit-interval">{frequency === 'days_per_week' ? 'Days per week' : frequency === 'weekly' ? 'Every … weeks' : frequency === 'monthly' ? 'Every … months' : 'Every … days'}</label>
          <input id="edit-interval" type="number" inputmode="numeric" bind:value={interval} min="1" max={frequency === 'days_per_week' ? 7 : undefined} />
        </div>
      {/if}
    </div>

    {#if showStartOfWeek}
      <div class="field">
        <label for="edit-sow">Week starts on</label>
        <select id="edit-sow" bind:value={startOfWeek}>
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
          <option value={2}>Tuesday</option>
          <option value={3}>Wednesday</option>
          <option value={4}>Thursday</option>
          <option value={5}>Friday</option>
          <option value={6}>Saturday</option>
        </select>
      </div>
    {/if}

    <div class="field">
      <span class="field-label">Tags</span>
      <TagInput bind:tags={habitTags} allTags={existingTags} />
    </div>

    <div class="group toggles">
      <label class="row">
        <span class="row-label">Paused</span>
        <input type="checkbox" class="switch" bind:checked={paused} />
      </label>
      {#if paused}
        <div class="row">
          <span class="row-label">Pause</span>
          <select bind:value={pauseMode} class="inline-select" aria-label="Pause length">
            <option value="until">Until a date</option>
            <option value="indefinite">Indefinitely</option>
          </select>
        </div>
        {#if pauseMode === 'until'}
          <div class="row">
            <span class="row-label">Resume on</span>
            <input type="date" bind:value={pauseUntilDate} class="inline-select" aria-label="Resume on" />
          </div>
        {/if}
      {/if}
      <label class="row">
        <span class="row-label">Hidden</span>
        <input type="checkbox" class="switch" bind:checked={hidden} />
      </label>
    </div>
    <p class="section-footnote">Hidden habits keep running but stay off Today until you choose “Show hidden”.</p>

    <div class="advanced">
      <button type="button" class="advanced-toggle" onclick={() => advancedOpen = !advancedOpen} aria-expanded={advancedOpen}>
        <span>More options</span>
        <span class="hint">Conditions, linked habits, webhooks, Shortcuts</span>
        <Icon icon="mdi:chevron-down" class="chev {advancedOpen ? 'open' : ''}" />
      </button>

      {#if advancedOpen}
        <div class="advanced-content">
          {#if showDeps}
            <DependencyDropdownPicker habits={allHabits} bind:depIds bind:depMode excludeId={habit.id} />
          {/if}
          <LinkedDropdownPicker habits={linkCandidates} bind:linkedIds={linkIds} excludeId={habit.id} />
          <HabitWebhookSection bind:webhooks {type} />
          <HabitShortcutSection bind:shortcuts {type} />
        </div>
      {/if}
    </div>

    {#if errorMsg}
      <p class="form-error" role="alert">{errorMsg}</p>
    {/if}
    <ModalActions onSave={handleSave} onCancel={onClose} onDelete={handleDelete} />
  </div>
  {/if}
</Modal>

<style>
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin: 0 calc(-1 * var(--space-2)) var(--space-3) 0;
  }

  .modal-head h2 {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tabs {
    margin-bottom: var(--space-4);
    background: var(--surface-3);
  }

  .habit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hint {
    font-weight: 400;
    color: var(--text-3);
  }

  .segmented {
    background: var(--surface-3);
  }

  .segmented > button {
    font-size: var(--text-sm);
    min-height: 34px;
  }

  .toggles {
    margin-top: var(--space-2);
  }

  .toggles .row {
    cursor: pointer;
  }

  .toggles .row-label {
    font-size: var(--text-base);
    color: var(--text);
  }

  .habit-form .inline-select {
    width: auto;
    min-height: 32px;
    padding-top: 4px;
    padding-bottom: 4px;
    background-color: var(--surface-2);
  }

  .section-footnote {
    margin-top: calc(-1 * var(--space-3));
  }

  .advanced {
    border-top: 0.5px solid var(--separator-strong);
    padding-top: var(--space-2);
  }

  .advanced-toggle {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    width: 100%;
    padding: var(--space-2) 0;
    text-align: left;
    font-weight: 600;
    color: var(--text);
  }

  .advanced-toggle .hint {
    grid-column: 1;
    font-size: var(--text-sm);
  }

  .advanced-toggle :global(.chev) {
    grid-column: 2;
    grid-row: 1 / span 2;
    font-size: 20px;
    color: var(--text-3);
    transition: transform 0.2s var(--ease);
  }

  .advanced-toggle :global(.chev.open) {
    transform: rotate(180deg);
  }

  .advanced-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-3);
  }

  .form-error {
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-sm);
  }
</style>
