-- Allow memory.owner_user_id to be NULL.
--
-- When a circle member is removed with "keep their memories", we NULL out
-- owner_user_id to detach the memory rows from the departing user's account.
-- This prevents them from being purged when the user later deletes their
-- account. Circle owners/admins can still delete these memories via the
-- existing "owner or admin can delete memory" RLS policy.

ALTER TABLE public.Memory ALTER COLUMN owner_user_id DROP NOT NULL;
