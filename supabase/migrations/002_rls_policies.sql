-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to break RLS recursion)
-- Policies that reference CircleMember from any table — including
-- CircleMember itself — would cause infinite recursion. These
-- functions run as the table owner and bypass RLS safely.
-- SET search_path = '' prevents search_path injection attacks.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_circle_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT circle_id FROM public.circlemember WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_circle_ids_as_role(required_roles TEXT[])
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT circle_id FROM public.circlemember
  WHERE user_id = auth.uid() AND role = ANY(required_roles);
$$;

-- Enable RLS on all tables
ALTER TABLE public.User ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Circle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.CircleMember ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.CircleInvite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.AccountStorage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryMedia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryComment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryReaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.NotificationPreference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.FeatureFlag ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER
-- auth.uid() wrapped in (SELECT ...) so Postgres evaluates it
-- once per query rather than once per row.
-- ============================================================
CREATE POLICY "users can read own or circle member profiles"
  ON public.User FOR SELECT USING (
    id = (SELECT auth.uid())
    OR
    id IN (
      SELECT cm.user_id FROM public.CircleMember cm
      WHERE cm.circle_id IN (SELECT public.get_my_circle_ids())
    )
  );

CREATE POLICY "users can update own profile"
  ON public.User FOR UPDATE USING (id = (SELECT auth.uid()));

-- ============================================================
-- CIRCLE
-- ============================================================
CREATE POLICY "members can read their circles"
  ON public.Circle FOR SELECT USING (
    id IN (SELECT public.get_my_circle_ids())
  );

CREATE POLICY "authenticated users can create circles"
  ON public.Circle FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "owner can update circle"
  ON public.Circle FOR UPDATE USING (
    id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner']))
  );

-- ============================================================
-- CIRCLE MEMBER
-- ============================================================
CREATE POLICY "members can read circle membership"
  ON public.CircleMember FOR SELECT USING (
    circle_id IN (SELECT public.get_my_circle_ids())
  );

CREATE POLICY "owner and admin can insert members"
  ON public.CircleMember FOR INSERT WITH CHECK (
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner', 'admin']))
  );

CREATE POLICY "owner and admin can remove members"
  ON public.CircleMember FOR DELETE USING (
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner', 'admin']))
  );

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
CREATE POLICY "users can read own storage"
  ON public.AccountStorage FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- MEMORY
-- ============================================================
CREATE POLICY "members can read circle memories"
  ON public.Memory FOR SELECT USING (
    (visibility = 'circle' AND circle_id IN (SELECT public.get_my_circle_ids()))
    OR
    (visibility = 'private' AND owner_user_id = (SELECT auth.uid()))
  );

CREATE POLICY "members can insert memories"
  ON public.Memory FOR INSERT WITH CHECK (
    owner_user_id = (SELECT auth.uid()) AND
    circle_id IN (SELECT public.get_my_circle_ids())
  );

CREATE POLICY "owner can update own memory"
  ON public.Memory FOR UPDATE USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "owner or admin can delete memory"
  ON public.Memory FOR DELETE USING (
    owner_user_id = (SELECT auth.uid())
    OR
    circle_id IN (SELECT public.get_my_circle_ids_as_role(ARRAY['owner', 'admin']))
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
      SELECT id FROM public.Memory WHERE owner_user_id = (SELECT auth.uid())
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
    user_id = (SELECT auth.uid()) AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can delete own comments"
  ON public.MemoryComment FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE POLICY "members can read reactions"
  ON public.MemoryReaction FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "members can add reactions"
  ON public.MemoryReaction FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can remove own reactions"
  ON public.MemoryReaction FOR DELETE USING (user_id = (SELECT auth.uid()));
