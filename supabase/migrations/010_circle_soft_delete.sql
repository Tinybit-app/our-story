-- 3.7 Circle deletion: add soft-delete columns to circle table
ALTER TABLE public.circle
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index to make the daily purge cron efficient
CREATE INDEX circle_deleted_at_idx ON public.circle (deleted_at)
  WHERE deleted_at IS NOT NULL;
