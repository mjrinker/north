<script lang="ts">
  import type { Habit, DependsOn, HabitCategory, HabitWebhooks, HabitShortcuts } from '../types';
  import { addHabit } from '../stores/habits';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyPicker from './DependencyPicker.svelte';
  import ModalActions from './ModalActions.svelte';
  import HabitColorPicker from './HabitColorPicker.svelte';
  import HabitIconPicker from './HabitIconPicker.svelte';
  import HabitWebhookSection from './HabitWebhookSection.svelte';
  import HabitShortcutSection from './HabitShortcutSection.svelte';
  import DurationField from './DurationField.svelte';

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
  let frequency = $state('daily');
  let interval = $state(1);
  let habitTags = $state<string[]>([]);
  let showStandard = $derived(type !== 'binary');
  let existingTags = $derived(Array.from(new Set(habits.flatMap(h => h.tags ?? []))));

  let category = $state<HabitCategory>('build');
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

  $effect(() => {
    if (!unitDefaulted) return;
    unit = type === 'duration' ? 'seconds' : 'times';
  });

  $effect(() => {
    if (!thresholdsDefaulted) return;
    standard = type === 'duration' ? 300 : 1;
    target = type === 'duration' ? 900 : 2;
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    const dependsOn: DependsOn | undefined = depIds.length > 0
      ? { habitIds: depIds, mode: depMode }
      : undefined;

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
      identityId: undefined,
      tags: habitTags,
      status: 'active',
      webhooks,
      shortcuts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    addHabit(newHabit);
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

    <span class="field-label">Color</span>
    <HabitColorPicker bind:color />

    <span class="field-label">Icon or Emoji</span>
    <HabitIconPicker bind:icon bind:emoji />

    <label for="category">Category</label>
    <select bind:value={category}>
      <option value="build">Build</option>
      <option value="break">Break</option>
    </select>

    <label for="type">Type</label>
    <select bind:value={type} required>
      <option value="binary">Binary (Done / Not Done)</option>
      <option value="quantity">Quantity (Count)</option>
      <option value="duration">Duration (Time)</option>
    </select>

    {#if showStandard}
      <label for="unit">Unit</label>
      <input type="text" bind:value={unit} placeholder={type === 'duration' ? 'seconds' : 'times'} oninput={() => unitDefaulted = false} />
      {#if type === 'duration'}
        <label for="standard">Standard (hh:mm:ss)</label>
        <DurationField id="standard" bind:value={standard} placeholder="e.g. 5:00" touched={() => thresholdsDefaulted = false} />
        <label for="target">Goal (hh:mm:ss)</label>
        <DurationField id="target" bind:value={target} placeholder="e.g. 15:00" touched={() => thresholdsDefaulted = false} />
      {:else}
        <label for="standard">Standard</label>
        <input type="number" bind:value={standard} placeholder="Standard value" min="1" />
        <label for="target">Goal</label>
        <input type="number" bind:value={target} placeholder="Goal (optional)" min="1" />
      {/if}
    {/if}

    <label for="frequency">Frequency</label>
    <select bind:value={frequency}>
      <option value="daily">Daily</option>
      <option value="days_per_week">X Days/Week</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
      <option value="custom">Every X Days</option>
    </select>

    {#if frequency === 'days_per_week'}
      <label for="interval">Days per week</label>
      <input type="number" bind:value={interval} min="1" max="7" />
    {:else}
      <label for="interval">Every</label>
      <input type="number" bind:value={interval} min="1" />
    {/if}

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

    {#if type === 'binary'}
      <DependencyPicker {habits} bind:depIds bind:depMode />
    {/if}

    <span class="field-label">Tags</span>
    <TagInput bind:tags={habitTags} allTags={existingTags} />

    <HabitWebhookSection bind:webhooks {type} />

    <HabitShortcutSection bind:shortcuts {type} />

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
</style>
