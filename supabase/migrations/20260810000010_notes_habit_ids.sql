-- Link a note to multiple habits via a UUID[] column (habit_id stays as the
-- primary/owner habit for FK integrity). Backfill existing rows and index the
-- array for the `.contains` filters used by the notes queries.
ALTER TABLE notes ADD COLUMN habit_ids UUID[] NOT NULL DEFAULT '{}'::UUID[];

UPDATE notes SET habit_ids = ARRAY[habit_id] WHERE habit_ids = '{}'::UUID[];

CREATE INDEX notes_habit_ids_idx ON notes USING GIN (habit_ids);