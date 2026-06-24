<script lang="ts">
  import { habitsStore, removeHabit } from '../stores/habits';
  import type { Habit } from '../types';
  import HabitCard from '../components/HabitCard.svelte';
  import HabitCreateModal from '../components/HabitCreateModal.svelte';
  import HabitEditModal from '../components/HabitEditModal.svelte';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => habits = v);

  let showCreate = $state(false);
  let editingHabit = $state<Habit | null>(null);

  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let swipedHabitId = $state<string | null>(null);

  function handleTouchStart(e: TouchEvent, habitId: string) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipedHabitId = null;
  }

  function handleTouchEnd(e: TouchEvent, habitId: string, habit: Habit) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedHabitId = habitId;
    }
  }

  function handleSwipeAction(habit: Habit, action: 'delete' | 'archive' | 'reset') {
    swipedHabitId = null;
    if (action === 'delete') {
      if (confirm(`Delete "${habit.title}"?`)) {
        removeHabit(habit.id);
      }
    }
  }
</script>

<h1 class="page-title">My Habits</h1>

<button class="add-habit-btn" onclick={() => showCreate = true}>+ Add Habit</button>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} {habits} onClose={() => editingHabit = null} />
{/if}

<div class="habits-grid">
  {#each habits as habit (habit.id)}
      <div
        class="habit-wrapper"
        class:swiped={swipedHabitId === habit.id}
        role="listitem"
        ontouchstart={(e) => handleTouchStart(e, habit.id)}
        ontouchend={(e) => handleTouchEnd(e, habit.id, habit)}
      >
        {#if swipedHabitId === habit.id}
          <div class="swipe-actions">
            <button class="swipe-btn delete" onclick={() => handleSwipeAction(habit, 'delete')}>Delete</button>
          </div>
        {/if}
        <button class="habit-clickable" onclick={() => editingHabit = habit}>
          <HabitCard {habit} />
        </button>
      </div>
  {/each}
</div>

<style>
  .page-title {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary, #222);
  }
  .add-habit-btn {
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 1.2rem;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  .add-habit-btn:hover { opacity: 0.9; }
  .habits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .habit-wrapper {
    position: relative;
    overflow: hidden;
  }
  .habit-clickable {
    cursor: pointer;
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
  }
  .habit-clickable:hover { opacity: 0.92; }
  .swipe-actions {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
  }
  .swipe-btn {
    border: none;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    color: white;
  }
  .swipe-btn.delete { background: #d32f2f; }

  @media (max-width: 600px) {
    .habits-grid { grid-template-columns: 1fr; }
  }
</style>
