-- supabase/migrations/030_draft_visibility.sql
-- Add 'draft' to Memory.visibility for transient draft memories used by upload-media?defer=true.
-- Drafts are invisible to all users via existing timeline filters and RLS policies (which match
-- only 'circle' and 'private'). Drafts are accessed only by the service role from /api/memories/upload-batch.

ALTER TABLE memory DROP CONSTRAINT IF EXISTS memory_visibility_check;
ALTER TABLE memory ADD CONSTRAINT memory_visibility_check
  CHECK (visibility IN ('private', 'circle', 'draft'));
