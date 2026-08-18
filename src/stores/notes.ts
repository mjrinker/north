import type { HabitNote } from '../types';
import { getAllNotes, saveNote, deleteNote as deleteNoteFromDB } from '../services/storage';
import { createStore } from '../lib/storeFactory';
import { pushRecord } from '../services/sync';

export const notesStore = createStore<HabitNote>(getAllNotes, saveNote, deleteNoteFromDB);

export function addNote(note: HabitNote) {
  notesStore.add(note);
  pushRecord('notes', note.id, note);
}

export function updateNote(id: string, content: string, habitIds?: string[]) {
  let found: HabitNote | undefined;
  notesStore.update(list => list.map(n => {
    if (n.id === id) {
      found = {
        ...n,
        content,
        ...(habitIds && habitIds.length ? { habitIds, habitId: habitIds[0] } : {}),
      };
      return found;
    }
    return n;
  }));
  if (found) {
    saveNote(found).catch(console.error);
    pushRecord('notes', id, found);
  }
}

export async function removeNote(id: string) {
  let found: HabitNote | undefined;
  notesStore.update(list => list.map(n => {
    if (n.id === id) { found = { ...n, status: 'deleted' }; return found; }
    return n;
  }));
  if (found) {
    await saveNote(found);
    await pushRecord('notes', id, found);
  }
}
