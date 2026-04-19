-- ============================================================
-- 012_export_job_circle_scope.sql
-- Scope ExportJob to a single circle: add circle_id column.
-- Rate limit changes from 1 active job per user to 1 per (user, circle).
-- ============================================================

ALTER TABLE public.ExportJob
  ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES public.Circle(id) ON DELETE CASCADE;

-- Index for the duplicate-job check (user_id + circle_id + status)
CREATE INDEX IF NOT EXISTS exportjob_user_circle_status_idx
  ON public.ExportJob (user_id, circle_id, status);
