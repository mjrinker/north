<script lang="ts">
  import { get } from 'svelte/store';
  import { flip } from 'svelte/animate';
  import { habitsStore, updateHabit } from '../../stores/habits';
  import { pushRecord } from '../../services/sync';
  import { refreshFromServer } from '../../services/dataLoader';
  import { user } from '../../stores/auth';
  import type { Habit } from '../../types';
  import HabitCard from '../../components/HabitCard.svelte';
  import HabitCreateModal from '../../components/HabitCreateModal.svelte';
  import HabitEditModal from '../../components/HabitEditModal.svelte';
  import NotesModal from '../../components/NotesModal.svelte';
  import Icon from '@iconify/svelte';
  import type { DepPopoverState } from '../../types';
  import { notesStore } from '../../stores/notes';
  import { getLocalDateString } from '../../lib/dates';
  import { showCreateHabit } from '../../stores/createHabit';
  import { onDestroy } from 'svelte';
  import { isHabitPaused, isHabitActive, isHabitHidden, resumeHabit, expiredPausedHabits, pauseLabel, sortHabitsForMode, loadSortMode } from '../../lib/habitUtils';

  let today = getLocalDateString();
  let viewDate = $state(today);

  let allHabits = $state<Habit[]>([]);
  let unsubHabits = habitsStore.subscribe(v => allHabits = v);
  onDestroy(() => unsubHabits());

  let habits = $derived(allHabits.filter(h => isHabitActive(h) && (showHidden || !isHabitHidden(h))));
  let pausedHabits = $derived(allHabits.filter(h => isHabitPaused(h) && (showHidden || !isHabitHidden(h))));
  let hiddenHabits = $derived(allHabits.filter(h => isHabitHidden(h) && (h.status === 'active' || h.status === 'paused')));
  // Master custom order across ALL active habits (hidden ones included), so a
  // hidden habit keeps its slot when it is shown again.
  let activeOrdered = $derived(allHabits.filter(h => isHabitActive(h)).slice().sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)));
  let pausedCollapsed = $state(false);

  let showHidden = $state((() => {
    try { return localStorage.getItem('showHiddenHabits') === '1'; } catch {}
    return false;
  })());

  $effect(() => {
    try { localStorage.setItem('showHiddenHabits', showHidden ? '1' : '0'); } catch {}
  });

  let groupingEnabled = $state((() => {
    try { return localStorage.getItem('groupingEnabled') !== '0'; } catch {}
    return true;
  })());

  $effect(() => {
    try { localStorage.setItem('groupingEnabled', groupingEnabled ? '1' : '0'); } catch {}
  });

  let visibleHabits = $derived.by(() => {
    if (searchScope !== 'habits' || !searchQueryNorm) return habits;
    return habits.filter(habitMatches);
  });
  let visiblePausedHabits = $derived.by(() => {
    if (searchScope !== 'habits' || !searchQueryNorm) return pausedHabits;
    return pausedHabits.filter(habitMatches);
  });

  // Auto-resume habits whose pauseUntil date has passed
  $effect(() => {
    const list = allHabits;
    const expired = expiredPausedHabits(list);
    if (expired.length > 0) {
      for (const h of expired) updateHabit(resumeHabit(h));
    }
  });

  function handleResume(habit: Habit) {
    updateHabit(resumeHabit(habit));
  }

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

  let sortMode = $state(loadSortMode());

  $effect(() => {
    try { localStorage.setItem('sortMode', sortMode); } catch {}
  });

  let tagGroups = $derived.by(() => {
    const list = visibleHabits;
    const groups: { tag: string; habits: Habit[] }[] = [];
    if (sortMode === 'custom') {
      const ordered = sortHabitsForMode(list, 'custom');
      const pos = new Map(ordered.map((h, i) => [h.id, i]));
      const byTag = new Map<string, Habit[]>();
      const untagged: Habit[] = [];
      for (const h of ordered) {
        const tags = h.tags ?? [];
        if (tags.length === 0) { untagged.push(h); continue; }
        for (const tag of tags) {
          if (!byTag.has(tag)) byTag.set(tag, []);
          byTag.get(tag)!.push(h);
        }
      }
      const buckets: { tag: string; habits: Habit[] }[] = [];
      for (const [tag, hs] of byTag) buckets.push({ tag, habits: hs });
      if (untagged.length > 0) buckets.push({ tag: 'Untagged', habits: untagged });
      const minPos = (hs: Habit[]) => Math.min(...hs.map(h => pos.get(h.id) ?? Infinity));
      buckets.sort((a, b) => (minPos(a.habits) - minPos(b.habits)) || a.tag.localeCompare(b.tag));
      return buckets;
    }
    const tags = Array.from(new Set(list.flatMap(h => h.tags ?? []))).sort();
    for (const tag of tags) {
      let tagged = list.filter(h => (h.tags ?? []).includes(tag));
      if (sortMode === 'name') tagged = tagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') tagged = tagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag, habits: tagged });
    }
    let untagged = list.filter(h => (h.tags ?? []).length === 0);
    if (untagged.length > 0) {
      if (sortMode === 'name') untagged = untagged.sort((a, b) => a.title.localeCompare(b.title));
      else if (sortMode === 'type') untagged = untagged.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ tag: 'Untagged', habits: untagged });
    }
    return groups;
  });
  let flatVisible = $derived(sortHabitsForMode(visibleHabits, sortMode));
  let allNotes = $state<import('../../types').HabitNote[]>([]);
  let unsubNotes = notesStore.subscribe(v => allNotes = v);
  onDestroy(() => unsubNotes());
  let notesCountMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const n of allNotes) {
      if (n.date === viewDate && n.status !== 'deleted') {
        const ids = n.habitIds && n.habitIds.length ? n.habitIds : [n.habitId];
        for (const hid of ids) map.set(hid, (map.get(hid) ?? 0) + 1);
      }
    }
    return map;
  });

  // --- Global search (habits + notes) ---
  let searchQuery = $state('');
  let searchScope = $state<'habits' | 'notes'>('habits');
  let searchFocused = $state(false);
  let searchQueryNorm = $derived(searchQuery.trim().toLowerCase());

  let habitMatches = $derived((h: Habit) =>
    !searchQueryNorm ||
    h.title.toLowerCase().includes(searchQueryNorm) ||
    (h.description ?? '').toLowerCase().includes(searchQueryNorm)
  );

  let allHabitsById = $derived(new Map(allHabits.map(h => [h.id, h] as [string, Habit])));

  let matchingNotes = $derived.by(() => {
    if (searchScope !== 'notes' || !searchQueryNorm) return [];
    return allNotes
      .filter(n => n.status !== 'deleted' && n.content.toLowerCase().includes(searchQueryNorm))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  });

  function focusSearch(scope: 'habits' | 'notes') {
    searchScope = scope;
    searchFocused = true;
  }

  function openNoteResult(note: import('../../types').HabitNote) {
    viewDate = note.date;
    notesHabitId = note.habitId;
    searchQuery = '';
    searchFocused = false;
  }

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

  function applyOrder(ids: string[]) {
    const byId = new Map(activeOrdered.map(h => [h.id, h]));
    ids.forEach((id, idx) => {
      const h = byId.get(id);
      if (h && h.sortOrder !== idx) {
        updateHabit({ ...h, sortOrder: idx });
      }
    });
  }

  function reorder(fromId: string, targetId: string) {
    if (!fromId || fromId === targetId) return;
    const ids = activeOrdered.map(h => h.id);
    let fromIdx = ids.indexOf(fromId);
    let toIdx = ids.indexOf(targetId);
    if (fromIdx === -1) { ids.push(fromId); fromIdx = ids.length - 1; }
    if (toIdx === -1) { ids.push(targetId); toIdx = ids.length - 1; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, fromId);
    applyOrder(ids);
  }

  function habitInGroup(habit: Habit, tag: string): boolean {
    return tag === 'Untagged' ? (habit.tags ?? []).length === 0 : (habit.tags ?? []).includes(tag);
  }

  // Moves a whole group (all its members as a block) in the single master
  // custom order, so grouped and flat views stay in sync when toggled.
  function reorderGroup(fromTag: string, targetTag: string) {
    if (!fromTag || fromTag === targetTag) return;
    const ordered = activeOrdered;
    const fromIds = ordered.filter(h => habitInGroup(h, fromTag)).map(h => h.id);
    if (fromIds.length === 0) return;
    const fromSet = new Set(fromIds);
    const targets = new Set(ordered.filter(h => habitInGroup(h, targetTag)).map(h => h.id));
    const after = ordered.map(h => h.id).filter(id => !fromSet.has(id));
    let at = after.findIndex(id => targets.has(id));
    if (at === -1) at = after.length;
    after.splice(at, 0, ...fromIds);
    applyOrder(after);
  }

  let dragGroupTag = $state<string | null>(null);

  function handleGroupDragStart(e: DragEvent, tag: string) {
    if (sortMode !== 'custom') return;
    dragGroupTag = tag;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', tag);
  }

  function handleGroupDragOver(e: DragEvent, tag: string) {
    if (sortMode !== 'custom' || !dragGroupTag || dragGroupTag === tag) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    clearGroupDropTargets();
    (e.currentTarget as HTMLElement).closest<HTMLElement>('.tag-header-row')?.classList.add('drop-target');
  }

  function handleGroupDrop(e: DragEvent, tag: string) {
    e.preventDefault();
    clearGroupDropTargets();
    const fromTag = e.dataTransfer?.getData('text/plain') || dragGroupTag;
    if (fromTag) { reorderGroup(fromTag, tag); }
    dragGroupTag = null;
  }

  function handleGroupDragEnd() {
    clearGroupDropTargets();
    dragGroupTag = null;
  }

  function clearGroupDropTargets() {
    document.querySelectorAll('.tag-header-row.drop-target').forEach(n => n.classList.remove('drop-target'));
  }

  // Touch drag for group headers (mobile)
  let touchGroupFrom: string | null = null;
  let touchGroupTarget: string | null = null;

  function handleGroupTouchStart(e: TouchEvent, tag: string) {
    if (sortMode !== 'custom') return;
    e.preventDefault();
    e.stopPropagation();
    touchGroupFrom = tag;
    touchGroupTarget = null;
  }

  function handleGroupTouchMove(e: TouchEvent) {
    if (!touchGroupFrom) return;
    e.preventDefault();
    e.stopPropagation();
    const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const el = target?.closest<HTMLElement>('.tag-header-row');
    if (el && el.dataset.tag && el.dataset.tag !== touchGroupFrom) {
      clearGroupDropTargets();
      el.classList.add('drop-target');
      touchGroupTarget = el.dataset.tag;
    }
  }

  function handleGroupTouchEnd() {
    if (!touchGroupFrom) return;
    clearGroupDropTargets();
    if (touchGroupTarget && touchGroupTarget !== touchGroupFrom) reorderGroup(touchGroupFrom, touchGroupTarget);
    touchGroupFrom = null;
    touchGroupTarget = null;
  }

  // HTML5 drag-and-drop (desktop)
  function handleDragStart(e: DragEvent, habitId: string) {
    if (sortMode !== 'custom') return;
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

  let handlePx = 0;
  let actionsPx = 0;
  let dragId = $state<string | null>(null);
  let dragStartX = 0;
  let dragStartOffset = 0;
  let dragOffsetX = $state(0);
  let swipedActionsId = $state<string | null>(null);
  let swipedHandleId = $state<string | null>(null);

  function currentOffset(id: string): number {
    if (dragId === id) {
      return Math.max(-actionsPx, Math.min(handlePx, dragStartOffset + dragOffsetX));
    }
    if (swipedActionsId === id) return -actionsPx;
    if (swipedHandleId === id) return handlePx;
    return 0;
  }

  function handleTouchStart(e: TouchEvent, habitId: string) {
    if (swipedActionsId && swipedActionsId !== habitId) swipedActionsId = null;
    if (swipedHandleId && swipedHandleId !== habitId) swipedHandleId = null;
    const first = e.touches[0];
    if (first.clientY > window.innerHeight - 40) return;
    const wrap = (e.currentTarget as HTMLElement).closest('.habit-wrapper');
    const l = wrap?.querySelector<HTMLElement>('.left-reveal');
    const r = wrap?.querySelector<HTMLElement>('.swipe-actions');
    handlePx = l?.offsetWidth ?? 0;
    actionsPx = r?.offsetWidth ?? 0;
    dragStartOffset = currentOffset(habitId);
    dragStartX = first.clientX;
    dragOffsetX = 0;
    dragId = habitId;
    if (swipedActionsId === habitId) swipedActionsId = null;
    if (swipedHandleId === habitId) swipedHandleId = null;
  }

  function handleTouchMove(e: TouchEvent, habitId: string) {
    if (dragId !== habitId) return;
    dragOffsetX = e.touches[0].clientX - dragStartX;
  }

  function handleTouchEnd(e: TouchEvent, habitId: string) {
    if (dragId !== habitId) return;
    const off = currentOffset(habitId);
    dragId = null;
    dragOffsetX = 0;
    if (off > handlePx * 0.5) {
      swipedHandleId = habitId;
      swipedActionsId = null;
    } else if (off < -actionsPx * 0.5) {
      swipedActionsId = habitId;
      swipedHandleId = null;
    } else {
      swipedActionsId = null;
      swipedHandleId = null;
    }
  }

  function openEdit(habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    editingHabit = habit;
  }

  async function archiveHabit(habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    const updated = { ...habit, status: 'archived' as const, updatedAt: new Date() };
    updateHabit(updated);
    if (get(user)) {
      pushRecord('habits', updated.id, updated).catch(console.error);
    }
  }

  function deleteHabit(habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    const updated = { ...habit, status: 'deleted' as const, updatedAt: new Date() };
    updateHabit(updated);
    if (get(user)) {
      pushRecord('habits', updated.id, updated).catch(console.error);
    }
  }

  function unhideHabit(habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    const updated = { ...habit, metadata: { ...habit.metadata, hidden: undefined }, updatedAt: new Date() };
    updateHabit(updated);
  }

  function hideHabit(habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    const updated = { ...habit, metadata: { ...habit.metadata, hidden: true }, updatedAt: new Date() };
    updateHabit(updated);
  }

  let moreMenuHabit = $state<Habit | null>(null);
  let moreMenuStyle = $state('');

  function openMoreMenu(e: MouseEvent | TouchEvent, habit: Habit) {
    swipedActionsId = null;
    swipedHandleId = null;
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();
    moreMenuStyle = `top: ${el.bottom + 4}px; right: ${window.innerWidth - el.right}px;`;
    moreMenuHabit = habit;
  }

  function sliderTransform(id: string): string {
    const off = currentOffset(id);
    if (off === 0) return '';
    return `translateX(${off}px)`;
  }

  let pullRefreshDistance = $state(0);
  let pullRefreshStartY = $state(0);
  let pullRefreshTriggered = $state(false);
  const PULL_THRESHOLD = 80;

  function handlePullStart(e: TouchEvent) {
    if (showCreate || editingHabit !== null || notesHabitId !== null || depPopover !== null) return;
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

  async function handlePullEnd() {
    if (pullRefreshDistance >= PULL_THRESHOLD) {
      pullRefreshTriggered = true;
      pullRefreshDistance = PULL_THRESHOLD;
      await refreshFromServer();
    }
    pullRefreshDistance = 0;
    pullRefreshStartY = 0;
    pullRefreshTriggered = false;
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
  <div class="search-bar" class:active={searchFocused}>
    <input
      type="search"
      bind:value={searchQuery}
      placeholder={searchScope === 'notes' ? 'Search notes…' : 'Search habits…'}
      on:focus={() => searchFocused = true}
      on:blur={() => setTimeout(() => searchFocused = false, 150)}
      aria-label="Search"
    />
    {#if searchFocused}
      <div class="search-scope" role="group" aria-label="Search scope">
        <button type="button" class:active={searchScope === 'habits'} on:click={() => focusSearch('habits')}>Habits</button>
        <button type="button" class:active={searchScope === 'notes'} on:click={() => focusSearch('notes')}>Notes</button>
      </div>
    {/if}
  </div>
  <label class="sort-label">
    Sort:
    <select bind:value={sortMode}>
      <option value="tag">Tag</option>
      <option value="name">Name</option>
      <option value="type">Type</option>
      <option value="custom">Custom</option>
    </select>
  </label>
  <button
    class="tool-icon-btn"
    class:active={groupingEnabled}
    on:click={() => groupingEnabled = !groupingEnabled}
    aria-label={groupingEnabled ? 'Turn off grouping' : 'Turn on grouping'}
    aria-pressed={groupingEnabled}
  >
    <Icon icon={groupingEnabled ? 'mdi:view-grid' : 'mdi:view-list'} />
  </button>
  <button
    class="tool-icon-btn"
    class:active={showHidden}
    on:click={() => showHidden = !showHidden}
    aria-label={showHidden ? 'Hide hidden habits' : 'Show hidden habits'}
    aria-pressed={showHidden}
  >
    <Icon icon={showHidden ? 'mdi:eye' : 'mdi:eye-off'} />
    {#if hiddenHabits.length > 0}
      <span class="hidden-badge">{hiddenHabits.length}</span>
    {/if}
  </button>
</div>

{#if searchScope === 'notes' && searchFocused && matchingNotes.length > 0}
  <div class="note-results" role="listbox">
    {#each matchingNotes as note (note.id)}
      <button type="button" class="note-result" role="option" on:click={() => openNoteResult(note)}>
        <span class="nr-title">{allHabitsById.get(note.habitId)?.title ?? 'Unknown habit'}</span>
        <span class="nr-date">{note.date}</span>
        <span class="nr-snippet">{note.content}</span>
      </button>
    {/each}
  </div>
{/if}

{#if showCreate}
  <HabitCreateModal {habits} onClose={() => showCreate = false} />
{/if}

{#if editingHabit}
  <HabitEditModal habit={editingHabit} allHabits={habits} onClose={() => editingHabit = null} />
{/if}

{#if notesHabitId}
  <NotesModal habitId={notesHabitId} date={viewDate} allHabits={allHabits} onClose={() => notesHabitId = null} />
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

{#if moreMenuHabit}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="dep-popover-backdrop" on:click={() => moreMenuHabit = null}></div>
  <div class="dep-popover more-menu" style={moreMenuStyle} on:click|stopPropagation role="menu">
    <button class="menu-row" role="menuitem" on:click={() => { if (moreMenuHabit) { archiveHabit(moreMenuHabit); moreMenuHabit = null; } }}>
      <Icon icon="mdi:archive-outline" />
      Archive
    </button>
    <button class="menu-row danger" role="menuitem" on:click={() => { if (moreMenuHabit) { deleteHabit(moreMenuHabit); moreMenuHabit = null; } }}>
      <Icon icon="mdi:trash-can-outline" />
      Delete
    </button>
  </div>
{/if}

{#snippet habitItem(habit: Habit, i: number, count: number)}
  <div class="habit-wrapper" class:habit-hidden={isHabitHidden(habit)} data-habit-id={habit.id}>
    <div class="left-reveal">
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
      <div class="habit-dim">
        <HabitCard {habit} date={viewDate} onEdit={() => openEdit(habit)} onNotes={() => notesHabitId = habit.id} notesCount={notesCountMap.get(habit.id) ?? 0} onDepPopover={handleDepPopover} isFirst={i === 0} isLast={i === count - 1} />
      </div>
    </div>
    <div class="swipe-actions">
      <button class="swipe-btn hide" on:click={() => isHabitHidden(habit) ? unhideHabit(habit) : hideHabit(habit)} aria-label={isHabitHidden(habit) ? 'Show' : 'Hide'}>
        {#if isHabitHidden(habit)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        {/if}
      </button>
      <button class="swipe-btn more" on:click={(e) => openMoreMenu(e, habit)} aria-label="More actions" aria-haspopup="menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
  </div>
{/snippet}

{#if groupingEnabled}
  {#each tagGroups as group}
    <div class="tag-section">
      <div class="tag-header-row" class:drop-target={false} data-tag={group.tag}>
        <button class="tag-header" on:click={() => toggleGroup(group.tag)}>
          <span class="collapse-arrow">{collapsedGroups.has(group.tag) ? '▶' : '▼'}</span>
          {group.tag}
        </button>
        {#if sortMode === 'custom'}
          <span
            class="group-drag-handle"
            role="button"
            tabindex="0"
            draggable="true"
            on:dragstart={(e) => handleGroupDragStart(e, group.tag)}
            on:dragover={(e) => handleGroupDragOver(e, group.tag)}
            on:drop={(e) => handleGroupDrop(e, group.tag)}
            on:dragend={handleGroupDragEnd}
            on:touchstart|nonpassive={(e) => handleGroupTouchStart(e, group.tag)}
            on:touchmove|nonpassive={(e) => handleGroupTouchMove(e)}
            on:touchend={handleGroupTouchEnd}
            aria-label="Reorder group"
          ><Icon icon="mdi:drag" /></span>
        {/if}
      </div>
      {#if !collapsedGroups.has(group.tag)}
      <div class="habits-grid"
        on:dragover={handleGridDragOver}
        on:drop={handleGridDrop}
        on:dragend={handleDragEnd}
      >
        {#each group.habits as habit, i (habit.id)}
          <div animate:flip={{ duration: 200 }}>
            {@render habitItem(habit, i, group.habits.length)}
          </div>
{/each}
      </div>
      {/if}
    </div>
  {/each}
{:else}
  <div class="habits-grid"
    on:dragover={handleGridDragOver}
    on:drop={handleGridDrop}
    on:dragend={handleDragEnd}
  >
    {#each flatVisible as habit, i (habit.id)}
      <div animate:flip={{ duration: 200 }}>
        {@render habitItem(habit, i, flatVisible.length)}
      </div>
    {/each}
  </div>
{/if}

{#if searchScope === 'habits' && searchQueryNorm && visibleHabits.length === 0}
  <p class="search-empty">No habits match "{searchQuery}".</p>
{/if}

{#if visiblePausedHabits.length > 0}
  <section class="tag-section paused-section">
    <button class="tag-header" on:click={() => pausedCollapsed = !pausedCollapsed}>
      <span class="collapse-arrow">{pausedCollapsed ? '▶' : '▼'}</span>
      Paused ({visiblePausedHabits.length})
    </button>
    {#if !pausedCollapsed}
    <div class="habits-grid">
      {#each visiblePausedHabits as habit (habit.id)}
        <div class="paused-card" role="button" tabindex="0" on:click={() => openEdit(habit)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(habit); } }}>
          {#if habit.metadata?.emoji}
            <span class="paused-glyph">{habit.metadata.emoji}</span>
          {:else if habit.metadata?.icon}
            <span class="paused-glyph"><Icon icon={habit.metadata.icon} style="color: inherit" /></span>
          {/if}
          <div class="paused-body">
            <span class="paused-title">{habit.title}</span>
            <span class="paused-info">{pauseLabel(habit)}</span>
          </div>
          <button class="paused-resume" on:click={(e) => { e.stopPropagation(); handleResume(habit); }}>Resume</button>
        </div>
      {/each}
    </div>
    {/if}
  </section>
{/if}

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
    border-radius: 0;
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

  .search-bar {
    position: relative;
    flex: 1 1 100%;
    display: flex;
  }
  .search-bar input[type='search'] {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    font-size: 0.9rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
  }
  .search-bar input[type='search']:focus { outline: none; border-color: var(--accent, #0066cc); }
  .search-bar.active input[type='search'] { border-color: var(--accent, #0066cc); }

  .search-scope {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    display: flex;
    gap: 0.25rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #ccc);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 0.25rem;
    z-index: 30;
  }
  .search-scope button {
    border: none;
    background: none;
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    border-radius: 0;
    font-weight: 500;
  }
  .search-scope button.active {
    background: var(--accent, #0066cc);
    color: var(--accent-text, white);
  }

  .note-results {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #ccc);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    margin: 0 0 1rem;
    max-height: 40vh;
    overflow-y: auto;
    z-index: 30;
  }
  .note-result {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 0.5rem 0.6rem;
    cursor: pointer;
    border-bottom: 1px solid var(--card-border, #e0e0e0);
    font-family: inherit;
    border-radius: 0;
    color: var(--text-primary, #222);
  }
  .note-result:last-child { border-bottom: none; }
  .note-result:hover, .note-result:focus { background: var(--btn-secondary-bg, #eee); }
  .note-result .nr-title { font-weight: 600; font-size: 0.85rem; }
  .note-result .nr-date { margin-left: 0.4rem; font-size: 0.72rem; color: var(--text-secondary, #888); }
  .note-result .nr-snippet {
    display: block;
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .search-empty {
    margin: 0.5rem 0 1rem;
    color: var(--text-secondary, #888);
    font-size: 0.85rem;
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
    border-radius: 0;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .tool-icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.1rem;
    height: 2.1rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--input-bg, #fff);
    color: var(--text-secondary, #666);
    cursor: pointer;
    flex-shrink: 0;
    line-height: 1;
  }
  .tool-icon-btn :global(svg), .tool-icon-btn :global(.iconify) { font-size: 1.2rem; }
  .tool-icon-btn:hover { border-color: var(--accent, #0066cc); color: var(--text-primary, #222); }
  .tool-icon-btn.active {
    border-color: var(--accent, #0066cc);
    color: var(--accent, #0066cc);
    background: rgba(0, 102, 204, 0.08);
  }
  .hidden-badge {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    min-width: 0.95rem;
    height: 0.95rem;
    padding: 0 0.2rem;
    border-radius: 999px;
    background: #f59e0b;
    color: #fff;
    font-size: 0.62rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .tag-section { margin-bottom: 1rem; content-visibility: auto; contain-intrinsic-size: 200px; }
  .tag-header-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .tag-section + .tag-section .tag-header-row { margin-top: 1rem; }
  .tag-header-row .tag-header {
    flex: 1;
    min-width: 0;
    margin: 0;
  }
  .tag-header-row.drop-target .tag-header {
    outline: 2px dashed var(--text-secondary, #888);
    outline-offset: -2px;
  }
  .group-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    flex-shrink: 0;
    cursor: grab;
    color: var(--text-secondary, #888);
    touch-action: none;
  }
  .group-drag-handle:active { cursor: grabbing; }
  .group-drag-handle :global(svg), .group-drag-handle :global(.iconify) { font-size: 1.3rem; }
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
  .habit-dim {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
  }
  .habit-wrapper.habit-hidden .habit-dim::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    background: rgba(128, 128, 128, 0.35);
    pointer-events: none;
  }
  .collapse-arrow {
    font-size: 0.7rem;
    width: 1rem;
    flex-shrink: 0;
  }
  .habits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 0;
    margin-bottom: 2rem;
  }
  .paused-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--card-bg, #fff);
    border: 1px dashed var(--card-border, #ccc);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    opacity: 0.75;
  }
  .paused-card:hover { opacity: 1; border-color: var(--text-secondary, #888); }
  .paused-glyph { font-size: 1.15rem; line-height: 1; }
  .paused-glyph :global(svg), .paused-glyph :global(.iconify) { font-size: 1.15rem; color: inherit; }
  .paused-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .paused-title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary, #222); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .paused-info { font-size: 0.75rem; color: var(--text-secondary, #888); }
  .paused-resume {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--accent, #0066cc);
    border-radius: 999px;
    background: transparent;
    color: var(--accent, #0066cc);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
  }
  .paused-resume:hover { background: var(--accent, #0066cc); color: var(--accent-text, #fff); }
  .paused-section .habits-grid { margin-bottom: 0; }
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
  .swipe-btn.hide { background: #64748b; }
  .swipe-btn.more { background: var(--text-secondary, #777); }

  .more-menu { min-width: 150px; }
  .menu-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 0.85rem;
    color: var(--text-primary, #222);
    cursor: pointer;
    text-align: left;
    border-radius: 0;
  }
  .menu-row :global(svg), .menu-row :global(.iconify) { font-size: 1.1rem; flex-shrink: 0; }
  .menu-row:hover { background: var(--btn-secondary-bg, #f5f5f5); }
  .menu-row.danger { color: #d32f2f; }

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
