-- Add 'fr' (Canadian French) to the locale constraint.
-- Migration 006 narrowed the constraint to ('en', 'zh-CN'), dropping 'fr'.
-- Now that the French locale file ships in Phase 1, re-add 'fr' here.
ALTER TABLE public.User DROP CONSTRAINT IF EXISTS user_locale_check;
ALTER TABLE public.User
  ADD CONSTRAINT user_locale_check CHECK (locale IN ('en', 'zh-CN', 'fr'));
