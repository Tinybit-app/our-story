-- Merge the two permissive SELECT policies on public.User into one.

DROP POLICY IF EXISTS "users can read own profile" ON public.User;
DROP POLICY IF EXISTS "users can read family members profiles" ON public.User;

CREATE POLICY "users can read own or family member profiles"
  ON public.User FOR SELECT USING (
    id = (SELECT auth.uid())
    OR
    id IN (
      SELECT fm.user_id FROM public.FamilyMember fm
      WHERE fm.family_id IN (SELECT public.get_my_family_ids())
    )
  );
