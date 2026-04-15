-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.User (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  locale TEXT CHECK (locale IN ('en', 'zh-Hans')),
  platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user', 'platform_admin')),
  -- Subscription (one per user — owner's tier determines their circles' features)
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'plus', 'pro')),
  subscription_period_end TIMESTAMPTZ,
  referral_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  referred_by_user_id UUID REFERENCES public.User(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create User row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  full_name TEXT;
  space_pos INT;
BEGIN
  full_name := TRIM(NEW.raw_user_meta_data->>'full_name');
  space_pos := POSITION(' ' IN full_name);

  INSERT INTO public.user (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN space_pos > 0 THEN LEFT(full_name, space_pos - 1) ELSE full_name END,
    CASE WHEN space_pos > 0 THEN SUBSTR(full_name, space_pos + 1) ELSE NULL END,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FAMILIES (Circles)
-- ============================================================
CREATE TABLE public.Family (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  circle_type TEXT NOT NULL DEFAULT 'custom' CHECK (circle_type IN (
    'parents', 'couple', 'family', 'friends', 'caregiving', 'travel', 'solo', 'custom'
  )),
  created_by UUID NOT NULL REFERENCES public.User(id),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'plus', 'pro', 'grace')),
  grace_period_until TIMESTAMPTZ,
  challenge_streak INT NOT NULL DEFAULT 0,
  e2ee_enabled BOOL NOT NULL DEFAULT false,
  e2ee_enabled_at TIMESTAMPTZ,
  quiet_nudge_count INT NOT NULL DEFAULT 0,
  quiet_nudge_last_sent_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deletion_initiated_by UUID REFERENCES public.User(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================
CREATE TABLE public.FamilyMember (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.Family(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'caregiver')),
  memorial_status TEXT NOT NULL DEFAULT 'active' CHECK (memorial_status IN ('active', 'memorial')),
  memorial_date TIMESTAMPTZ,
  memorial_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, family_id)
);

-- ============================================================
-- FAMILY INVITES
-- ============================================================
CREATE TABLE public.FamilyInvite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.Family(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'caregiver')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
CREATE TABLE public.AccountStorage (
  user_id UUID PRIMARY KEY REFERENCES public.User(id) ON DELETE CASCADE,
  total_quota_bytes BIGINT NOT NULL DEFAULT 5368709120,  -- 5 GB free tier
  total_used_bytes BIGINT NOT NULL DEFAULT 0,
  bonus_bytes BIGINT NOT NULL DEFAULT 0
);

-- Auto-create AccountStorage row on User insert
CREATE OR REPLACE FUNCTION public.handle_new_account_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.accountstorage (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_user_created_storage
  AFTER INSERT ON public.User
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_account_storage();

-- ============================================================
-- MEMORIES
-- ============================================================
CREATE TABLE public.Memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.User(id),
  family_id UUID NOT NULL REFERENCES public.Family(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'family')),
  note TEXT,
  alt_text TEXT,
  memory_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_collaborative BOOL NOT NULL DEFAULT false,
  contributions_open BOOL NOT NULL DEFAULT false,
  milestone_label TEXT,
  milestone_is_custom BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_family_date ON public.Memory (family_id, memory_date DESC, id DESC);
CREATE INDEX idx_memory_owner ON public.Memory (owner_user_id);

-- ============================================================
-- MEMORY MEDIA
-- ============================================================
CREATE TABLE public.MemoryMedia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,   -- NEVER expose to client — serve signed URLs only
  file_size BIGINT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'live_photo')),
  still_path TEXT,              -- live photos only
  live_path TEXT,               -- live photos only
  phash TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_name TEXT,
  guest_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMMENTS + REACTIONS
-- ============================================================
CREATE TABLE public.MemoryComment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.User(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.MemoryReaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.User(id),
  type TEXT NOT NULL DEFAULT 'emoji' CHECK (type IN ('emoji', 'voice', 'video')),
  emoji TEXT,
  media_path TEXT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, user_id, emoji)
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE public.NotificationPreference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.Family(id) ON DELETE CASCADE,
  push_enabled BOOL NOT NULL DEFAULT true,
  email_digest_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (email_digest_frequency IN ('daily', 'weekly', 'off')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  family_muted BOOL NOT NULL DEFAULT false,
  UNIQUE (user_id, family_id)
);

-- ============================================================
-- FEATURE FLAGS
-- ============================================================
CREATE TABLE public.FeatureFlag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled_globally BOOL NOT NULL DEFAULT false,
  enabled_user_ids UUID[] NOT NULL DEFAULT '{}',
  enabled_pct INT NOT NULL DEFAULT 0 CHECK (enabled_pct BETWEEN 0 AND 100)
);
