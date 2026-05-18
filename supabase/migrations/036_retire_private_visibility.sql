-- 036_retire_private_visibility.sql
-- Retires the 'private' memory visibility value. Phase 1 UI never exposed it
-- (all uploads default to 'circle' via the upload endpoint); the schema
-- DEFAULT was 'private' historically as a defensive measure. This migration:
--   1. Backfills any existing 'private' rows to 'circle' (no-op in practice).
--   2. Changes the column DEFAULT from 'private' to 'circle'.
--   3. Updates the CHECK constraint to disallow 'private' going forward
--      (still allows 'circle' and 'draft' — draft was added in migration 030).
--   4. Drops the two RESTRICTIVE policies that gated 'private' (private memories
--      owner only / caregiver cannot read private memories).
--   5. Updates the permissive "members can read circle memories" policy to
--      drop the private-clause OR.

-- Step 1: Backfill (defensive; expected to be 0 rows in practice)
UPDATE public.Memory SET visibility = 'circle' WHERE visibility = 'private';

-- Step 2: Default
ALTER TABLE public.Memory ALTER COLUMN visibility SET DEFAULT 'circle';

-- Step 3: CHECK constraint — drop old, add new without 'private'
ALTER TABLE public.Memory DROP CONSTRAINT IF EXISTS memory_visibility_check;
ALTER TABLE public.Memory ADD CONSTRAINT memory_visibility_check
  CHECK (visibility IN ('circle', 'draft'));

-- Step 4: Drop RESTRICTIVE policies that no longer have meaning
DROP POLICY IF EXISTS "private memories owner only" ON public.Memory;
DROP POLICY IF EXISTS "caregiver cannot read private memories" ON public.Memory;

-- Step 5: Update the permissive read policy — drop the private OR clause
DROP POLICY IF EXISTS "members can read circle memories" ON public.Memory;
CREATE POLICY "members can read circle memories"
  ON public.Memory FOR SELECT USING (
    visibility = 'circle' AND circle_id IN (SELECT public.get_my_circle_ids())
  );
