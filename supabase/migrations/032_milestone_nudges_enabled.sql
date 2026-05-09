-- 032_milestone_nudges_enabled.sql
-- Adds a granular toggle for milestone nudges (separate from circle_muted).

ALTER TABLE public.NotificationPreference
  ADD COLUMN milestone_nudges_enabled BOOLEAN NOT NULL DEFAULT true;
