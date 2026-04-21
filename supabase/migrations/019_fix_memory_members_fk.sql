-- Fix memory_members.user_id FK: was auth.users, must be public.User
-- so PostgREST can join to user profile data (first_name, last_name, avatar_url).
-- The IDs are identical — public.User.id is a FK to auth.users(id).

ALTER TABLE public.memory_members
  DROP CONSTRAINT memory_members_user_id_fkey,
  ADD CONSTRAINT memory_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.User(id) ON DELETE CASCADE;
