-- 031_milestone_nudge.sql
-- Tracking table for milestone nudge sends — idempotency for the daily cron.

CREATE TABLE public.MilestoneNudge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('child', 'couple', 'trip')),
  scope_id UUID NOT NULL,
  milestone_key TEXT NOT NULL,
  nudge_phase TEXT NOT NULL CHECK (nudge_phase IN ('T-3', 'T0', 'T+3')),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_milestone_nudge_dedupe
  ON public.MilestoneNudge (user_id, scope_type, scope_id, milestone_key, nudge_phase);

CREATE INDEX idx_milestone_nudge_user ON public.MilestoneNudge (user_id);

ALTER TABLE public.MilestoneNudge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own milestone nudges"
  ON public.MilestoneNudge FOR SELECT USING (user_id = (SELECT auth.uid()));
