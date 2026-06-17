<script lang="ts">
  import { habitsStore } from '../stores/habits';
  import type { Habit } from '../types';
  import HabitCard from '../components/HabitCard.svelte';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe((v) => (habits = v));
</script>

<h1>My Habits</h1>
{#each habits as h (h.id)}
  <HabitCard habit={h} />
{/each}

<p>Use the navigation to manage habits.</p>