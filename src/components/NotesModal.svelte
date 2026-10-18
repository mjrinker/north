<script lang="ts">
  import { marked } from 'marked';
  import { notesStore, addNote, removeNote, updateNote } from '../stores/notes';
  import type { Habit, HabitNote } from '../types';
  import { getLocalDateString } from '../lib/dates';
  import Modal from './Modal.svelte';

  let {
    habitId,
    date = getLocalDateString(),
    allHabits = [] as Habit[],
    onClose
  }: {
    habitId: string;
    date?: string;
    allHabits?: Habit[];
    onClose: () => void;
  } = $props();

  let allNotes = $state<HabitNote[]>([]);
  notesStore.subscribe(v => allNotes = v);

  let notes = $derived(allNotes.filter(n => {
    const linked = n.habitIds && n.habitIds.length ? n.habitIds.includes(habitId) : n.habitId === habitId;
    return linked && n.date === date && n.status !== 'deleted';
  }));
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let adding = $state(false);
  let newContent = $state('');
  let editContent = $state('');
  let selHabitIds = $state<string[]>([]);

  let activeHabits = $derived(allHabits.filter(h => h.status === 'active' && h.id));
  let showPicker = $derived(activeHabits.length > 1);

  function openAdd() {
    adding = true;
    newContent = '';
    const linked = allHabits.find(h => h.id === habitId)?.linkedHabitIds ?? [];
    const autoLinked = linked.filter(id => activeHabits.some(h => h.id === id));
    selHabitIds = [...new Set([habitId, ...autoLinked])];
  }

  function toggleSel(id: string) {
    if (selHabitIds.includes(id)) {
      if (selHabitIds.length > 1) selHabitIds = selHabitIds.filter(i => i !== id);
    } else {
      selHabitIds = [...selHabitIds, id];
    }
  }

  function handleAdd() {
    if (!newContent.trim()) return;
    const ids = [...new Set([habitId, ...selHabitIds])];
    const note: HabitNote = {
      id: crypto.randomUUID(),
      habitId: ids[0],
      habitIds: ids,
      date,
      content: newContent.trim(),
      createdAt: new Date(),
    };
    addNote(note);
    newContent = '';
    adding = false;
  }

  function startEdit(note: HabitNote) {
    editingId = note.id;
    editContent = note.content;
    selHabitIds = note.habitIds && note.habitIds.length ? [...note.habitIds] : [note.habitId];
  }

  function cancelEdit() {
    editingId = null;
    editContent = '';
  }

  function saveEdit() {
    if (!editContent.trim() || !editingId) return;
    updateNote(editingId, editContent.trim(), selHabitIds);
    editingId = null;
    editContent = '';
  }
</script>

{#snippet habitPicker()}
  {#if showPicker}
    <div class="note-habits">
      <span class="mini">Linked to</span>
      <div class="chip-row">
        {#each activeHabits as h (h.id)}
          <button type="button" class="chip" class:selected={selHabitIds.includes(h.id)} onclick={() => toggleSel(h.id)}>{h.title}</button>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<Modal {onClose}>
  <div class="header">
    <h2>Notes</h2>
    <button class="add-btn" onclick={openAdd}>New note</button>
  </div>

  {#if adding}
    <div class="add-area">
      <textarea bind:value={newContent} placeholder="Write a note. Markdown works." class="note-input"></textarea>
      {@render habitPicker()}
      <div class="add-actions">
        <button class="btn btn-secondary btn-sm" onclick={() => { adding = false; newContent = ''; }}>Cancel</button>
        <button class="btn btn-sm" onclick={handleAdd}>Save</button>
      </div>
    </div>
  {/if}

  <div class="note-list">
    {#each notes as note (note.id)}
      {#if editingId === note.id}
        <div class="note-card">
          <textarea bind:value={editContent} class="note-input edit-input"></textarea>
          {@render habitPicker()}
          <div class="note-meta">
            <span class="note-time">{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div class="actions">
              <button class="btn btn-secondary btn-sm" onclick={cancelEdit}>Cancel</button>
              <button class="btn btn-sm" onclick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      {:else}
        <div class="note-card" class:expanded={expandedId === note.id} onclick={() => expandedId = expandedId === note.id ? null : note.id}>
          <div class="note-content" class:truncated={expandedId !== note.id}>
            {@html marked.parse(note.content)}
          </div>
          <div class="note-meta">
            <span class="note-time">{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div class="actions">
              <button class="action-btn" onclick={(e) => { e.stopPropagation(); startEdit(note); }} aria-label="Edit note">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
              </button>
              <button class="action-btn del" onclick={(e) => { e.stopPropagation(); removeNote(note.id); }} aria-label="Delete note">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>
              </button>
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <p class="empty">No notes for this day.</p>
    {/each}
  </div>
</Modal>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .header h2 {
    margin: 0;
  }

  .add-btn {
    height: 34px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .add-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .note-input {
    width: 100%;
  }

  .add-actions,
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .note-habits {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mini {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-2);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: inset 0 0 0 1px var(--separator);
  }

  .chip.selected {
    background: var(--accent-soft);
    color: var(--accent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .note-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .note-card {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--surface);
    cursor: pointer;
  }

  .note-content {
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--text);
    user-select: text;
    -webkit-user-select: text;
  }

  .note-content.truncated {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-content :global(p + p) { margin-top: var(--space-2); }
  .note-content :global(ul), .note-content :global(ol) { padding-left: 1.25em; }
  .note-content :global(a) { color: var(--accent); }
  .note-content :global(code) { font-family: var(--font-mono); font-size: 0.9em; background: var(--surface-2); padding: 1px 4px; border-radius: 4px; }

  .note-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--space-2);
  }

  .note-time {
    font-size: var(--text-xs);
    color: var(--text-3);
  }

  .action-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-3);
  }

  .action-btn:active { background: var(--surface-2); }
  .action-btn.del { color: var(--danger); }

  .empty {
    padding: var(--space-5) 0;
    text-align: center;
    color: var(--text-2);
  }
</style>
