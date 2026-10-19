-- Check-off (binary) habits ignore standard/target: a build habit is met when
-- checked (value 1); a break habit is met unless a slip (value 1) is logged.
-- Previously both used value >= standard, so a break habit with standard 2
-- marked un-slipped (0) days as unmet. Recompute stored flags to match.
UPDATE entries e
SET standard_met = CASE WHEN h.metadata->>'category' = 'break' THEN e.value < 1 ELSE e.value >= 1 END,
    target_met = false,
    updated_at = now()
FROM habits h
WHERE h.id = e.habit_id
  AND h.type = 'binary'
  AND (
    e.standard_met IS DISTINCT FROM (CASE WHEN h.metadata->>'category' = 'break' THEN e.value < 1 ELSE e.value >= 1 END)
    OR e.target_met
  );
