import type { HabitNote } from '../types';
import { getAllNotes, saveNote, deleteNote } from '../services/storage';
import { createStore } from '../lib/storeFactory';

export const notesStore = createStore<HabitNote>(getAllNotes, saveNote, deleteNote);

export function addNote(note: HabitNote) {
  notesStore.add(note);
}

export function removeNote(id: string) {
  notesStore.remove(id);
}
