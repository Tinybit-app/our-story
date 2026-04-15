-- Track when a family's owner has finished the onboarding invite step
ALTER TABLE public.family ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
