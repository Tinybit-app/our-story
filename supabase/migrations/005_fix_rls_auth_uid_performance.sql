-- Wrap auth.uid() in (SELECT auth.uid()) so Postgres evaluates it once per
-- query rather than once per row. Affects all policies that reference auth.uid()
-- directly in USING / WITH CHECK expressions.

-- ============================================================
-- USER
-- ============================================================
DROP POLICY IF EXISTS "users can read own profile" ON public.User;
DROP POLICY IF EXISTS "users can update own profile" ON public.User;

CREATE POLICY "users can read own profile"
  ON public.User FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "users can update own profile"
  ON public.User FOR UPDATE USING (id = (SELECT auth.uid()));

-- ============================================================
-- FAMILY
-- ============================================================
DROP POLICY IF EXISTS "authenticated users can create families" ON public.Family;

CREATE POLICY "authenticated users can create families"
  ON public.Family FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
DROP POLICY IF EXISTS "users can read own storage" ON public.AccountStorage;

CREATE POLICY "users can read own storage"
  ON public.AccountStorage FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- MEMORY
-- ============================================================
DROP POLICY IF EXISTS "members can read family memories" ON public.Memory;
DROP POLICY IF EXISTS "members can insert memories" ON public.Memory;
DROP POLICY IF EXISTS "owner can update own memory" ON public.Memory;
DROP POLICY IF EXISTS "owner can delete own memory" ON public.Memory;

CREATE POLICY "members can read family memories"
  ON public.Memory FOR SELECT USING (
    (visibility = 'family' AND family_id IN (SELECT public.get_my_family_ids()))
    OR
    (visibility = 'private' AND owner_user_id = (SELECT auth.uid()))
  );

CREATE POLICY "members can insert memories"
  ON public.Memory FOR INSERT WITH CHECK (
    owner_user_id = (SELECT auth.uid()) AND
    family_id IN (SELECT public.get_my_family_ids())
  );

CREATE POLICY "owner can update own memory"
  ON public.Memory FOR UPDATE USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "owner can delete own memory"
  ON public.Memory FOR DELETE USING (owner_user_id = (SELECT auth.uid()));

-- ============================================================
-- MEMORY MEDIA
-- ============================================================
DROP POLICY IF EXISTS "uploader can insert media" ON public.MemoryMedia;

CREATE POLICY "uploader can insert media"
  ON public.MemoryMedia FOR INSERT WITH CHECK (
    memory_id IN (
      SELECT id FROM public.Memory WHERE owner_user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- COMMENTS
-- ============================================================
DROP POLICY IF EXISTS "members can post comments" ON public.MemoryComment;
DROP POLICY IF EXISTS "users can delete own comments" ON public.MemoryComment;

CREATE POLICY "members can post comments"
  ON public.MemoryComment FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can delete own comments"
  ON public.MemoryComment FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- REACTIONS
-- ============================================================
DROP POLICY IF EXISTS "members can add reactions" ON public.MemoryReaction;
DROP POLICY IF EXISTS "users can remove own reactions" ON public.MemoryReaction;

CREATE POLICY "members can add reactions"
  ON public.MemoryReaction FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can remove own reactions"
  ON public.MemoryReaction FOR DELETE USING (user_id = (SELECT auth.uid()));
