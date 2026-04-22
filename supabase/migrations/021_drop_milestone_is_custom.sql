-- milestone_is_custom is a dead column. It was designed for an i18n-key model
-- where chips stored keys like "first_steps" (custom=false) vs free-form text
-- (custom=true). The implementation stores display text directly in all cases,
-- making the flag meaningless. 7.2.1 triggers on milestone_label IS NOT NULL.
ALTER TABLE public.Memory DROP COLUMN IF EXISTS milestone_is_custom;
