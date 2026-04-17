-- Update locale check constraint from 'zh-Hans' to 'zh-CN'
-- to match the BCP 47 locale code used by @nuxtjs/i18n.
ALTER TABLE public.User
  DROP CONSTRAINT IF EXISTS user_locale_check;

-- Migrate any existing 'zh-Hans' values (shouldn't be any yet, but safe to do)
UPDATE public.User SET locale = 'zh-CN' WHERE locale = 'zh-Hans';

ALTER TABLE public.User
  ADD CONSTRAINT user_locale_check CHECK (locale IN ('en', 'zh-CN'));
