-- ============================================================
-- 004_schema_additions.sql
-- Additive fixes to the initial schema — all items required for
-- Phase 1 features that were missing from 001_initial_schema.sql.
-- ============================================================

-- ============================================================
-- USER: add deletion_requested_at; expand locale CHECK to include 'fr'
-- ============================================================
ALTER TABLE public.User
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
  -- set when user requests deletion; hard purge scheduled 30 days after deleted_at

-- Expand locale constraint to include French (Phase 1 language)
ALTER TABLE public.User DROP CONSTRAINT IF EXISTS user_locale_check;
ALTER TABLE public.User
  ADD CONSTRAINT user_locale_check
  CHECK (locale IN ('en', 'zh-Hans', 'fr'));

-- ============================================================
-- CIRCLE: add columns required by Phase 1 crons and features
-- ============================================================
ALTER TABLE public.Circle
  ADD COLUMN IF NOT EXISTS first_memory_at TIMESTAMPTZ,
  -- set once on first Memory insert; used by On This Day threshold and "Your First Month" email
  ADD COLUMN IF NOT EXISTS last_memory_at TIMESTAMPTZ,
  -- updated on every Memory insert; used by quiet-circle nudge cron and weekly digest
  ADD COLUMN IF NOT EXISTS memory_count INT NOT NULL DEFAULT 0,
  -- incremented on every Memory insert; used by On This Day activation threshold (≥30)
  ADD COLUMN IF NOT EXISTS first_month_email_sent BOOL NOT NULL DEFAULT false,
  -- guards "Your First Month" recap email — set to true after first send to prevent resend
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  -- Pro trial expiry; set when referral reward is granted (Phase 2)
  ADD COLUMN IF NOT EXISTS trial_used BOOL NOT NULL DEFAULT false,
  -- prevents multiple free trials on the same circle (Phase 2)
  ADD COLUMN IF NOT EXISTS last_challenge_completed_at TIMESTAMPTZ;
  -- updated on challenge completion; used for challenge streak logic (Phase 3)

-- ============================================================
-- CIRCLE INVITE: add 'admin' role so owners can invite admins directly
-- ============================================================
ALTER TABLE public.CircleInvite DROP CONSTRAINT IF EXISTS circleinvite_role_check;
ALTER TABLE public.CircleInvite
  ADD CONSTRAINT circleinvite_role_check
  CHECK (role IN ('admin', 'member', 'caregiver'));

-- ============================================================
-- MEMORY MEDIA: add 'audio' media type (reserved for Phase 2 voice memos)
-- Including now so the Phase 2 migration that enables voice memos is purely additive.
-- ============================================================
ALTER TABLE public.MemoryMedia DROP CONSTRAINT IF EXISTS memorymedia_media_type_check;
ALTER TABLE public.MemoryMedia
  ADD CONSTRAINT memorymedia_media_type_check
  CHECK (media_type IN ('photo', 'video', 'live_photo', 'audio'));

-- ============================================================
-- EXPORT JOBS (async GDPR data export — Step 3.8)
-- Required before any public launch (GDPR Article 20 data portability).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ExportJob (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  download_url TEXT,        -- signed URL, valid 24h; never a raw storage path
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ExportJob ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own export jobs"
  ON public.ExportJob FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "users can insert own export jobs"
  ON public.ExportJob FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- CHILD PROFILES — required for Step 12.2 milestone nudges (Phase 1)
-- Phase 1: name + DOB only. Phase 3 adds DevelopmentEntry, growth charts, WHO milestones.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ChildProfile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_media_id UUID REFERENCES public.MemoryMedia(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ChildProfile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read child profiles in their circles"
  ON public.ChildProfile FOR SELECT USING (
    circle_id IN (SELECT public.get_my_circle_ids())
  );

CREATE POLICY "members can insert child profiles"
  ON public.ChildProfile FOR INSERT WITH CHECK (
    circle_id IN (SELECT public.get_my_circle_ids())
  );

CREATE POLICY "members can update child profiles in their circles"
  ON public.ChildProfile FOR UPDATE USING (
    circle_id IN (SELECT public.get_my_circle_ids())
  );

-- ============================================================
-- NEWSLETTER RECIPIENTS — required for Step 12.1 weekly digest (Phase 1)
-- Stores email addresses for view-only recipients (grandparents etc.) with no User account.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.NewsletterRecipient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.User(id),
  email TEXT NOT NULL,
  name TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  unsubscribe_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  subscribed BOOL NOT NULL DEFAULT true,
  open_count INT NOT NULL DEFAULT 0,
  click_count INT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  join_prompt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, email)
);

ALTER TABLE public.NewsletterRecipient ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner and admin can manage newsletter recipients"
  ON public.NewsletterRecipient FOR ALL USING (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner', 'admin'])
    )
  );

-- ============================================================
-- NOTIFICATION PREFERENCE RLS
-- RLS was enabled in 002_rls_policies.sql but no policies were defined,
-- blocking all authenticated client reads. Add read/write for own prefs.
-- ============================================================
CREATE POLICY "users can read own notification preferences"
  ON public.NotificationPreference FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "users can upsert own notification preferences"
  ON public.NotificationPreference FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "users can update own notification preferences"
  ON public.NotificationPreference FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- MEMORY — add two RESTRICTIVE policies (defense-in-depth)
--
-- AS RESTRICTIVE policies are AND'd with all permissive policies, not OR'd.
-- This means even if a future permissive policy accidentally grants broader
-- SELECT access, private memories remain protected.
-- ============================================================

-- Blocks any non-owner from reading private memories regardless of other permissive policies.
-- NOTE: AS RESTRICTIVE must come BEFORE FOR SELECT — PostgreSQL syntax requires this order.
CREATE POLICY "private memories owner only"
  ON public.Memory
  AS RESTRICTIVE
  FOR SELECT
  USING (visibility != 'private' OR owner_user_id = (SELECT auth.uid()));

-- Blocks caregivers from private memories regardless of any other permissive policy.
-- Caregiver role ships in Phase 1 (schema + RLS); caregiver invite UI ships in Phase 3.
-- NOTE: AS RESTRICTIVE must come BEFORE FOR SELECT — PostgreSQL syntax requires this order.
CREATE POLICY "caregiver cannot read private memories"
  ON public.Memory
  AS RESTRICTIVE
  FOR SELECT
  USING (
    NOT (
      visibility = 'private'
      AND EXISTS (
        SELECT 1 FROM public.CircleMember
        WHERE user_id = (SELECT auth.uid()) AND role = 'caregiver'
          AND circle_id = Memory.circle_id
      )
    )
  );

-- ============================================================
-- handle_memory_insert TRIGGER
-- Updates Circle counters on every Memory insert.
-- Used by: On This Day threshold (memory_count ≥ 30),
--          "Your First Month" email (first_memory_at),
--          quiet-circle nudge cron (last_memory_at, quiet_nudge_count reset),
--          weekly digest (last_memory_at).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_memory_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.Circle
  SET
    first_memory_at   = COALESCE(first_memory_at, now()),  -- set once, never overwritten
    last_memory_at    = now(),
    memory_count      = memory_count + 1,
    quiet_nudge_count = 0  -- reset on every upload so a fresh 3-nudge window starts next quiet period
  WHERE id = NEW.circle_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_memory_created
  AFTER INSERT ON public.Memory
  FOR EACH ROW EXECUTE FUNCTION public.handle_memory_insert();
