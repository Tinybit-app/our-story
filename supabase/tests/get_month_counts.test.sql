-- pgTAP test for get_month_counts RPC.
-- Verifies: correct per-month counts, visibility-rule filtering, empty windows.

BEGIN;
SELECT plan(6);

-- ============================================================
-- FIXTURES
-- ============================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@test.com', '', '2026-01-01'::timestamp, now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com', '', '2026-01-01'::timestamp, now(), now());

-- Circle for testing
INSERT INTO public.Circle (id, name, created_by)
VALUES ('99999999-9999-9999-9999-999999999999', 'Test', '11111111-1111-1111-1111-111111111111');

-- Circle members: user_a is owner, user_b is member
INSERT INTO public.CircleMember (user_id, circle_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'owner'),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'member');

-- Memories:
-- 3 Jan memories from user_a (2 circle, 1 private)
-- 2 Feb memories from user_a (both circle)
-- 1 Jan memory from user_b (private — invisible to user_a)
INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility, memory_date)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle',  '2026-01-15'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle',  '2026-01-20'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'private', '2026-01-25'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle',  '2026-02-10'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle',  '2026-02-14'::timestamptz),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'private', '2026-01-30'::timestamptz);

-- ============================================================
-- TESTS
-- ============================================================

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 1),
  3::bigint,
  'user_a sees 3 memories in Jan 2026 (own private + 2 circle)'
);

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 2),
  2::bigint,
  'user_a sees 2 memories in Feb 2026 (both circle)'
);

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 1),
  3::bigint,
  'user_b sees 3 memories in Jan 2026 (own private + 2 circle, NOT user_a private)'
);

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 2),
  2::bigint,
  'user_b sees 2 in Feb 2026 (both circle, no user_a private)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2030-01-01'::timestamptz,
    '2031-01-01'::timestamptz
  )),
  0,
  'empty year window returns zero rows'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.get_month_counts(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  )),
  0,
  'non-existent circle returns zero rows'
);

SELECT finish();
ROLLBACK;
