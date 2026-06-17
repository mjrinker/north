<script lang="ts">
  import { habitsStore, addHabit } from '../../../stores/habits';
  import type { Habit } from '../../../types';
  import { goto } from '$app/navigation';

  let title = $state('');
  let standard = $state(1);
  let target = $state(2);
  let type: Habit['type'] = $state('binary');

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!title) return alert('Title is required');

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title,
      standard,
      target: target || undefined,
      type,
      schedule: {
        frequency: 'daily',
        interval: 1,
        startDate: new Date()
      },
      metadata: {
        remindersEnabled: false,
        reminderAdvanceMinutes: 0,
        streakFreezeDays: 0,
        allowBackdating: true
      },
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
    <div style="margin-bottom: 1rem;">
      <label>Title</label><br />
      <input type="text" bind:value={title} required />
    </div>

    <div style="margin-bottom: 1rem;">
      <label>Type</label><br />
      <select bind:value={type}>
        <option value="binary">Binary (Checkmark)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
        <option value="partial">Partial (Percentage)</option>
        <option value="conditional">Conditional</option>
      </select>
    </div>

    <div style="margin-bottom: 1rem;">
      <label>Standard</label><br />
      <input type="number" bind:value={standard} min="1" />
    </div>

    <div style="margin-bottom: 1rem;">
      <label>Target (optional)</label><br />
      <input type="number" bind:value={target} min="1" />
    </div>

    <button type="submit">Save</button>
    <button type="button" onclick={() => goto('/habits')}>Cancel</button>
  </form>
</div>