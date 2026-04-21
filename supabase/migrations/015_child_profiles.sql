-- Tighten ChildProfile RLS to owner-only writes (build plan §4.10.1)
--
-- Migration 004 created the table with member-level insert/update, which is
-- too permissive. Child profiles should only be managed by the circle owner.
-- Also adds the missing DELETE policy.

-- Drop the overly-permissive policies from migration 004
DROP POLICY IF EXISTS "members can insert child profiles" ON public.ChildProfile;
DROP POLICY IF EXISTS "members can update child profiles in their circles" ON public.ChildProfile;

-- Add a name length constraint (defensive; doesn't exist in 004)
ALTER TABLE public.ChildProfile
  ADD CONSTRAINT childprofile_name_length CHECK (char_length(name) BETWEEN 1 AND 100);

-- Owner-only write policies
CREATE POLICY "owner can insert child profiles"
  ON public.ChildProfile FOR INSERT WITH CHECK (
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner']))
  );

CREATE POLICY "owner can update child profiles"
  ON public.ChildProfile FOR UPDATE USING (
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner']))
  );

CREATE POLICY "owner can delete child profiles"
  ON public.ChildProfile FOR DELETE USING (
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner']))
  );
