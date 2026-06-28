<script lang="ts">
  import type { Habit, DependsOn } from '../types';
  import { updateHabit, removeHabit } from '../stores/habits';

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

  function toggleDep(id: string) {
    if (depIds.includes(id)) {
      depIds = depIds.filter(i => i !== id);
    } else {
      depIds = [...depIds, id];
    }
  }

  function handleSave() {
    const dependsOn: DependsOn | undefined = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
    const updated: Habit = {
      ...habit,
      title,
      standard,
      target: type !== 'binary' ? target : undefined,
      type,
      dependsOn,
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

<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit habit" tabindex="-1" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={e => e.stopPropagation()}>
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

      {#if type !== 'binary'}
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

      {#if type === 'binary' && allHabits.filter(h => h.id !== habit.id).length > 0}
        <span class="field-label">Depends on mode</span>
        <div class="dep-mode">
          <button type="button" class:active={depMode === 'and'} onclick={() => depMode = 'and'}>AND</button>
          <button type="button" class:active={depMode === 'or'} onclick={() => depMode = 'or'}>OR</button>
        </div>
        <span class="field-label">Depends on</span>
        <div class="dep-picker">
            {#each allHabits.filter(h => h.id !== habit.id) as h (h.id)}
              <button type="button" class:selected={depIds.includes(h.id)} onclick={() => toggleDep(h.id)}>{h.title}</button>
            {/each}
          </div>
      {/if}

      <div class="actions">
        <button onclick={handleSave}>Save Changes</button>
        <button class="danger" onclick={handleDelete}>Delete</button>
        <button class="cancel-btn" onclick={onClose}>Cancel</button>
      </div>
    </div>
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
  .dep-mode { display: flex; gap: 4px; margin-top: 4px; }
  .dep-mode button {
    flex: 1;
    padding: 0.3rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--btn-secondary-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-mode button.active { background: var(--accent, #0066cc); color: white; border-color: var(--accent, #0066cc); }
  .dep-picker { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .dep-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--btn-secondary-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-picker button.selected { background: var(--accent, #0066cc); color: white; border-color: var(--accent, #0066cc); }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .actions button {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
  }
  .actions button:first-child { background: var(--accent, #0066cc); color: white; }
  .actions button.danger { background: #d32f2f; color: white; }
  .actions button.cancel-btn { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
</style>
