<script lang="ts">
  import { get } from 'svelte/store';
  import { flip } from 'svelte/animate';
  import { habitsStore, updateHabit } from '../../stores/habits';
  import { supabaseSyncProvider } from '../../services/sync.providers/supabase';
  import { user } from '../../stores/auth';
  import type { Habit } from '../../types';
  import HabitCard from '../../components/HabitCard.svelte';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import NotesModal from '../../components/NotesModal.svelte';
  import Icon from '@iconify/svelte';
  import { computeSuggestions, getCurrentLocation } from '../../lib/completionLog';
  import type { SuggestedPlace, DepPopoverState } from '../../types';
  import { notesStore } from '../../stores/notes';
  import { entriesStore } from '../../stores/entries';
  import { HabitEngine } from '../../services/habitEngine';
  import { getLocalDateString } from '../../lib/dates';
  import { appSettings, updateSettings } from '../../lib/settings';
  import { showCreateHabit } from '../../stores/createHabit';
  import { onDestroy } from 'svelte';

  let today = getLocalDateString();
  let viewDate = $state(today);

  let allHabits = $state<Habit[]>([]);
  let unsubHabits = habitsStore.subscribe(v => allHabits = v);
  onDestroy(() => unsubHabits());

  let habits = $derived(allHabits.filter(h => h.status === 'active'));

  function shiftDate(dir: number) {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    viewDate = getLocalDateString(d);
  }

  function formatDisplayDate(dateStr: string): string {
    if (dateStr === today) return 'Today';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

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

  let customOrder = $state<string[]>([]);
  let unsubSettings = appSettings.subscribe(v => customOrder = v.habitOrder);
  onDestroy(() => unsubSettings());

  function saveCustomOrder(order: string[]) {
    customOrder = order;
    updateSettings({ habitOrder: order });
  }

  let tagGroups = $derived.by(() => {
    const groups: { tag: string; habits: Habit[] }[] = [];
    const tags = Array.from(new Set(habits.flatMap(h => h.tags ?? []))).sort();
    const co = customOrder ?? [];
    for (const tag of tags) {
      let tagged = habits.filter(h => (h.tags ?? []).includes(tag));
      if (sortMode === 'custom') {
        const ordered = co.filter(id => tagged.some(h => h.id === id)).map(id => tagged.find(h => h.id === id)!).filter(Boolean);
        const remaining = tagged.filter(h => !co.includes(h.id));
        tagged = [...ordered, ...remaining];
      } else if (sortMode === 'name') tagged = tagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') tagged = tagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag, habits: tagged });
    }
    let untagged = habits.filter(h => (h.tags ?? []).length === 0);
    if (untagged.length > 0) {
      if (sortMode === 'custom') {
        const ordered = co.filter(id => untagged.some(h => h.id === id)).map(id => untagged.find(h => h.id === id)!).filter(Boolean);
        const remaining = untagged.filter(h => !co.includes(h.id));
        untagged = [...ordered, ...remaining];
      } else if (sortMode === 'name') untagged = untagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') untagged = untagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag: 'Untagged', habits: untagged });
    }
    return groups;
  });
  let currentLocation = $state<GeolocationPosition | null>(null);
  let locationChecked = $state(false);

  $effect(() => {
    getCurrentLocation().then(pos => { currentLocation = pos; locationChecked = true; });
  });

  let suggestedHabits = $derived(computeSuggestions(habits, undefined, currentLocation));

  let rawEntries = $state<import('../../types').HabitEntry[]>([]);
  let unsubEntries = entriesStore.subscribe(v => rawEntries = v);
  onDestroy(() => unsubEntries());
  let allEntries = $derived((rawEntries ?? []).filter(e => e.date === viewDate));
  let completedHabitIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const e of allEntries) {
      if (e.standardMet) ids.add(e.habitId);
    }
    return ids;
  });
  let filteredSuggested = $derived(viewDate === today ? (suggestedHabits ?? []).filter(h => !completedHabitIds.has(h.id)) : []);
  let suggestedCollapsed = $state(false);

  let allNotes = $state<import('../../types').HabitNote[]>([]);
  let unsubNotes = notesStore.subscribe(v => allNotes = v);
  onDestroy(() => unsubNotes());
  let notesCountMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const n of allNotes) {
      if (n.date === viewDate) map.set(n.habitId, (map.get(n.habitId) ?? 0) + 1);
    }
    return map;
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

  function reorder(fromId: string, targetId: string) {
    if (!fromId || fromId === targetId) return;
    const allIds = habits.map(h => h.id);
    const baseOrder = (customOrder ?? []).length > 0 ? (customOrder ?? []).filter(id => allIds.includes(id)) : [...allIds];
    let fromIdx = baseOrder.indexOf(fromId);
    let toIdx = baseOrder.indexOf(targetId);
    if (fromIdx === -1) { baseOrder.push(fromId); fromIdx = baseOrder.length - 1; }
    if (toIdx === -1) { baseOrder.push(targetId); toIdx = baseOrder.length - 1; }
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

  {
    let skip = true;
    onDestroy(showCreateHabit.subscribe(() => {
      if (skip) { skip = false; return; }
      showCreate = true;
    }));
  }
  let editingHabit = $state<Habit | null>(null);
  let notesHabitId = $state<string | null>(null);
  let depPopover = $state<DepPopoverState | null>(null);

  function closeDepPopover() {
    depPopover = null;
  }

  function handleDepPopover(state: DepPopoverState) {
    if (depPopover?.habitId === state.habitId) {
      depPopover = null;
    } else {
      depPopover = state;
    }
  }

  const SWIPE_THRESHOLD = 80;
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let touchDx = $state(0);
  let swipedHabitId = $state<string | null>(null);
  let swipedRightHabitId = $state<string | null>(null);
  let swipingHabitId = $state<string | null>(null);

  function handleTouchStart(e: TouchEvent, habitId: string) {
    if (swipedHabitId && swipedHabitId !== habitId) {
      swipedHabitId = null;
    }
    if (swipedRightHabitId && swipedRightHabitId !== habitId) {
      swipedRightHabitId = null;
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
    if (Math.abs(touchDx) > Math.abs(dy) * 3) {
      if (touchDx < -SWIPE_THRESHOLD / 2) {
        swipedHabitId = habitId;
        swipedRightHabitId = null;
      } else if (touchDx > SWIPE_THRESHOLD / 2) {
        swipedRightHabitId = habitId;
        swipedHabitId = null;
      } else {
        swipedHabitId = null;
        swipedRightHabitId = null;
      }
    } else {
      swipedHabitId = null;
      swipedRightHabitId = null;
    }
    touchDx = 0;
  }

  function openEdit(habit: Habit) {
    swipedHabitId = null;
    swipedRightHabitId = null;
    editingHabit = habit;
  }

  async function archiveHabit(habit: Habit) {
    swipedHabitId = null;
    swipedRightHabitId = null;
    const updated = { ...habit, status: 'archived' as const, updatedAt: new Date() };
    updateHabit(updated);
    if (get(user)) {
      supabaseSyncProvider.saveRecord('habits', updated.id, updated).catch(console.error);
    }
  }

  function deleteHabit(habit: Habit) {
    swipedHabitId = null;
    swipedRightHabitId = null;
    const updated = { ...habit, status: 'deleted' as const, updatedAt: new Date() };
    updateHabit(updated);
    if (get(user)) {
      supabaseSyncProvider.saveRecord('habits', updated.id, updated).catch(console.error);
    }
  }

  function sliderTransform(habitId: string): string {
    if (swipedRightHabitId === habitId) return `translateX(${SWIPE_THRESHOLD}px)`;
    if (swipedHabitId === habitId) return `translateX(${-SWIPE_THRESHOLD}px)`;
    if (swipingHabitId === habitId) {
      if (touchDx > 0) return `translateX(${Math.min(touchDx, SWIPE_THRESHOLD)}px)`;
      if (touchDx < 0) return `translateX(${Math.max(touchDx, -SWIPE_THRESHOLD)}px)`;
    }
    return '';
  }

  function actionsTransform(habitId: string): string {
    if (swipedHabitId === habitId) return 'translateX(0)';
    if (swipingHabitId === habitId && touchDx < 0) {
      const reveal = Math.min(Math.abs(touchDx) / SWIPE_THRESHOLD, 1);
      return `translateX(${(1 - reveal) * 100}%)`;
    }
    return 'translateX(100%)';
  }

  function leftRevealTransform(habitId: string): string {
    if (swipedRightHabitId === habitId) return 'translateX(0)';
    if (swipingHabitId === habitId && touchDx > 0) {
      const reveal = Math.min(touchDx / SWIPE_THRESHOLD, 1);
      return `translateX(${-(1 - reveal) * 100}%)`;
    }
    return 'translateX(-100%)';
  }

  let pullRefreshDistance = $state(0);
  let pullRefreshStartY = $state(0);
  let pullRefreshTriggered = $state(false);
  const PULL_THRESHOLD = 80;

  function handlePullStart(e: TouchEvent) {
    if (window.scrollY > 0) return;
    pullRefreshDistance = 0;
    pullRefreshStartY = e.touches[0].clientY;
    pullRefreshTriggered = false;
  }

  function handlePullMove(e: TouchEvent) {
    if (pullRefreshStartY === 0) return;
    const dy = e.touches[0].clientY - pullRefreshStartY;
    if (dy > 0) {
      pullRefreshDistance = Math.min(dy, PULL_THRESHOLD * 1.5);
    }
  }

  function handlePullEnd() {
    if (pullRefreshDistance >= PULL_THRESHOLD) {
      pullRefreshTriggered = true;
      window.location.reload();
    }
    pullRefreshDistance = 0;
    pullRefreshStartY = 0;
  }
</script>

<div class="page-outer"
  on:touchstart={handlePullStart}
  on:touchmove={handlePullMove}
  on:touchend={handlePullEnd}
  on:touchcancel={handlePullEnd}
>
<div class="pull-indicator" style="transform: translateY({Math.min(pullRefreshDistance - 50, 0)}px); opacity: {Math.min(pullRefreshDistance / PULL_THRESHOLD, 1)};">
  {#if pullRefreshDistance >= PULL_THRESHOLD}
    <span class="pull-icon">↻</span>
  {:else}
    <span class="pull-icon">↓</span>
  {/if}
</div>

<div class="date-nav">
  <button class="date-arrow" on:click={() => shiftDate(-1)} aria-label="Previous day">
    <Icon icon="mdi:chevron-left" />
  </button>
  <span class="date-label">{viewDate === today ? 'Today' : formatDisplayDate(viewDate)}</span>
  <button class="date-arrow" on:click={() => shiftDate(1)} disabled={viewDate === today} aria-label="Next day">
    <Icon icon="mdi:chevron-right" />
  </button>
</div>

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

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
{/if}

{#if notesHabitId}
  <NotesModal habitId={notesHabitId} date={viewDate} onClose={() => notesHabitId = null} />
{/if}

{#if depPopover}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="dep-popover-backdrop" on:click={() => depPopover = null}></div>
  <div class="dep-popover" id="page-dep-popover" style={depPopover.style} on:click|stopPropagation role="listbox">
    <div class="dep-popover-header">
      {depPopover.mode === 'and' ? 'All required' : 'Any one required'}
    </div>
    {#each depPopover.deps as r}
      <div class="dep-row" role="option" aria-selected={r.met}>
        <span class="dep-indicator" class:met={r.met}>{r.met ? '✓' : '○'}</span>
        <span class="dep-name">{r.name}</span>
      </div>
    {/each}
  </div>
{/if}

{#if filteredSuggested.length > 0}
  <section class="suggested-section">
    <button class="suggested-header" on:click={() => suggestedCollapsed = !suggestedCollapsed}>
      <span class="collapse-arrow">{suggestedCollapsed ? '▶' : '▼'}</span>
      <span class="suggested-icon">💡</span>
      Suggested
    </button>
    {#if !suggestedCollapsed}
    <div class="habits-grid">
      {#each filteredSuggested as habit (habit.id)}
        <div>
          <div class="habit-wrapper" data-habit-id={habit.id}>
            <div class="habit-slider" style="transform: {sliderTransform(habit.id)}"
              on:touchstart|nonpassive={(e) => handleTouchStart(e, habit.id)}
              on:touchmove|nonpassive={(e) => handleTouchMove(e, habit.id)}
              on:touchend={(e) => handleTouchEnd(e, habit.id)}
            >
              <HabitCard {habit} date={viewDate} onEdit={() => openEdit(habit)} onNotes={() => notesHabitId = habit.id} notesCount={notesCountMap.get(habit.id) ?? 0} onDepPopover={handleDepPopover} />
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}
  </section>
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
            <div class="left-reveal" style="transform: {leftRevealTransform(habit.id)}">
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
            </div>
            <div
              class="habit-slider"
              style="transform: {sliderTransform(habit.id)}"
              on:touchstart|nonpassive={(e) => handleTouchStart(e, habit.id)}
              on:touchmove|nonpassive={(e) => handleTouchMove(e, habit.id)}
              on:touchend={(e) => handleTouchEnd(e, habit.id)}
            >
              <HabitCard {habit} date={viewDate} onEdit={() => openEdit(habit)} onNotes={() => notesHabitId = habit.id} notesCount={notesCountMap.get(habit.id) ?? 0} onDepPopover={handleDepPopover} />
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

</div>

<style>
  .date-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .date-arrow {
    background: none;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--text-primary, #222);
    line-height: 1;
  }
  .date-arrow:disabled { opacity: 0.3; cursor: default; }
  .date-arrow :global(svg), .date-arrow :global(.iconify) { font-size: 1.25rem; }
  .date-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    min-width: 8rem;
    text-align: center;
  }
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
  .tag-section { margin-bottom: 1rem; content-visibility: auto; contain-intrinsic-size: 200px; }
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
  .suggested-section {
    margin-bottom: 1.5rem;
  }
  .suggested-section .habits-grid { margin-bottom: 0; }
  .suggested-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.75rem;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    width: 100%;
    text-align: left;
  }
  .suggested-icon { font-size: 1rem; }
  .suggested-time {
    font-size: 0.7rem;
    background: var(--accent, #0066cc);
    color: var(--accent-text, #fff);
    border-radius: 999px;
    padding: 1px 8px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .habit-wrapper {
    position: relative;
    overflow: hidden;
    overflow-anchor: none;
    content-visibility: auto;
    contain: layout style paint;
    contain-intrinsic-size: 120px;
  }
  .habit-wrapper.drop-target { outline: 2px dashed var(--text-secondary, #888); outline-offset: -2px; border-radius: 8px; }
  .drag-ghost { transition: transform 0.05s linear; }
  .left-reveal {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: stretch;
    z-index: 0;
    transition: transform 0.2s ease;
  }

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

  .dep-popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }
  .dep-popover {
    position: absolute;
    z-index: 10000;
    min-width: 160px;
    background: var(--dep-popover-bg, #f0f0f0);
    border: 1px solid var(--dep-popover-border, #ccc);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    padding: 0.4rem 0;
    font-size: 0.8rem;
    color: var(--dep-popover-text, #222);
  }
  .dep-popover-header {
    padding: 0.3rem 0.75rem 0.2rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--dep-popover-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .dep-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.75rem;
    cursor: default;
  }
  .dep-row:hover {
    background: var(--btn-secondary-bg, #f5f5f5);
  }
  .dep-indicator {
    font-size: 0.75rem;
    color: var(--text-secondary, #aaa);
    width: 1em;
    text-align: center;
    flex-shrink: 0;
  }
  .dep-indicator.met {
    color: #2e7d32;
  }
  .dep-name {
    color: var(--text-primary, #222);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 600px) {
    .habits-grid { grid-template-columns: 1fr; }
  }

  .page-outer {
    touch-action: pan-y;
    position: relative;
    overflow-anchor: none;
  }
  .pull-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: none;
    color: var(--text-secondary, #888);
    font-size: 1.5rem;
  }
  .pull-icon {
    display: inline-block;
    transition: transform 0.15s;
  }
</style>
