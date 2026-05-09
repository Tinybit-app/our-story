-- 033_anniversary_date_comment.sql
-- Generalises Circle.anniversary_date to also serve as the trip-anchor date for
-- friends/travel circles. No structural change — comment + scope only.

COMMENT ON COLUMN public.Circle.anniversary_date IS
  'Yearly anniversary anchor date. For couples: relationship anniversary. For friends/travel: first-trip date. Drives milestone nudge cron (§12.2). Null when not set.';
