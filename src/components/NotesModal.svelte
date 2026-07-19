<script lang="ts">
  import { marked } from 'marked';
  import { notesStore, addNote, removeNote, updateNote } from '../stores/notes';
  import type { HabitNote } from '../types';
  import { getLocalDateString } from '../lib/dates';
  import Modal from './Modal.svelte';

  let {
    habitId,
    onClose
  }: {
    habitId: string;
    onClose: () => void;
  } = $props();

  let today = $state(getLocalDateString());
  let allNotes = $state<HabitNote[]>([]);
  notesStore.subscribe(v => allNotes = v);

  let notes = $derived(allNotes.filter(n => n.habitId === habitId && n.date === today));
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let adding = $state(false);
  let newContent = $state('');
  let editContent = $state('');

  function handleAdd() {
    if (!newContent.trim()) return;
    const note: HabitNote = {
      id: crypto.randomUUID(),
      habitId,
      date: today,
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
  }

  function cancelEdit() {
    editingId = null;
    editContent = '';
  }

  function saveEdit() {
    if (!editContent.trim() || !editingId) return;
    updateNote(editingId, editContent.trim());
    editingId = null;
    editContent = '';
  }
</script>

<Modal {onClose}>
  <div class="header">
    <h2>Notes</h2>
    <button class="add-btn" onclick={() => adding = true} aria-label="Add note">+</button>
  </div>

  {#if adding}
    <div class="add-area">
      <textarea bind:value={newContent} placeholder="Write a note (supports Markdown)..." class="note-input"></textarea>
      <div class="add-actions">
        <button class="btn" onclick={handleAdd}>Save</button>
        <button class="btn btn-outline" onclick={() => { adding = false; newContent = ''; }}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="note-list">
    {#each notes as note (note.id)}
      {#if editingId === note.id}
        <div class="note-card">
          <textarea bind:value={editContent} class="note-input edit-input"></textarea>
          <div class="note-meta">
            <span class="note-time">{note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div class="actions">
              <button class="btn" onclick={saveEdit}>Save</button>
              <button class="btn btn-outline" onclick={cancelEdit}>Cancel</button>
            </div>
          </div>
        </div>
      {:else}
        <div class="note-card" class:expanded={expandedId === note.id} onclick={() => expandedId = expandedId === note.id ? null : note.id}>
          <div class="note-content" class:truncated={expandedId !== note.id}>
            {@html marked.parse(note.content)}
          </div>
          <div class="note-meta">
            <span class="note-time">{note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div class="actions">
              <button class="action-btn" onclick={(e) => { e.stopPropagation(); startEdit(note); }} aria-label="Edit note">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
              </button>
              {#if expandedId === note.id}
                <button class="action-btn del" onclick={(e) => { e.stopPropagation(); removeNote(note.id); }} aria-label="Delete note">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <p class="empty">No notes for today.</p>
    {/each}
  </div>
</Modal>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .header h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary, #222); }
  .add-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    background: var(--accent, #0066cc);
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .add-btn:hover { opacity: 0.85; }

  .add-area { margin-bottom: 1rem; }
  .note-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
    min-height: 4rem;
    resize: vertical;
  }
  .edit-input { min-height: 5rem; }
  .add-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .btn {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: none;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
  }
  .btn:hover { opacity: 0.85; }
  .btn-outline {
    background: transparent;
    border: 1px solid var(--card-border, #ccc);
    color: var(--text-primary, #222);
  }

  .note-list {
    max-height: 50vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .note-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .note-card:hover { border-color: var(--accent, #0066cc); }
  .note-card.expanded { border-color: var(--accent, #0066cc); }

  .note-content { font-size: 0.85rem; color: var(--text-primary, #222); line-height: 1.5; word-wrap: break-word; }
  .note-content.truncated {
    max-height: 3em;
    overflow: hidden;
    position: relative;
  }
  .note-content.truncated::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1em;
    background: linear-gradient(transparent, var(--card-bg, #fff));
  }
  .note-content :global(p) { margin: 0 0 0.3em; }
  .note-content :global(p:last-child) { margin-bottom: 0; }
  .note-content :global(ul), .note-content :global(ol) { margin: 0.2em 0; padding-left: 1.2em; }
  .note-content :global(li) { margin: 0.1em 0; }
  .note-content :global(code) { font-size: 0.8em; background: var(--btn-secondary-bg, #eee); padding: 1px 4px; border-radius: 3px; }
  .note-content :global(pre) { font-size: 0.8em; background: var(--btn-secondary-bg, #eee); padding: 0.4rem; border-radius: 4px; overflow-x: auto; margin: 0.3em 0; }
  .note-content :global(blockquote) { margin: 0.3em 0; padding-left: 0.5em; border-left: 3px solid var(--card-border, #ccc); color: var(--text-secondary, #888); }

  .note-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.3rem;
  }
  .note-time { font-size: 0.7rem; color: var(--text-secondary, #999); }

  .actions {
    display: flex;
    gap: 0.25rem;
  }
  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary, #999);
    padding: 2px;
    border-radius: 4px;
    display: flex;
  }
  .action-btn:hover { color: var(--accent, #0066cc); background: rgba(0,102,204,0.06); }
  .action-btn.del:hover { color: #d32f2f; background: rgba(211,47,47,0.08); }

  .empty { text-align: center; color: var(--text-secondary, #999); font-size: 0.85rem; padding: 2rem 0; }
</style>
