// src/routes/index.svelte

<main>
  <h1>Welcome to North</h1>
  <p>Start building your habits today!</p>
  <button on:click={handleOpenForm}>Create New Habit</button>
</main>

<script>
// Auto-load habit store from stores/habits-store.ts
import { HabitsStore } from '../stores/habits-store';

// Initialize store
const habitsStore = new HabitsStore();

// Handle form opening logic
function handleOpenForm() {
  // Would open habit creation form in next step
}
</script>