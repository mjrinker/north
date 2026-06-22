<script lang="ts">
  import { addHabit } from '../../../stores/habits';
  import type { Habit } from '../../../types';
  import { goto } from '$app/navigation';

  let title = $state('');
  let standard = $state(1);
  let target = $state(2);
  let type: Habit['type'] = $state('binary');
  let partial = $state(false);
  let dependsOn = $state('');
  let frequency = $state('daily');
  let interval = $state(1);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!title) return alert('Title is required');

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
      partial: type !== 'binary' ? partial : undefined,
      dependsOn: dependsOn || undefined,
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

<div style="padding: 1rem; max-width: 500px; margin: 0 auto;">
  <h1>Create Habit</h1>

  <form onsubmit={handleSubmit}>
    <label style="display: block; margin-bottom: 1rem;">
      Title
      <input type="text" bind:value={title} required />
    </label>

    <label style="display: block; margin-bottom: 1rem;">
      Type
      <select bind:value={type}>
        <option value="binary">Binary (Done / Not Done)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
      </select>
    </label>

    {#if type !== 'binary'}
      <label style="display: block; margin-bottom: 1rem;">
        Standard
        <input type="number" bind:value={standard} min="1" />
      </label>

      <label style="display: block; margin-bottom: 1rem;">
        Goal (optional)
        <input type="number" bind:value={target} min="1" />
      </label>

      <label style="display: block; margin-bottom: 0.5rem;">
        <input type="checkbox" bind:checked={partial} />
        Partial progress (show as "5 / 30")
      </label>
    {/if}

    <label style="display: block; margin-bottom: 1rem;">
      Frequency
      <select bind:value={frequency}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>
    </label>

    <label style="display: block; margin-bottom: 1rem;">
      Every
      <input type="number" bind:value={interval} min="1" /> day(s)
    </label>

    <button type="submit">Save</button>
    <button type="button" onclick={() => goto('/habits')}>Cancel</button>
  </form>
</div>