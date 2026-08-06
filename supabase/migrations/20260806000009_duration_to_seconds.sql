-- Duration habits now store value/standard/target in SECONDS instead of minutes.
-- Entries are converted from minutes->seconds (x60), and the standard/target of
-- duration habits are likewise x60. The habit unit is switched to "seconds".
-- Quantity and binary habits are left unchanged.

-- Convert duration entry values to seconds.
UPDATE entries e
SET value = e.value * 60,
    standard_met = e.value * 60 >= h.standard,
    target_met = h.target IS NOT NULL AND e.value * 60 >= h.target
FROM habits h
WHERE h.id = e.habit_id
  AND h.type = 'duration';

-- Convert duration habit thresholds to seconds.
UPDATE habits
SET standard = standard * 60,
    target = target * 60,
    unit = CASE
      WHEN lower(unit) IN ('min', 'mins', 'minute', 'minutes') THEN 'seconds'
      ELSE unit
    END
WHERE type = 'duration';

-- Recompute standard/target_met for every duration entry against the new seconds
-- thresholds, in case the habit update landed on already-converted entries.
UPDATE entries e
SET standard_met = e.value >= h.standard,
    target_met = h.target IS NOT NULL AND e.value >= h.target
FROM habits h
WHERE h.id = e.habit_id
  AND h.type = 'duration';