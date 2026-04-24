-- Migration 022: MemoryComment — add updated_at and UPDATE RLS policy
--
-- updated_at is NULL when the comment has never been edited; set to now() by
-- the PATCH API on every edit. The client renders an "(edited)" label when it
-- is non-null.

ALTER TABLE public.MemoryComment
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NULL;

-- RLS: allow comment authors to update their own comments
CREATE POLICY "users can update own comments"
  ON public.MemoryComment FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
