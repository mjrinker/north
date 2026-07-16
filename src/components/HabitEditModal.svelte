<script lang="ts">
  import type { Habit } from '../types';
  import { updateHabit, removeHabit } from '../stores/habits';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyPicker from './DependencyPicker.svelte';
  import Icon from '@iconify/svelte';

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
  let standard = $state(habit.standard);
  let target = $state<number | undefined>(habit.target);
  let type = $state<Habit['type']>(habit.type);
  let depIds = $state<string[]>(habit.dependsOn?.habitIds ?? []);
  let depMode = $state<'and' | 'or'>(habit.dependsOn?.mode ?? 'and');
  let frequency = $state(habit.schedule.frequency);
  let interval = $state(habit.schedule.interval);
  let habitTags = $state<string[]>(habit.tags ?? []);
  let existingTags = $derived(Array.from(new Set(allHabits.flatMap(h => h.tags))));
  let showStandard = $derived(type !== 'binary');
  let showDeps = $derived(type === 'binary' && allHabits.filter(h => h.id !== habit.id).length > 0);

  function handleSave() {
    const dependsOn = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
    const updated: Habit = {
      ...habit,
      title,
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
    removeHabit(habit.id);
    onClose();
  }
</script>

<Modal {onClose}>
  <h2>{habit.title}</h2>
  <div class="form-grid">
    <label>Title <input bind:value={title} /></label>

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

    <div class="actions">
      <button onclick={handleSave} class="icon-btn" aria-label="Save"><Icon icon="mdi:check" style="color: inherit" /></button>
      <button onclick={handleDelete} class="icon-btn danger" aria-label="Delete"><Icon icon="mdi:delete" style="color: inherit" /></button>
      <button onclick={onClose} class="icon-btn cancel" aria-label="Cancel"><Icon icon="mdi:close" style="color: var(--text-primary, #222)" /></button>
    </div>
  </div>
</Modal>

<style>
  h2 { margin: 0 0 1rem; color: var(--text-primary, #222); }
  .form-grid { display: flex; flex-direction: column; gap: 1rem; }
  label {
    font-weight: 500;
    color: var(--text-primary, #222);
    display: block;
  }
  input, select {
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
  .field-label {
    display: block;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; justify-content: flex-end; }
  .actions .icon-btn {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-sizing: border-box;
  }
  .actions .icon-btn :global(svg), .actions .icon-btn :global(.iconify) { font-size: 1.3rem; color: inherit; }
  .actions .icon-btn:first-child { background: var(--accent, #0066cc); color: white; }
  .actions .icon-btn.danger { background: #d32f2f; color: white; }
  .actions .icon-btn.cancel { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .actions .icon-btn:hover { opacity: 0.85; }
</style>
