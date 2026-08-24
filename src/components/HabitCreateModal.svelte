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
        errorMsg = 'For a Break habit, Standard must be higher than Target.';
        return;
      }
      if (category === 'build' && standard > (target ?? 0)) {
        errorMsg = 'For a Build habit, Standard must be lower than Target.';
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
  <h2>Add New Habit</h2>
  <form onsubmit={handleSubmit}>
    <label for="title">Title</label>
    <input type="text" bind:value={title} placeholder="Enter habit title" required />

    <label for="description">Description (optional, supports Markdown)</label>
    <textarea bind:value={description} placeholder="Add details about this habit..." class="desc-input"></textarea>

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
        <select bind:value={type} required>
          <option value="binary">Binary (Done / Not Done)</option>
          <option value="quantity">Quantity (Count)</option>
          <option value="duration">Duration (Time)</option>
        </select>
      </label>
    </div>

    {#if showStandard}
      <div class="section-header">Goals</div>
      <div class="form-row">
        <label>Minimum
          {#if type === 'duration'}
            <DurationField id="standard" bind:value={standard} placeholder="e.g. 5:00" touched={() => thresholdsDefaulted = false} />
          {:else}
            <input type="number" bind:value={standard} placeholder="Standard value" min="1" />
          {/if}
        </label>
        <label>Stretch goal
          {#if type === 'duration'}
            <DurationField id="target" bind:value={target} placeholder="e.g. 15:00" touched={() => thresholdsDefaulted = false} />
          {:else}
            <input type="number" bind:value={target} placeholder="Goal (optional)" min="1" />
          {/if}
        </label>
      </div>
      <label for="unit">Unit</label>
      <input type="text" bind:value={unit} placeholder={type === 'duration' ? 'seconds' : 'times'} oninput={() => unitDefaulted = false} />
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
      <label for="startOfWeek">Start of week</label>
      <select bind:value={startOfWeek}>
        <option value="0">Sunday</option>
        <option value="1">Monday</option>
        <option value="2">Tuesday</option>
        <option value="3">Wednesday</option>
        <option value="4">Thursday</option>
        <option value="5">Friday</option>
        <option value="6">Saturday</option>
      </select>
    {/if}

    <div class="advanced-section">
      <button class="advanced-toggle" onclick={() => advancedOpen = !advancedOpen} aria-expanded={advancedOpen}>
        <span>Advanced</span>
        <span class:rotated={advancedOpen}><Icon icon="mdi:chevron-down" /></span>
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

    <span class="field-label">Tags</span>
    <TagInput bind:tags={habitTags} allTags={existingTags} />

    {#if errorMsg}
      <p class="form-error">{errorMsg}</p>
    {/if}
    <ModalActions onCancel={onClose} saveType="submit" saveLabel="Create" />
  </form>
</Modal>

<style>
  h2 {
    margin: 0 0 1rem;
    color: var(--text-primary, #222);
  }
  label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  input, select, .desc-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 1rem;
    box-sizing: border-box;
    margin-bottom: 0.75rem;
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
    margin-bottom: 0.25rem;
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
  .form-error {
    margin: 0.5rem 0 0.75rem;
    padding: 0.5rem;
    border: 1px solid #c62828;
    background: rgba(198, 40, 40, 0.1);
    color: #c62828;
    font-size: 0.85rem;
  }
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
