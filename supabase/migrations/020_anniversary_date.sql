-- Anniversary date for couple circles (build plan §4.10.4)
--
-- Drops the unused Circle.date_of_birth column (added in migration 014,
-- superseded by ChildProfile which stores per-child DOBs instead).
-- Adds Circle.anniversary_date: the single relationship anchor date for
-- couple circles, used to compute "Year N together" and drive reminder emails.

ALTER TABLE public.Circle
  DROP COLUMN IF EXISTS date_of_birth,
  ADD COLUMN anniversary_date DATE;

COMMENT ON COLUMN public.Circle.anniversary_date IS
  'Relationship anchor date for couple circles (e.g. wedding day, first date). '
  'Owner sets it once. Used to compute "Year N together" display and drive '
  'anniversary reminder emails. Null when not set or circle_type != couple.';
