-- Merge the two permissive DELETE policies on public.Memory into one.
-- Multiple permissive policies for the same role+action each execute separately;
-- a single policy with OR is equivalent and avoids the overhead.

DROP POLICY IF EXISTS "owner can delete own memory" ON public.Memory;
DROP POLICY IF EXISTS "admin can delete any memory in their family" ON public.Memory;

CREATE POLICY "owner or admin can delete memory"
  ON public.Memory FOR DELETE USING (
    owner_user_id = (SELECT auth.uid())
    OR
    family_id IN (SELECT public.get_my_family_ids_as_role(ARRAY['owner', 'admin']))
  );
