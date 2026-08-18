export interface HabitNote {
  id: string;
  // Primary/owner habit (first of habitIds). Kept for backward compatibility.
  habitId: string;
  // All habits this note is linked to. Falls back to [habitId] for old notes.
  habitIds?: string[];
  date: string;
  content: string;
  createdAt: Date;
  status?: 'active' | 'deleted';
}
