-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to break RLS recursion)
-- Policies that reference FamilyMember from any table — including
-- FamilyMember itself — would cause infinite recursion. These
-- functions run as the table owner and bypass RLS safely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT family_id FROM public.FamilyMember WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_ids_as_role(required_roles TEXT[])
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT family_id FROM public.FamilyMember
  WHERE user_id = auth.uid() AND role = ANY(required_roles);
$$;

-- Enable RLS on all tables
ALTER TABLE public.User ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Family ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.FamilyMember ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.FamilyInvite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.AccountStorage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryMedia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryComment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryReaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.NotificationPreference ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER
-- ============================================================
CREATE POLICY "users can read own profile"
  ON public.User FOR SELECT USING (id = auth.uid());

CREATE POLICY "users can read family members profiles"
  ON public.User FOR SELECT USING (
    id IN (
      SELECT fm.user_id FROM public.FamilyMember fm
      WHERE fm.family_id IN (SELECT public.get_my_family_ids())
    )
  );

CREATE POLICY "users can update own profile"
  ON public.User FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- FAMILY
-- ============================================================
CREATE POLICY "members can read their families"
  ON public.Family FOR SELECT USING (
    id IN (SELECT public.get_my_family_ids())
  );

CREATE POLICY "authenticated users can create families"
  ON public.Family FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner can update family"
  ON public.Family FOR UPDATE USING (
    id IN (SELECT public.get_my_family_ids_as_role(ARRAY['owner']))
  );

-- ============================================================
-- FAMILY MEMBER
-- ============================================================
CREATE POLICY "members can read family membership"
  ON public.FamilyMember FOR SELECT USING (
    family_id IN (SELECT public.get_my_family_ids())
  );

CREATE POLICY "owner and admin can insert members"
  ON public.FamilyMember FOR INSERT WITH CHECK (
    family_id IN (SELECT public.get_my_family_ids_as_role(ARRAY['owner', 'admin']))
  );

CREATE POLICY "owner and admin can remove members"
  ON public.FamilyMember FOR DELETE USING (
    family_id IN (SELECT public.get_my_family_ids_as_role(ARRAY['owner', 'admin']))
  );

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
CREATE POLICY "users can read own storage"
  ON public.AccountStorage FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- MEMORY
-- ============================================================
CREATE POLICY "members can read family memories"
  ON public.Memory FOR SELECT USING (
    -- family memories: must be a member
    (visibility = 'family' AND family_id IN (SELECT public.get_my_family_ids()))
    OR
    -- private memories: only the owner
    (visibility = 'private' AND owner_user_id = auth.uid())
  );

CREATE POLICY "members can insert memories"
  ON public.Memory FOR INSERT WITH CHECK (
    owner_user_id = auth.uid() AND
    family_id IN (SELECT public.get_my_family_ids())
  );

CREATE POLICY "owner can update own memory"
  ON public.Memory FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "owner can delete own memory"
  ON public.Memory FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY "admin can delete any memory in their family"
  ON public.Memory FOR DELETE USING (
    family_id IN (SELECT public.get_my_family_ids_as_role(ARRAY['owner', 'admin']))
  );

-- ============================================================
-- MEMORY MEDIA
-- ============================================================
CREATE POLICY "members can read media for accessible memories"
  ON public.MemoryMedia FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "uploader can insert media"
  ON public.MemoryMedia FOR INSERT WITH CHECK (
    memory_id IN (
      SELECT id FROM public.Memory WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE POLICY "members can read comments on accessible memories"
  ON public.MemoryComment FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "members can post comments"
  ON public.MemoryComment FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can delete own comments"
  ON public.MemoryComment FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE POLICY "members can read reactions"
  ON public.MemoryReaction FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "members can add reactions"
  ON public.MemoryReaction FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can remove own reactions"
  ON public.MemoryReaction FOR DELETE USING (user_id = auth.uid());
