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
    const y = new Date(today + 'T12:00:00');
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }

  function formatLongDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Svelte 5 event attributes register touch listeners as passive, but the
  // drag handlers need preventDefault, so wire those up non-passively.
  type TouchHandlers = { start?: (e: TouchEvent) => void; move?: (e: TouchEvent) => void; end?: (e: TouchEvent) => void };
  function touch(node: HTMLElement, handlers: TouchHandlers) {
    let h = handlers;
    const start = (e: TouchEvent) => h.start?.(e);
    const move = (e: TouchEvent) => h.move?.(e);
    const end = (e: TouchEvent) => h.end?.(e);
    node.addEventListener('touchstart', start, { passive: false });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    return {
      update(next: TouchHandlers) { h = next; },
      destroy() {
        node.removeEventListener('touchstart', start);
        node.removeEventListener('touchmove', move);
        node.removeEventListener('touchend', end);
      },
    };
  }

  let viewMenuOpen = $state(false);
  const SORT_LABELS: Record<string, string> = { tag: 'Tag', name: 'Name', type: 'Type', custom: 'Custom' };

  // Only label groups when there's more than one; the untagged bucket reads as "Other".
  function groupLabel(tag: string): string {
    return tag === 'Untagged' ? 'Other' : tag;
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
    (e.currentTarget as HTMLElement).closest<HTMLElement>('.group-head')?.classList.add('drop-target');
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
    document.querySelectorAll('.group-head.drop-target').forEach(n => n.classList.remove('drop-target'));
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
    const el = target?.closest<HTMLElement>('.group-head');
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

<div class="page-outer" role="presentation"
  ontouchstart={handlePullStart}
  ontouchmove={handlePullMove}
  ontouchend={handlePullEnd}
  ontouchcancel={handlePullEnd}
>
<div class="pull-indicator" style="transform: translateY({Math.min(pullRefreshDistance - 50, 0)}px); opacity: {Math.min(pullRefreshDistance / PULL_THRESHOLD, 1)};">
  <span class="pull-icon" class:ready={pullRefreshDistance >= PULL_THRESHOLD}><Icon icon="mdi:arrow-down" /></span>
</div>

<div class="page today">
  <header class="today-header">
    <div class="header-top">
      <span class="date-sub">{formatLongDate(viewDate)}</span>
      <div class="header-actions">
        <button class="icon-btn" onclick={() => shiftDate(-1)} aria-label="Previous day"><Icon icon="mdi:chevron-left" /></button>
        <button class="icon-btn" onclick={() => shiftDate(1)} disabled={viewDate === today} aria-label="Next day"><Icon icon="mdi:chevron-right" /></button>
        <button class="icon-btn add" onclick={() => showCreate = true} aria-label="New habit"><Icon icon="mdi:plus" /></button>
      </div>
    </div>
    <h1 class="page-title">
      {formatDisplayDate(viewDate)}
      {#if viewDate !== today}
        <button class="btn-plain back-today" onclick={() => viewDate = today}>Back to today</button>
      {/if}
    </h1>
  </header>

  <div class="toolbar">
    <div class="search-field" class:focused={searchFocused}>
      <Icon icon="mdi:magnify" />
      <input
        type="search"
        bind:value={searchQuery}
        placeholder={searchScope === 'notes' ? 'Search notes' : 'Search habits'}
        onfocus={() => searchFocused = true}
        onblur={() => setTimeout(() => searchFocused = false, 150)}
        aria-label="Search"
      />
    </div>
    <div class="view-menu-wrap">
      <button class="icon-btn" class:on={viewMenuOpen} onclick={() => viewMenuOpen = !viewMenuOpen} aria-label="View options" aria-expanded={viewMenuOpen}>
        <Icon icon="mdi:tune-variant" />
        {#if showHidden && hiddenHabits.length > 0}<span class="dot"></span>{/if}
      </button>
      {#if viewMenuOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="menu-backdrop" onclick={() => viewMenuOpen = false}></div>
        <div class="menu view-menu" role="menu">
          <div class="menu-label">Sort by</div>
          <div class="segmented">
            {#each Object.entries(SORT_LABELS) as [value, label]}
              <button class:active={sortMode === value} onclick={() => sortMode = value as typeof sortMode}>{label}</button>
            {/each}
          </div>
          <label class="menu-toggle">
            <span>Group by tag</span>
            <input type="checkbox" class="switch" bind:checked={groupingEnabled} />
          </label>
          <label class="menu-toggle">
            <span>Show hidden{hiddenHabits.length ? ` (${hiddenHabits.length})` : ''}</span>
            <input type="checkbox" class="switch" bind:checked={showHidden} />
          </label>
        </div>
      {/if}
    </div>
  </div>

  {#if searchFocused}
    <div class="segmented search-scope" role="group" aria-label="Search scope">
      <button type="button" class:active={searchScope === 'habits'} onclick={() => focusSearch('habits')}>Habits</button>
      <button type="button" class:active={searchScope === 'notes'} onclick={() => focusSearch('notes')}>Notes</button>
    </div>
  {/if}

  {#if searchScope === 'notes' && searchFocused && matchingNotes.length > 0}
    <div class="group note-results" role="listbox">
      {#each matchingNotes as note (note.id)}
        <button type="button" class="row note-result" role="option" aria-selected="false" onclick={() => openNoteResult(note)}>
          <span class="nr-head"><span class="nr-title">{allHabitsById.get(note.habitId)?.title ?? 'Unknown habit'}</span><span class="nr-date">{note.date}</span></span>
          <span class="nr-snippet">{note.content}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#snippet habitItem(habit: Habit, i: number, count: number)}
    <div class="habit-wrapper" class:habit-hidden={isHabitHidden(habit)} data-habit-id={habit.id}>
      <div class="left-reveal">
        {#if sortMode === 'custom'}
          <span
            class="drag-handle"
            role="button"
            tabindex="-1"
            aria-label="Reorder"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, habit.id)}
            use:touch={{ start: (e) => handleTouchDragStart(e, habit.id), move: handleTouchDragMove, end: handleTouchDragEnd }}
          ><Icon icon="mdi:drag-horizontal-variant" /></span>
        {/if}
      </div>
      <div
        class="habit-slider"
        style="transform: {sliderTransform(habit.id)}"
        use:touch={{ start: (e) => handleTouchStart(e, habit.id), move: (e) => handleTouchMove(e, habit.id), end: (e) => handleTouchEnd(e, habit.id) }}
      >
        <div class="habit-dim">
          <HabitCard {habit} date={viewDate} onEdit={() => openEdit(habit)} onNotes={() => notesHabitId = habit.id} notesCount={notesCountMap.get(habit.id) ?? 0} onDepPopover={handleDepPopover} isFirst={i === 0} isLast={i === count - 1} />
        </div>
      </div>
      <div class="swipe-actions">
        <button class="swipe-btn hide" onclick={() => isHabitHidden(habit) ? unhideHabit(habit) : hideHabit(habit)}>
          <Icon icon={isHabitHidden(habit) ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} />
          <span>{isHabitHidden(habit) ? 'Show' : 'Hide'}</span>
        </button>
        <button class="swipe-btn more" onclick={(e) => openMoreMenu(e, habit)} aria-haspopup="menu">
          <Icon icon="mdi:dots-horizontal" />
          <span>More</span>
        </button>
      </div>
    </div>
  {/snippet}

  {#if allHabits.length === 0}
    <div class="first-run">
      <h2>Start with one habit</h2>
      <p>Pick something small enough to do on your worst day.</p>
      <button class="btn" onclick={() => showCreate = true}><Icon icon="mdi:plus" />New habit</button>
    </div>
  {:else if groupingEnabled}
    {#each tagGroups as group (group.tag)}
      <section class="habit-group">
        {#if tagGroups.length > 1 || group.tag !== 'Untagged'}
          <div class="group-head" data-tag={group.tag}>
            <button class="group-toggle" onclick={() => toggleGroup(group.tag)} aria-expanded={!collapsedGroups.has(group.tag)}>
              <span>{groupLabel(group.tag)}</span>
              <span class="group-count tabular">{group.habits.length}</span>
              <Icon icon="mdi:chevron-down" class="chev {collapsedGroups.has(group.tag) ? 'collapsed' : ''}" />
            </button>
            {#if sortMode === 'custom'}
              <span
                class="group-drag-handle"
                role="button"
                tabindex="0"
                draggable="true"
                ondragstart={(e) => handleGroupDragStart(e, group.tag)}
                ondragover={(e) => handleGroupDragOver(e, group.tag)}
                ondrop={(e) => handleGroupDrop(e, group.tag)}
                ondragend={handleGroupDragEnd}
                use:touch={{ start: (e) => handleGroupTouchStart(e, group.tag), move: handleGroupTouchMove, end: handleGroupTouchEnd }}
                aria-label="Reorder group"
              ><Icon icon="mdi:drag-horizontal-variant" /></span>
            {/if}
          </div>
        {/if}
        {#if !collapsedGroups.has(group.tag)}
          <div class="group list" role="list"
            ondragover={handleGridDragOver}
            ondrop={handleGridDrop}
            ondragend={handleDragEnd}
          >
            {#each group.habits as habit, i (habit.id)}
              <div animate:flip={{ duration: 200 }} role="listitem">
                {@render habitItem(habit, i, group.habits.length)}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {:else}
    <div class="group list habit-group" role="list"
      ondragover={handleGridDragOver}
      ondrop={handleGridDrop}
      ondragend={handleDragEnd}
    >
      {#each flatVisible as habit, i (habit.id)}
        <div animate:flip={{ duration: 200 }} role="listitem">
          {@render habitItem(habit, i, flatVisible.length)}
        </div>
      {/each}
    </div>
  {/if}

  {#if searchScope === 'habits' && searchQueryNorm && visibleHabits.length === 0}
    <p class="empty">No habits match “{searchQuery}”.</p>
  {/if}

  {#if visiblePausedHabits.length > 0}
    <section class="habit-group paused-section">
      <div class="group-head">
        <button class="group-toggle" onclick={() => pausedCollapsed = !pausedCollapsed} aria-expanded={!pausedCollapsed}>
          <span>Paused</span>
          <span class="group-count tabular">{visiblePausedHabits.length}</span>
          <Icon icon="mdi:chevron-down" class="chev {pausedCollapsed ? 'collapsed' : ''}" />
        </button>
      </div>
      {#if !pausedCollapsed}
        <div class="group list">
          {#each visiblePausedHabits as habit (habit.id)}
            <div class="row paused-row" role="button" tabindex="0" onclick={() => openEdit(habit)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(habit); } }}>
              <span class="paused-glyph" style="color: {habit.metadata?.color || 'var(--text-2)'}">
                {#if habit.metadata?.emoji}{habit.metadata.emoji}{:else if habit.metadata?.icon}<Icon icon={habit.metadata.icon} />{/if}
              </span>
              <div class="row-label">
                <div class="paused-title">{habit.title}</div>
                <div class="paused-info">{pauseLabel(habit)}</div>
              </div>
              <button class="btn btn-sm btn-secondary" onclick={(e) => { e.stopPropagation(); handleResume(habit); }}>Resume</button>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

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
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="menu-backdrop" onclick={() => depPopover = null}></div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="menu dep-popover" id="page-dep-popover" style={depPopover.style} onclick={(e) => e.stopPropagation()} role="listbox" tabindex="-1">
    <div class="menu-label">{depPopover.mode === 'and' ? 'Needs all of' : 'Needs any of'}</div>
    {#each depPopover.deps as r}
      <div class="dep-row" role="option" aria-selected={r.met}>
        <Icon icon={r.met ? 'mdi:check-circle' : 'mdi:circle-outline'} class={r.met ? 'dep-met' : 'dep-unmet'} />
        <span>{r.name}</span>
      </div>
    {/each}
  </div>
{/if}

{#if moreMenuHabit}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="menu-backdrop" onclick={() => moreMenuHabit = null}></div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="menu more-menu" style={moreMenuStyle} onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
    <button class="menu-row" role="menuitem" onclick={() => { if (moreMenuHabit) { archiveHabit(moreMenuHabit); moreMenuHabit = null; } }}>
      <span>Archive</span><Icon icon="mdi:archive-outline" />
    </button>
    <button class="menu-row danger" role="menuitem" onclick={() => { if (moreMenuHabit) { deleteHabit(moreMenuHabit); moreMenuHabit = null; } }}>
      <span>Delete</span><Icon icon="mdi:trash-can-outline" />
    </button>
  </div>
{/if}
</div>

<style>
  .today-header {
    margin-bottom: var(--space-3);
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 calc(-1 * var(--space-2)) 0 0;
  }

  .date-sub {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  .header-actions {
    display: flex;
    align-items: center;
  }

  .icon-btn.add {
    color: var(--accent);
    font-size: 26px;
  }

  .today .page-title {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .back-today {
    font-size: var(--text-base);
    font-weight: 500;
    letter-spacing: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .search-field {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 var(--space-3);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 19px;
    transition: box-shadow 0.15s;
  }

  .search-field.focused {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .search-field input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--text);
    outline: none;
  }

  .search-field input::-webkit-search-cancel-button {
    filter: grayscale(1);
  }

  .view-menu-wrap {
    position: relative;
  }

  .view-menu-wrap .icon-btn {
    position: relative;
  }

  .icon-btn.on {
    background: var(--surface-2);
    color: var(--text);
  }

  .dot {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }

  .search-scope {
    margin-bottom: var(--space-3);
  }

  /* Pop-over menus (view options, conditions, row actions). */
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
  }

  .menu {
    position: fixed;
    z-index: 61;
    min-width: 200px;
    padding: var(--space-2);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    animation: pop 0.14s var(--ease);
  }

  @keyframes pop {
    from { opacity: 0; transform: scale(0.96); }
  }

  .view-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transform-origin: top right;
  }

  .menu-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-2);
    padding: var(--space-1) var(--space-1) 0;
  }

  .menu-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1);
    font-size: var(--text-base);
    cursor: pointer;
  }

  .dep-popover {
    position: absolute;
    min-width: 220px;
  }

  .dep-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px var(--space-1);
    font-size: var(--text-base);
  }

  .dep-row :global(.dep-met) { color: var(--success); font-size: 18px; }
  .dep-row :global(.dep-unmet) { color: var(--text-3); font-size: 18px; }

  .more-menu {
    padding: var(--space-1) 0;
    transform-origin: top right;
  }

  .menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    font-size: var(--text-base);
    color: var(--text);
    font-size: var(--text-md);
  }

  .menu-row :global(svg) { font-size: 20px; color: var(--text-2); }
  .menu-row + .menu-row { border-top: 0.5px solid var(--separator-strong); }
  .menu-row.danger, .menu-row.danger :global(svg) { color: var(--danger); }
  .menu-row:active { background: var(--surface-2); }

  /* Notes search results */
  .note-results {
    margin-bottom: var(--space-4);
  }

  .note-result {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    width: 100%;
    text-align: left;
    padding-top: var(--space-3);
    padding-bottom: var(--space-3);
  }

  .nr-head { display: flex; justify-content: space-between; gap: var(--space-2); }
  .nr-title { font-weight: 600; }
  .nr-date { font-size: var(--text-sm); color: var(--text-3); }
  .nr-snippet { font-size: var(--text-sm); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Groups */
  .habit-group {
    margin-bottom: var(--space-5);
  }

  .group-head {
    display: flex;
    align-items: center;
    padding: 0 var(--space-1) 0 var(--space-4);
    margin-bottom: 6px;
  }

  :global(.group-head.drop-target) .group-toggle {
    color: var(--accent);
  }

  .group-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-2);
    text-align: left;
  }

  .group-count {
    font-weight: 500;
    color: var(--text-3);
  }

  .group-toggle :global(.chev) {
    margin-left: auto;
    font-size: 18px;
    color: var(--text-3);
    transition: transform 0.2s var(--ease);
  }

  .group-toggle :global(.chev.collapsed) {
    transform: rotate(-90deg);
  }

  .group-drag-handle,
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    color: var(--text-3);
    font-size: 22px;
    cursor: grab;
    touch-action: none;
  }

  .group-drag-handle:active,
  .drag-handle:active {
    cursor: grabbing;
  }

  .list > div + div {
    position: relative;
  }

  .list > div + div::before {
    content: '';
    position: absolute;
    top: 0;
    left: 68px;
    right: 0;
    z-index: 3;
    border-top: 0.5px solid var(--separator-strong);
    pointer-events: none;
  }

  /* Swipe row */
  .habit-wrapper {
    position: relative;
    overflow: hidden;
    overflow-anchor: none;
    content-visibility: auto;
    contain: layout style paint;
    contain-intrinsic-size: auto 64px;
    background: var(--surface-2);
  }

  :global(.habit-wrapper.drop-target) {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  :global(.drag-ghost) {
    transition: transform 0.05s linear;
    box-shadow: var(--shadow-pop);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .left-reveal {
    position: absolute;
    inset: 0 auto 0 0;
    display: flex;
    align-items: stretch;
    z-index: 0;
  }

  .habit-slider {
    position: relative;
    z-index: 1;
    transition: transform 0.25s var(--ease);
    touch-action: pan-y;
    display: flex;
    align-items: stretch;
  }

  .habit-dim {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
  }

  .habit-wrapper.habit-hidden .habit-dim {
    opacity: 0.45;
  }

  .habit-wrapper.habit-hidden .left-reveal {
    display: none;
  }

  .swipe-actions {
    position: absolute;
    inset: 0 0 0 auto;
    display: flex;
    align-items: stretch;
    z-index: 0;
  }

  .swipe-btn {
    min-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .swipe-btn :global(svg) {
    font-size: 22px;
  }

  .swipe-btn.hide { background: #8e8c88; }
  .swipe-btn.more { background: #6b6966; }

  /* Paused */
  .paused-row {
    cursor: pointer;
  }

  .paused-glyph {
    width: 40px;
    display: grid;
    place-items: center;
    font-size: 20px;
    opacity: 0.6;
  }

  .paused-title {
    font-size: var(--text-md);
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .paused-info {
    font-size: var(--text-sm);
    color: var(--text-3);
  }

  .first-run {
    text-align: center;
    padding: 72px var(--space-4);
  }

  .first-run h2 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-2);
  }

  .first-run p {
    color: var(--text-2);
    margin-bottom: var(--space-5);
  }

  /* Pull to refresh */
  .page-outer {
    touch-action: pan-y;
    position: relative;
    overflow-anchor: none;
  }

  .pull-indicator {
    position: fixed;
    top: env(safe-area-inset-top);
    left: 0;
    right: 0;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    pointer-events: none;
    color: var(--text-3);
    font-size: 22px;
  }

  .pull-icon {
    display: inline-flex;
    transition: transform 0.2s var(--ease);
  }

  .pull-icon.ready {
    transform: rotate(180deg);
    color: var(--accent);
  }
</style>
