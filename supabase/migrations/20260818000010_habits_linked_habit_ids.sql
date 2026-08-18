-- Linked habits: a symmetric group of same-type habits where logging on one
-- logs the same value on the others. Each habit stores its partners.
alter table habits
  add column if not exists linked_habit_ids uuid[] not null default '{}';

create index if not exists habits_linked_habit_ids_idx on habits using gin (linked_habit_ids);