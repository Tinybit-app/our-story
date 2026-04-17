-- supabase/migrations/005_timeline_style.sql
-- ============================================================
-- CIRCLE: add timeline_style for per-circle layout preference
-- Phase 1: only 'polaroid' is active. Other values are reserved
-- for future releases. Default ensures all existing circles
-- get the polaroid wall without an explicit migration step.
-- ============================================================
ALTER TABLE public.Circle
  ADD COLUMN IF NOT EXISTS timeline_style TEXT NOT NULL DEFAULT 'polaroid'
  CHECK (timeline_style IN ('polaroid', 'editorial', 'diary', 'rail', 'mosaic'));
