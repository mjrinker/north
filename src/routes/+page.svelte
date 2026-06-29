<script lang="ts">
  import { get } from 'svelte/store';
  import { habitsStore, updateHabit, removeHabit } from '../stores/habits';
  import { supabaseSyncProvider } from '../services/sync.providers/supabase';
  import { user } from '../stores/auth';
  import type { Habit } from '../types';
  import HabitCard from '../components/HabitCard.svelte';
  import HabitCreateModal from '../components/HabitCreateModal.svelte';
  import HabitEditModal from '../components/HabitEditModal.svelte';

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);
  let habits = $derived(allHabits.filter(h => h.status === 'active'));

  let tagGroups = $derived.by(() => {
    const groups: { tag: string; habits: Habit[] }[] = [];
    const tags = Array.from(new Set(habits.flatMap(h => h.tags))).sort();
    let customOrder: string[] = [];
    if (sortMode === 'custom') {
      const order = getCustomOrder();
      customOrder = order.filter(id => habits.some(h => h.id === id));
    }
    for (const tag of tags) {
      let tagged = habits.filter(h => h.tags.includes(tag));
      if (sortMode === 'custom') {
        const ordered = customOrder.filter(id => tagged.some(h => h.id === id)).map(id => tagged.find(h => h.id === id)!).filter(Boolean);
        const remaining = tagged.filter(h => !customOrder.includes(h.id));
        tagged = [...ordered, ...remaining];
      } else if (sortMode === 'name') tagged = tagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') tagged = tagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag, habits: tagged });
    }
    let untagged = habits.filter(h => h.tags.length === 0);
    if (untagged.length > 0) {
      if (sortMode === 'custom') {
        const ordered = customOrder.filter(id => untagged.some(h => h.id === id)).map(id => untagged.find(h => h.id === id)!).filter(Boolean);
        const remaining = untagged.filter(h => !customOrder.includes(h.id));
        untagged = [...ordered, ...remaining];
      } else if (sortMode === 'name') untagged = untagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') untagged = untagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag: 'Untagged', habits: untagged });
    }
    return groups;
  });

  let sortMode = $state<'tag' | 'name' | 'type' | 'custom'>('tag');

  let collapsedGroups = $state<Set<string>>(new Set());

  function loadCollapsed() {
    try {
      const stored = localStorage.getItem('collapsedGroups');
      if (stored) collapsedGroups = new Set(JSON.parse(stored));
    } catch {}
  }
  loadCollapsed();

  function saveCollapsed() {
    try { localStorage.setItem('collapsedGroups', JSON.stringify([...collapsedGroups])); } catch {}
  }

  function toggleGroup(tag: string) {
    if (collapsedGroups.has(tag)) collapsedGroups.delete(tag);
    else collapsedGroups.add(tag);
    saveCollapsed();
  }

  let dragHabitId = $state<string | null>(null);

  function getCustomOrder(): string[] {
    try {
      const stored = localStorage.getItem('habitOrder');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  function saveCustomOrder(order: string[]) {
    localStorage.setItem('habitOrder', JSON.stringify(order));
  }

  function handleDragStart(e: DragEvent, habitId: string) {
    dragHabitId = habitId;
    e.dataTransfer?.setData('text/plain', habitId);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const fromId = e.dataTransfer?.getData('text/plain') || dragHabitId;
    if (!fromId || fromId === targetId) return;
    const order = getCustomOrder();
    const allIds = habits.map(h => h.id);
    const baseOrder = order.length > 0 ? order.filter(id => allIds.includes(id)) : allIds;
    const fromIdx = baseOrder.indexOf(fromId);
    const toIdx = baseOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    baseOrder.splice(fromIdx, 1);
    baseOrder.splice(toIdx, 0, fromId);
    saveCustomOrder(baseOrder);
    dragHabitId = null;
  }

  let showCreate = $state(false);
  let editingHabit = $state<Habit | null>(null);

  const SWIPE_THRESHOLD = 80;
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let touchDx = $state(0);
  let swipedHabitId = $state<string | null>(null);
  let swipingHabitId = $state<string | null>(null);

  function handleTouchStart(e: TouchEvent, habitId: string) {
    if (swipedHabitId && swipedHabitId !== habitId) {
      swipedHabitId = null;
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDx = 0;
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
    if (touchDx < -SWIPE_THRESHOLD / 2 && Math.abs(touchDx) > Math.abs(dy) * 1.5) {
      swipedHabitId = habitId;
    } else {
      swipedHabitId = null;
    }
    touchDx = 0;
  }

  function openEdit(habit: Habit) {
    swipedHabitId = null;
    editingHabit = habit;
  }

  async function archiveHabit(habit: Habit) {
    swipedHabitId = null;
    const updated = { ...habit, status: 'archived' as const, updatedAt: new Date() };
    updateHabit(updated);
    if (get(user)) {
      supabaseSyncProvider.saveRecord('habits', updated.id, updated).catch(console.error);
    }
  }

  function deleteHabit(habit: Habit) {
    swipedHabitId = null;
    removeHabit(habit.id);
  }

  function sliderTransform(habitId: string): string {
    const offset = swipedHabitId === habitId ? -SWIPE_THRESHOLD : (swipingHabitId === habitId && touchDx < 0 ? Math.max(touchDx, -SWIPE_THRESHOLD) : 0);
    return `translateX(${offset}px)`;
  }

  function actionsTransform(habitId: string): string {
    if (swipedHabitId === habitId) return 'translateX(0)';
    if (swipingHabitId === habitId && touchDx < 0) {
      const reveal = Math.min(Math.abs(touchDx) / SWIPE_THRESHOLD, 1);
      return `translateX(${(1 - reveal) * 100}%)`;
    }
    return 'translateX(100%)';
  }
</script>

<h1 class="page-title">My Habits</h1>

<div class="toolbar">
  <button class="add-habit-btn" onclick={() => showCreate = true}>+ Add Habit</button>
  <label class="sort-label">
    Sort:
    <select bind:value={sortMode}>
      <option value="tag">Tag</option>
      <option value="name">Name</option>
      <option value="type">Type</option>
      <option value="custom">Custom</option>
    </select>
  </label>
</div>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
{/if}

{#each tagGroups as group}
  <div class="tag-section">
    <button class="tag-header" onclick={() => toggleGroup(group.tag)}>
      <span class="collapse-arrow">{collapsedGroups.has(group.tag) ? '▶' : '▼'}</span>
      {group.tag}
    </button>
    {#if !collapsedGroups.has(group.tag)}
    <div class="habits-grid">
      {#each group.habits as habit (habit.id)}
        <div class="habit-wrapper"
          draggable={sortMode === 'custom'}
          ondragstart={(e) => handleDragStart(e, habit.id)}
          ondragover={handleDragOver}
          ondrop={(e) => handleDrop(e, habit.id)}
          class:dragging={dragHabitId === habit.id}
        >
          <div
            class="habit-slider"
            style="transform: {sliderTransform(habit.id)}"
            ontouchstart={(e) => handleTouchStart(e, habit.id)}
            ontouchmove={(e) => handleTouchMove(e, habit.id)}
            ontouchend={(e) => handleTouchEnd(e, habit.id)}
          >
            <HabitCard {habit} onEdit={() => openEdit(habit)} />
          </div>
          <div
            class="swipe-actions"
            style="transform: {actionsTransform(habit.id)}"
          >
            <button class="swipe-btn archive" onclick={() => archiveHabit(habit)} aria-label="Archive">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            </button>
            <button class="swipe-btn delete" onclick={() => deleteHabit(habit)} aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/></svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
    {/if}
  </div>
{/each}

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
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .sort-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
    font-weight: 500;
  }
  .sort-label select {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .tag-section { margin-bottom: 1rem; }
  .tag-header {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 1rem 0 0.5rem;
    padding: 0;
    width: 100%;
    text-align: left;
  }
  .tag-header:first-of-type { margin-top: 0; }
  .collapse-arrow {
    font-size: 0.7rem;
    width: 1rem;
    flex-shrink: 0;
  }
  .habits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .habit-wrapper {
    position: relative;
    overflow: hidden;
    cursor: grab;
  }
  .habit-slider {
    position: relative;
    z-index: 1;
    transition: transform 0.2s ease;
    touch-action: pan-y;
    display: flex;
    align-items: stretch;
  }
  .habit-wrapper.dragging { opacity: 0.4; }
  .swipe-actions {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: stretch;
    z-index: 0;
    gap: 2px;
    transition: transform 0.2s ease;
  }
  .swipe-btn {
    border: none;
    padding: 0 16px;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
  }
  .swipe-btn svg {
    width: 22px;
    height: 22px;
  }
  .swipe-btn.archive { background: #f59e0b; }
  .swipe-btn.delete { background: #d32f2f; }

  @media (max-width: 600px) {
    .habits-grid { grid-template-columns: 1fr; }
  }
</style>
