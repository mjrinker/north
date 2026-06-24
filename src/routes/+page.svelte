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
  let touchDx = $state(0);
  let swipedHabitId = $state<string | null>(null);
  let swipingHabitId = $state<string | null>(null);
  let justSwiped = $state(false);

  function handleTouchStart(e: TouchEvent, habitId: string) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDx = 0;
    if (swipedHabitId !== habitId) {
      swipedHabitId = null;
    }
    swipingHabitId = habitId;
  }

  function handleTouchMove(e: TouchEvent, habitId: string) {
    if (swipingHabitId !== habitId) return;
    touchDx = e.touches[0].clientX - touchStartX;
  }

  function handleTouchEnd(e: TouchEvent, habitId: string) {
    if (swipingHabitId !== habitId) return;
    swipingHabitId = null;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (touchDx < -60 && Math.abs(touchDx) > Math.abs(dy) * 1.5) {
      swipedHabitId = habitId;
      justSwiped = true;
      setTimeout(() => justSwiped = false, 300);
    } else {
      swipedHabitId = null;
    }
    touchDx = 0;
  }

  function handleCardClick(habit: Habit) {
    if (justSwiped) return;
    if (swipedHabitId) {
      swipedHabitId = null;
      return;
    }
    editingHabit = habit;
  }

  function handleSwipeAction(habit: Habit, action: 'delete' | 'archive' | 'reset') {
    swipedHabitId = null;
    if (action === 'delete') {
      removeHabit(habit.id);
    }
  }

  function swipeStyle(habitId: string): string {
    if (swipingHabitId === habitId) {
      if (touchDx < 0) return `transform: translateX(${Math.max(touchDx, -80)}px)`;
      return 'transform: translateX(0)';
    }
    if (swipedHabitId === habitId) return 'transform: translateX(-80px)';
    return '';
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
    <div class="habit-wrapper">
      <div
        class="habit-slider"
        style={swipeStyle(habit.id)}
        role="button"
        tabindex="0"
        onclick={() => handleCardClick(habit)}
        onkeydown={(e) => { if (e.key === 'Enter') handleCardClick(habit); }}
        ontouchstart={(e) => handleTouchStart(e, habit.id)}
        ontouchmove={(e) => handleTouchMove(e, habit.id)}
        ontouchend={(e) => handleTouchEnd(e, habit.id)}
      >
        <HabitCard {habit} />
      </div>
      {#if swipedHabitId === habit.id}
        <div class="swipe-actions">
          <button class="swipe-btn delete" onclick={() => handleSwipeAction(habit, 'delete')}>Delete</button>
        </div>
      {/if}
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
  .habit-slider {
    position: relative;
    z-index: 1;
    cursor: pointer;
    transition: transform 0.2s ease;
    background: var(--card-bg);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .habit-slider:hover { opacity: 0.92; }
  .habit-slider:focus-visible {
    outline: 2px solid var(--accent, #0066cc);
    outline-offset: 2px;
  }
  .swipe-actions {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    padding: 0 8px;
    z-index: 0;
  }
  .swipe-btn {
    border: none;
    border-radius: 4px;
    padding: 0.6rem 1rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    color: white;
  }
  .swipe-btn.delete { background: #d32f2f; }

  @media (max-width: 600px) {
    .habits-grid { grid-template-columns: 1fr; }
  }
</style>
