-- 025_drop_date_range_mode.sql
-- Remove the date_range viewer-link mode.
-- The UI now only creates full or selection links.

ALTER TABLE public.viewer_link
  DROP COLUMN IF EXISTS date_from,
  DROP COLUMN IF EXISTS date_to;

ALTER TABLE public.viewer_link
  DROP CONSTRAINT IF EXISTS viewer_link_mode_check;

ALTER TABLE public.viewer_link
  ADD CONSTRAINT viewer_link_mode_check CHECK (mode IN ('full', 'selection'));
