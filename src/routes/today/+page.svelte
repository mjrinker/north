<script lang="ts">
  import { get } from 'svelte/store';
  import { flip } from 'svelte/animate';
  import { habitsStore, updateHabit, removeHabit } from '../../stores/habits';
  import { supabaseSyncProvider } from '../../services/sync.providers/supabase';
  import { user } from '../../stores/auth';
  import type { Habit } from '../../types';
  import HabitCard from '../../components/HabitCard.svelte';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import Icon from '@iconify/svelte';

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);
  let habits = $derived(allHabits.filter(h => h.status === 'active'));

  let tagGroups = $derived.by(() => {
    const groups: { tag: string; habits: Habit[] }[] = [];
    const tags = Array.from(new Set(habits.flatMap(h => h.tags))).sort();
    let order: string[] = [];
    if (sortMode === 'custom') {
      order = customOrder.filter(id => habits.some(h => h.id === id));
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

  function loadSortMode(): 'tag' | 'name' | 'type' | 'custom' {
    try {
      const saved = localStorage.getItem('sortMode');
      if (saved === 'tag' || saved === 'name' || saved === 'type' || saved === 'custom') return saved;
    } catch {}
    return 'tag';
  }

  let sortMode = $state(loadSortMode());

  $effect(() => {
    try { localStorage.setItem('sortMode', sortMode); } catch {}
  });

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
    const next = new Set(collapsedGroups);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    collapsedGroups = next;
    saveCollapsed();
  }

  let dragHabitId = $state<string | null>(null);

  function loadCustomOrder(): string[] {
    try {
      const stored = localStorage.getItem('habitOrder');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  let customOrder = $state<string[]>(loadCustomOrder());

  function saveCustomOrder(order: string[]) {
    customOrder = order;
    localStorage.setItem('habitOrder', JSON.stringify(order));
  }

  function reorder(fromId: string, targetId: string) {
    if (!fromId || fromId === targetId) return;
    const allIds = habits.map(h => h.id);
    const baseOrder = customOrder.length > 0 ? customOrder.filter(id => allIds.includes(id)) : [...allIds];
    const fromIdx = baseOrder.indexOf(fromId);
    const toIdx = baseOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    baseOrder.splice(fromIdx, 1);
    baseOrder.splice(toIdx, 0, fromId);
    saveCustomOrder(baseOrder);
  }

  // HTML5 drag-and-drop (desktop)
  function handleDragStart(e: DragEvent, habitId: string) {
    dragHabitId = habitId;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', habitId);
  }

  function handleGridDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const el = (e.target as HTMLElement).closest<HTMLElement>('.habit-wrapper');
    if (el && el.dataset.habitId && el.dataset.habitId !== dragHabitId) {
      document.querySelectorAll('.habit-wrapper.drop-target').forEach(n => n.classList.remove('drop-target'));
      el.classList.add('drop-target');
    }
  }

  function handleGridDrop(e: DragEvent) {
    e.preventDefault();
    document.querySelectorAll('.habit-wrapper.drop-target').forEach(n => n.classList.remove('drop-target'));
    const el = (e.target as HTMLElement).closest<HTMLElement>('.habit-wrapper');
    if (!el) return;
    const targetId = el.dataset.habitId;
    if (!targetId) return;
    const fromId = e.dataTransfer?.getData('text/plain') || dragHabitId;
    if (fromId) reorder(fromId, targetId);
    dragHabitId = null;
  }

  function handleDragEnd() {
    document.querySelectorAll('.habit-wrapper.drop-target').forEach(n => n.classList.remove('drop-target'));
    dragHabitId = null;
  }

  // Touch drag-and-drop (mobile) — ghost + FLIP
  let touchDragFromId: string | null = null;
  let touchDragTargetId: string | null = null;
  let dragGhost: HTMLElement | null = null;
  let ghostStartX = 0;
  let ghostStartY = 0;

  function handleTouchDragStart(e: TouchEvent, habitId: string) {
    if (sortMode !== 'custom') return;
    e.preventDefault();
    e.stopPropagation();
    touchDragFromId = habitId;
    touchDragTargetId = null;
    document.body.style.overflow = 'hidden';
    const wrapper = (e.currentTarget as HTMLElement).closest<HTMLElement>('.habit-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const ghost = wrapper.cloneNode(true) as HTMLElement;
    const ghostSlider = ghost.querySelector<HTMLElement>('.habit-slider');
    if (ghostSlider) ghostSlider.style.transform = '';
    const ghostActions = ghost.querySelector<HTMLElement>('.swipe-actions');
    if (ghostActions) ghostActions.style.transform = '';
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.zIndex = '1000';
    ghost.style.pointerEvents = 'none';
    ghost.style.transform = 'scale(1.05)';
    ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    ghost.style.borderRadius = '8px';
    ghost.style.opacity = '0.95';
    ghost.style.overflow = 'hidden';
    ghost.classList.add('drag-ghost');
    document.body.appendChild(ghost);
    dragGhost = ghost;
    ghostStartX = e.touches[0].clientX;
    ghostStartY = e.touches[0].clientY;
    wrapper.style.opacity = '0.25';
  }

  function handleTouchDragMove(e: TouchEvent) {
    if (!touchDragFromId || !dragGhost) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.touches[0].clientX - ghostStartX;
    const dy = e.touches[0].clientY - ghostStartY;
    dragGhost.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
    const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if (!target) return;
    const el = (target as HTMLElement).closest<HTMLElement>('.habit-wrapper');
    if (!el || !el.dataset.habitId || el.dataset.habitId === touchDragFromId) return;
    touchDragTargetId = el.dataset.habitId;
    document.querySelectorAll('.habit-wrapper.drop-target').forEach(n => n.classList.remove('drop-target'));
    el.classList.add('drop-target');
  }

  function handleTouchDragEnd(e: TouchEvent) {
    if (!touchDragFromId) return;
    e.preventDefault();
    e.stopPropagation();
    document.body.style.overflow = '';
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    const wrapper = document.querySelector<HTMLElement>(`.habit-wrapper[data-habit-id="${CSS.escape(touchDragFromId)}"]`);
    if (wrapper) wrapper.style.opacity = '';
    document.querySelectorAll('.habit-wrapper.drop-target').forEach(n => n.classList.remove('drop-target'));
    if (touchDragTargetId) reorder(touchDragFromId, touchDragTargetId);
    touchDragTargetId = null;
    touchDragFromId = null;
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
    if (touchStartY > window.innerHeight - 40) return;
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
    if (touchDx < -SWIPE_THRESHOLD / 2 && Math.abs(touchDx) > Math.abs(dy) * 3) {
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

<h1 class="page-title">Today</h1>

<div class="toolbar">
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

<button class="fab" on:click={() => showCreate = true} aria-label="Add Habit"><Icon icon="mdi:plus" style="color: inherit" /></button>

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
{/if}

{#each tagGroups as group}
  <div class="tag-section">
    <button class="tag-header" on:click={() => toggleGroup(group.tag)}>
      <span class="collapse-arrow">{collapsedGroups.has(group.tag) ? '▶' : '▼'}</span>
      {group.tag}
    </button>
    {#if !collapsedGroups.has(group.tag)}
    <div class="habits-grid"
      on:dragover={handleGridDragOver}
      on:drop={handleGridDrop}
      on:dragend={handleDragEnd}
    >
      {#each group.habits as habit (habit.id)}
        <div animate:flip={{ duration: 200 }}>
          <div class="habit-wrapper" data-habit-id={habit.id}>
            <div
              class="habit-slider"
              style="transform: {sliderTransform(habit.id)}"
              on:touchstart|nonpassive={(e) => handleTouchStart(e, habit.id)}
              on:touchmove|nonpassive={(e) => handleTouchMove(e, habit.id)}
              on:touchend={(e) => handleTouchEnd(e, habit.id)}
            >
              {#if sortMode === 'custom'}
                <span
                  class="drag-handle"
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(e, habit.id)}
                  on:touchstart|nonpassive={(e) => handleTouchDragStart(e, habit.id)}
                  on:touchmove|nonpassive={(e) => handleTouchDragMove(e)}
                  on:touchend={(e) => handleTouchDragEnd(e)}
                ><Icon icon="mdi:drag" /></span>
              {/if}
              <HabitCard {habit} onEdit={() => openEdit(habit)} />
            </div>
            <div
              class="swipe-actions"
              style="transform: {actionsTransform(habit.id)}"
            >
              <button class="swipe-btn archive" on:click={() => archiveHabit(habit)} aria-label="Archive">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
              </button>
              <button class="swipe-btn delete" on:click={() => deleteHabit(habit)} aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/></svg>
              </button>
            </div>
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
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    z-index: 50;
  }
  .fab :global(svg), .fab :global(.iconify) { font-size: 1.75rem; color: inherit; }
  .fab:hover { opacity: 0.9; }
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
  }
  .habit-wrapper.drop-target { outline: 2px dashed var(--accent, #0066cc); outline-offset: -2px; border-radius: 8px; }
  .drag-ghost { transition: transform 0.05s linear; }

  .habit-slider {
    position: relative;
    z-index: 1;
    transition: transform 0.2s ease;
    touch-action: pan-y;
    display: flex;
    align-items: stretch;
  }
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    cursor: grab;
    color: var(--text-secondary, #888);
    flex-shrink: 0;
    touch-action: none;
  }
  .drag-handle:active { cursor: grabbing; }
  .drag-handle :global(svg), .drag-handle :global(.iconify) { font-size: 1.4rem; }
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
