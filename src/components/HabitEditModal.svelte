<script lang="ts">
  import type { Habit, HabitCategory } from '../types';
  import { updateHabit } from '../stores/habits';
  import { isHabitPaused } from '../lib/habitUtils';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyPicker from './DependencyPicker.svelte';
  import ModalActions from './ModalActions.svelte';
  import HabitColorPicker from './HabitColorPicker.svelte';
  import HabitIconPicker from './HabitIconPicker.svelte';

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
  let description = $state(habit.description ?? '');
  let standard = $state(habit.standard);
  let target = $state<number | undefined>(habit.target);
  let type = $state<Habit['type']>(habit.type);
  let depIds = $state<string[]>(habit.dependsOn?.habitIds ?? []);
  let depMode = $state<'and' | 'or'>(habit.dependsOn?.mode ?? 'and');
  let frequency = $state(habit.schedule.frequency);
  let interval = $state(habit.schedule.interval);
  let habitTags = $state<string[]>(habit.tags ?? []);
  let existingTags = $derived(Array.from(new Set(allHabits.flatMap(h => h.tags ?? []))));
  let showStandard = $derived(type !== 'binary');
  let showDeps = $derived(type === 'binary' && allHabits.filter(h => h.id !== habit.id).length > 0);

  let category = $state<HabitCategory>(habit.metadata?.category ?? 'build');
  let color = $state(habit.metadata?.color ?? '');
  let icon = $state(habit.metadata?.icon ?? '');
  let emoji = $state(habit.metadata?.emoji ?? '');
  let unit = $state(habit.unit || (habit.type === 'duration' ? 'minute' : 'time'));
  let startOfWeek = $state(habit.schedule.startOfWeek ?? 1);
  let showStartOfWeek = $derived(frequency === 'weekly' || frequency === 'days_per_week');

  let paused = $state(isHabitPaused(habit));
  let pauseMode = $state(habit.metadata?.pauseUntil ? 'until' : 'indefinite');
  let pauseUntilDate = $state(habit.metadata?.pauseUntil ?? '');

  function handleSave() {
    const dependsOn = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
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
      unit: unit.trim() || 'times',
      dependsOn,
      tags: habitTags,
      status,
      metadata: {
        ...habit.metadata,
        category,
        color: color || undefined,
        icon: icon || undefined,
        emoji: emoji || undefined,
        pauseUntil: paused ? (pauseMode === 'until' ? pauseUntilDate || undefined : undefined) : undefined,
      },
      schedule: { ...habit.schedule, frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'days_per_week', interval, daysPerWeek: frequency === 'days_per_week' ? interval : undefined, startOfWeek }
    };
    updateHabit(updated);
    onClose();
  }

  function handleDelete() {
    const updated: Habit = { ...habit, status: 'deleted', updatedAt: new Date() };
    updateHabit(updated);
    onClose();
  }
</script>

<Modal {onClose}>
  <h2>{habit.title}</h2>
  <div class="form-grid">
    <label>Title <input bind:value={title} /></label>

    <label>Description (supports Markdown)
      <textarea bind:value={description} class="desc-input" placeholder="Add details about this habit..."></textarea>
    </label>

    <span class="field-label">Color</span>
    <HabitColorPicker bind:color />

    <span class="field-label">Icon or Emoji</span>
    <HabitIconPicker bind:icon bind:emoji />

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

    {#if showStandard}
      <label>Unit <input type="text" bind:value={unit} placeholder="singular, e.g. cup" /></label>
      <label>Standard <input type="number" bind:value={standard} /></label>
      <label>Goal <input type="number" bind:value={target} /></label>
    {/if}

    <label>Frequency
      <select bind:value={frequency}>
        <option value="daily">Daily</option>
        <option value="days_per_week">X Days/Week</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>
    </label>

    {#if frequency === 'days_per_week'}
      <label>Days per week <input type="number" bind:value={interval} min="1" max="7" /></label>
    {:else}
      <label>Interval <input type="number" bind:value={interval} min="1" /></label>
    {/if}

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

    {#if showDeps}
      <DependencyPicker habits={allHabits} bind:depIds bind:depMode excludeId={habit.id} />
    {/if}

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

    <span class="field-label">Tags</span>
    <TagInput bind:tags={habitTags} allTags={existingTags} />

    <ModalActions onSave={handleSave} onCancel={onClose} onDelete={handleDelete} />
  </div>
</Modal>

<style>
  h2 { margin: 0 0 1rem; color: var(--text-primary, #222); }
  .form-grid { display: flex; flex-direction: column; gap: 0.75rem; }
  label {
    font-weight: 500;
    color: var(--text-primary, #222);
    display: block;
  }
  input, select, .desc-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
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
  .pause-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pause-label { font-weight: 500; color: var(--text-primary, #222); }
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
</style>
