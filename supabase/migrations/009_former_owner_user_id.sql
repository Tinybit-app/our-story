-- Track which user originally owned a detached memory so we can re-attach it
-- if they are re-invited to the same circle.
ALTER TABLE public.memory
  ADD COLUMN former_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
