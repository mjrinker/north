<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  let { habit } = $props();

  let streak = $state(0);
  // Re‑run when habit updates
  $effect(() => {
    const engine = new HabitEngine(habit);
    if (!habit) return;
    (async () => {
      streak = await engine.getStreak();
    })();
  });

  function logNow() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    // For demo, assume binary habit with value 1
    const value = habit.type === 'binary' ? 1 : habit.standard;
    engine.logCompletion(today, value);
  }
</script>

<div class="habit-card" style="border: 1px solid #ddd; padding: 1rem; margin: 0.5rem 0;">
  <h3>{habit.title}</h3>
  <p>Streak: {streak} days</p>
  <button onclick={logNow}>Log Completion</button>
</div>