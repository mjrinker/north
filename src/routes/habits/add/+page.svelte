<script lang="ts">
  import { addHabit } from '../../../stores/habits';
  import type { Habit, DependsOn } from '../../../types';
  import { goto } from '$app/navigation';

  let title = $state('');
  let standard = $state(1);
  let target = $state<number | undefined>(2);
  let type: Habit['type'] = $state('binary');
  let depIds = $state<string[]>([]);
  let depMode = $state<'and' | 'or'>('and');
  let frequency = $state('daily');
  let interval = $state(1);

  function toggleDep(id: string) {
    if (depIds.includes(id)) {
      depIds = depIds.filter(i => i !== id);
    } else {
      depIds = [...depIds, id];
    }
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title) return alert('Title is required');

    const dependsOn: DependsOn | undefined = depIds.length > 0
      ? { habitIds: depIds, mode: depMode }
      : undefined;

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title,
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
    goto('/habits');
  }
</script>

<div class="page">
  <h1>Create Habit</h1>

  <form onsubmit={handleSubmit}>
    <label>
      Title
      <input type="text" bind:value={title} required />
    </label>

    <label>
      Type
      <select bind:value={type}>
        <option value="binary">Binary (Done / Not Done)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
      </select>
    </label>

    {#if type !== 'binary'}
      <label>
        Standard
        <input type="number" bind:value={standard} min="1" />
      </label>

      <label>
        Goal (optional)
        <input type="number" bind:value={target} min="1" />
      </label>
    {/if}

    <label>
      Frequency
      <select bind:value={frequency}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>
    </label>

    <label>
      Every
      <input type="number" bind:value={interval} min="1" /> day(s)
    </label>

    <button type="submit">Save</button>
    <button type="button" onclick={() => goto('/habits')}>Cancel</button>
  </form>
</div>

<style>
  .page {
    padding: 1rem;
    max-width: 500px;
    margin: 0 auto;
  }
  h1 { color: var(--text-primary, #222); }
  label {
    display: block;
    margin-bottom: 1rem;
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
    margin-top: 0.25rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  button[type="submit"] {
    background: var(--accent, #0066cc);
    color: white;
  }
  button[type="button"] {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    margin-left: 0.5rem;
  }
</style>
