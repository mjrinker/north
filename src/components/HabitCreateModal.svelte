<script lang="ts">
  import type { Habit, DependsOn } from '../types';
  import { addHabit } from '../stores/habits';

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

  let showStandard = $derived(type !== 'binary');

  function toggleDep(id: string) {
    if (depIds.includes(id)) {
      depIds = depIds.filter(i => i !== id);
    } else {
      depIds = [...depIds, id];
    }
  }

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
        frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom',
        interval,
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
      tags: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    addHabit(newHabit);
    onClose();
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add new habit" tabindex="-1" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={e => e.stopPropagation()}>
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
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>

      <label for="interval">Every</label>
      <input type="number" bind:value={interval} min="1" />

      {#if habits.length > 0}
        <span class="field-label">Depends on mode</span>
        <div class="dep-mode">
          <button type="button" class:active={depMode === 'and'} onclick={() => depMode = 'and'}>AND</button>
          <button type="button" class:active={depMode === 'or'} onclick={() => depMode = 'or'}>OR</button>
        </div>
        <span class="field-label">Depends on</span>
        <div class="dep-picker">
          {#each habits as h (h.id)}
            <button type="button" class:selected={depIds.includes(h.id)} onclick={() => toggleDep(h.id)}>{h.title}</button>
          {/each}
        </div>
      {/if}

      <div class="modal-actions">
        <button type="submit">Create</button>
        <button type="button" onclick={onClose}>Cancel</button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: var(--card-bg, #fff);
    border-radius: 8px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal h2 {
    margin: 0 0 1rem;
    color: var(--text-primary, #222);
  }
  .modal label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .modal input, .modal select {
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
  .dep-mode {
    display: flex;
    gap: 4px;
    margin-bottom: 0.5rem;
  }
  .dep-mode button {
    flex: 1;
    padding: 0.3rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-mode button.active {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .dep-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .dep-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-picker button.selected {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .modal-actions button {
    flex: 1;
    padding: 0.5rem;
    border-radius: 4px;
    border: none;
    font-weight: 500;
    cursor: pointer;
  }
  .modal-actions button[type="submit"] {
    background: var(--accent, #0066cc);
    color: white;
  }
  .modal-actions button[type="button"] {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }
</style>
