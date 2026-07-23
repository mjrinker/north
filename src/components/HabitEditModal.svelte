<script lang="ts">
  import type { Habit } from '../types';
  import { updateHabit } from '../stores/habits';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyPicker from './DependencyPicker.svelte';
  import ModalActions from './ModalActions.svelte';

  let {
    habit,
    allHabits,
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

  function handleSave() {
    const dependsOn = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
    const updated: Habit = {
      ...habit,
      title,
      description: description.trim() || undefined,
      standard,
      target: type !== 'binary' ? target : undefined,
      type,
      dependsOn,
      tags: habitTags,
      schedule: { ...habit.schedule, frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'days_per_week', interval, daysPerWeek: frequency === 'days_per_week' ? interval : undefined }
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

    <label>Type
      <select bind:value={type}>
        <option value="binary">Binary (Done / Not Done)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
      </select>
    </label>

    {#if showStandard}
      <label>Standard <input type="number" bind:value={standard} /></label>
      <label>Goal <input type="number" bind:value={target} /></label>
    {/if}

    <label>Frequency
      <select bind:value={frequency}>
        <option value="daily">Daily</option>
        <option value="days_per_week">X Days/Week</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>
    </label>

    {#if frequency === 'days_per_week'}
      <label>Days per week <input type="number" bind:value={interval} min="1" max="7" /></label>
    {:else}
      <label>Interval <input type="number" bind:value={interval} min="1" /></label>
    {/if}

    {#if showDeps}
      <DependencyPicker habits={allHabits} bind:depIds bind:depMode excludeId={habit.id} />
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
</style>
