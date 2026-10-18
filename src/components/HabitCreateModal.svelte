<script lang="ts">
  import type { Habit, DependsOn, HabitCategory, HabitWebhooks, HabitShortcuts } from '../types';
  import { addHabit, setLinkedHabits } from '../stores/habits';
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
  import Icon from '@iconify/svelte';

  let {
    habits,
    onClose
  }: {
    habits: Habit[];
    onClose: () => void;
  } = $props();

  let title = $state('');
  let description = $state('');
  let standard = $state(1);
  let target = $state<number | undefined>(2);
  let type: Habit['type'] = $state('binary');
  let depIds = $state<string[]>([]);
  let depMode = $state<'and' | 'or'>('and');
  let linkIds = $state<string[]>([]);
  let linkCandidates = $derived(habits.filter(h => h.type === type && h.status !== 'deleted' && h.id));
  let frequency = $state('daily');
  let interval = $state(1);
  let habitTags = $state<string[]>([]);
  let showStandard = $derived(type !== 'binary');
  let existingTags = $derived(Array.from(new Set(habits.flatMap(h => h.tags ?? []))));

  let category = $state<HabitCategory>('build');
  let errorMsg = $state('');
  let color = $state('');
  let icon = $state('');
  let emoji = $state('');
  let webhooks = $state<HabitWebhooks>({});
  let shortcuts = $state<HabitShortcuts>({});
  let unit = $state('times');
  let unitDefaulted = $state(true);
  let thresholdsDefaulted = $state(true);
  let startOfWeek = $state(1);
  let showStartOfWeek = $derived(frequency === 'weekly' || frequency === 'days_per_week');
  let advancedOpen = $state(false);

  $effect(() => {
    if (!unitDefaulted) return;
    unit = type === 'duration' ? 'seconds' : 'times';
  });

  $effect(() => {
    if (!thresholdsDefaulted) return;
    if (category === 'break') {
      standard = type === 'duration' ? 900 : 2;
      target = type === 'duration' ? 300 : 1;
    } else {
      standard = type === 'duration' ? 300 : 1;
      target = type === 'duration' ? 900 : 2;
    }
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    errorMsg = '';
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

    const dependsOn: DependsOn | undefined = depIds.length > 0
      ? { habitIds: depIds, mode: depMode }
      : undefined;
    const linkHabitIds = linkIds.filter(id => habits.find(h => h.id === id)?.type === type);

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
      standard,
      target: (type !== 'binary' && target) ? target : undefined,
      type,
      unit: unit.trim() || (type === 'duration' ? 'seconds' : 'times'),
      schedule: {
        frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'days_per_week',
        interval,
        daysPerWeek: frequency === 'days_per_week' ? interval : undefined,
        startOfWeek,
        startDate: new Date()
      },
      metadata: {
        category,
        color: color || undefined,
        icon: icon || undefined,
        emoji: emoji || undefined,
        remindersEnabled: false,
        reminderAdvanceMinutes: 0,
        streakFreezeDays: 0,
        allowBackdating: true
      },
      dependsOn,
      linkedHabitIds: linkHabitIds.length ? [...linkHabitIds] : undefined,
      identityId: undefined,
      tags: habitTags,
      status: 'active',
      webhooks,
      shortcuts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    addHabit(newHabit);
    if (linkHabitIds.length) setLinkedHabits(newHabit, linkHabitIds);
    onClose();
  }
</script>

<Modal {onClose}>
  <h2>New habit</h2>
  <form onsubmit={handleSubmit} class="habit-form">
    <div class="field">
      <label for="new-title">Name</label>
      <input id="new-title" type="text" bind:value={title} placeholder="e.g. Read" required autocomplete="off" />
    </div>

    <div class="field">
      <label for="new-desc">Notes <span class="hint">Markdown supported</span></label>
      <textarea id="new-desc" bind:value={description} placeholder="Why it matters, how you’ll do it"></textarea>
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
          <label for="standard">{category === 'break' ? 'Limit' : 'Minimum'}</label>
          {#if type === 'duration'}
            <DurationField id="standard" bind:value={standard} placeholder="5:00" touched={() => thresholdsDefaulted = false} />
          {:else}
            <input id="standard" type="number" inputmode="numeric" bind:value={standard} min="1" />
          {/if}
        </div>
        <div class="field">
          <label for="target">{category === 'break' ? 'Stricter limit' : 'Stretch goal'}</label>
          {#if type === 'duration'}
            <DurationField id="target" bind:value={target} placeholder="15:00" touched={() => thresholdsDefaulted = false} />
          {:else}
            <input id="target" type="number" inputmode="numeric" bind:value={target} placeholder="Optional" min="1" />
          {/if}
        </div>
      </div>
      {#if type === 'quantity'}
        <div class="field">
          <label for="unit">Unit</label>
          <input id="unit" type="text" bind:value={unit} placeholder="times" oninput={() => unitDefaulted = false} />
        </div>
      {/if}
    {/if}

    <div class="field-row">
      <div class="field">
        <label for="frequency">Repeat</label>
        <select id="frequency" bind:value={frequency}>
          <option value="daily">Every day</option>
          <option value="days_per_week">Days per week</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Every few days</option>
        </select>
      </div>
      {#if frequency !== 'daily'}
        <div class="field">
          <label for="interval">{frequency === 'days_per_week' ? 'Days per week' : frequency === 'weekly' ? 'Every … weeks' : frequency === 'monthly' ? 'Every … months' : 'Every … days'}</label>
          <input id="interval" type="number" inputmode="numeric" bind:value={interval} min="1" max={frequency === 'days_per_week' ? 7 : undefined} />
        </div>
      {/if}
    </div>

    {#if showStartOfWeek}
      <div class="field">
        <label for="startOfWeek">Week starts on</label>
        <select id="startOfWeek" bind:value={startOfWeek}>
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

    <div class="advanced">
      <button type="button" class="advanced-toggle" onclick={() => advancedOpen = !advancedOpen} aria-expanded={advancedOpen}>
        <span>More options</span>
        <span class="hint">Conditions, linked habits, webhooks, Shortcuts</span>
        <Icon icon="mdi:chevron-down" class="chev {advancedOpen ? 'open' : ''}" />
      </button>

      {#if advancedOpen}
        <div class="advanced-content">
          {#if type === 'binary'}
            <DependencyDropdownPicker habits={habits} bind:depIds bind:depMode />
          {/if}
          <LinkedDropdownPicker habits={linkCandidates} bind:linkedIds={linkIds} />
          <HabitWebhookSection bind:webhooks {type} />
          <HabitShortcutSection bind:shortcuts {type} />
        </div>
      {/if}
    </div>

    {#if errorMsg}
      <p class="form-error" role="alert">{errorMsg}</p>
    {/if}
    <ModalActions onCancel={onClose} saveType="submit" saveLabel="Add habit" />
  </form>
</Modal>

<style>
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
