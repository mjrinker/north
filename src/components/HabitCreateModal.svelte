<script lang="ts">
  import type { Habit, DependsOn } from '../types';
  import { addHabit } from '../stores/habits';
  import Modal from './Modal.svelte';
  import TagInput from './TagInput.svelte';
  import DependencyPicker from './DependencyPicker.svelte';
  import Icon from '@iconify/svelte';

  let {
    habits,
    onClose
  }: {
    habits: Habit[];
    onClose: () => void;
  } = $props();

  let title = $state('');
  let standard = $state(1);
  let target = $state<number | undefined>(2);
  let type: Habit['type'] = $state('binary');
  let depIds = $state<string[]>([]);
  let depMode = $state<'and' | 'or'>('and');
  let frequency = $state('daily');
  let interval = $state(1);
  let habitTags = $state<string[]>([]);
  let showStandard = $derived(type !== 'binary');
  let existingTags = $derived(Array.from(new Set(habits.flatMap(h => h.tags))));

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    const dependsOn: DependsOn | undefined = depIds.length > 0
      ? { habitIds: depIds, mode: depMode }
      : undefined;

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title: title.trim(),
      standard,
      target: (type !== 'binary' && target) ? target : undefined,
      type,
      unit: type === 'duration' ? 'minutes' : 'times',
      schedule: {
        frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'days_per_week',
        interval,
        daysPerWeek: frequency === 'days_per_week' ? interval : undefined,
        startDate: new Date()
      },
      metadata: {
        remindersEnabled: false,
        reminderAdvanceMinutes: 0,
        streakFreezeDays: 0,
        allowBackdating: true
      },
      dependsOn,
      identityId: undefined,
      tags: habitTags,
      status: 'active',
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

    <label for="type">Type</label>
    <select bind:value={type} required>
      <option value="binary">Binary (Done / Not Done)</option>
      <option value="quantity">Quantity (Count)</option>
      <option value="duration">Duration (Time)</option>
    </select>

    {#if showStandard}
      <label for="standard">Standard</label>
      <input type="number" bind:value={standard} placeholder="Standard value" min="1" />
      <label for="target">Goal</label>
      <input type="number" bind:value={target} placeholder="Goal (optional)" min="1" />
    {/if}

    <label for="frequency">Frequency</label>
    <select bind:value={frequency}>
      <option value="daily">Daily</option>
      <option value="days_per_week">X Days/Week</option>
      <option value="weekly">Weekly</option>
      <option value="biweekly">Biweekly</option>
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

    {#if type === 'binary'}
      <DependencyPicker {habits} bind:depIds bind:depMode />
    {/if}

    <span class="field-label">Tags</span>
    <TagInput bind:tags={habitTags} allTags={existingTags} />

    <div class="modal-actions">
      <button type="submit" class="icon-btn" aria-label="Create"><Icon icon="mdi:check" style="color: inherit" /></button>
      <button type="button" onclick={onClose} class="icon-btn cancel" aria-label="Cancel"><Icon icon="mdi:close" style="color: #333" /></button>
    </div>
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
  input, select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
    margin-bottom: 0.75rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .field-label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    justify-content: flex-end;
  }
  .modal-actions .icon-btn {
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
  .modal-actions .icon-btn :global(svg), .modal-actions .icon-btn :global(.iconify) { font-size: 1.3rem; color: inherit; }
  .modal-actions .icon-btn[type="submit"] { background: var(--accent, #0066cc); color: white; }
  .modal-actions .icon-btn.cancel { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .modal-actions .icon-btn:hover { opacity: 0.85; }
</style>
