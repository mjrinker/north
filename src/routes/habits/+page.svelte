<script lang="ts">
  import type { Habit } from '../../types';
  import { habitsStore } from '../../stores/habits';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));
</script>

<div style="padding: 1rem;">
  <h1>My Habits</h1>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    {#each habits as habit (habit.id)}
      <a href="/habits/{habit.id}">
        <h3>{habit.title}</h3>
      </a>
      <hr />
    {/each}
  </div>

  <a href="/habits/add" style="text-decoration: none; color: #007acc;">
    + Add New Habit
  </a>
</div>