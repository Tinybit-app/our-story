-- 3.7 RLS: exclude soft-deleted circles from all member-visibility checks.
--
-- Both helper functions are SECURITY DEFINER and used by every RLS policy that
-- checks circle membership. Replacing them here means the Circle SELECT policy,
-- Memory read, CircleMember read, and every other policy that calls these
-- functions will automatically stop returning rows for deleted circles —
-- without needing individual policy changes.
--
-- get_my_circle_ids_as_role is also updated for consistency; it controls the
-- UPDATE policy on Circle and INSERT/DELETE on CircleMember. Since the
-- soft-delete write goes through service-role (bypassing RLS), owners can still
-- set deleted_at even though the circle would be excluded from this function.

CREATE OR REPLACE FUNCTION public.get_my_circle_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT cm.circle_id
  FROM public.circlemember cm
  JOIN public.circle c ON c.id = cm.circle_id
  WHERE cm.user_id = auth.uid()
    AND c.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_my_circle_ids_as_role(required_roles TEXT[])
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT cm.circle_id
  FROM public.circlemember cm
  JOIN public.circle c ON c.id = cm.circle_id
  WHERE cm.user_id = auth.uid()
    AND cm.role = ANY(required_roles)
    AND c.deleted_at IS NULL;
$$;
