-- pgTAP test for get_month_counts RPC.
-- Verifies: correct per-month counts, empty windows, non-existent circle.

BEGIN;
SELECT plan(4);

-- ============================================================
-- FIXTURES
-- ============================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@test.com', '', '2026-01-01'::timestamp, now(), now());

-- Circle for testing
INSERT INTO public.Circle (id, name, created_by)
VALUES ('99999999-9999-9999-9999-999999999999', 'Test', '11111111-1111-1111-1111-111111111111');

-- Circle members: user_a is owner
INSERT INTO public.CircleMember (user_id, circle_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'owner');

-- Memories: 2 in Jan 2026, 2 in Feb 2026
INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility, memory_date)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle', '2026-01-15'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle', '2026-01-20'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle', '2026-02-10'::timestamptz),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'circle', '2026-02-14'::timestamptz);

-- ============================================================
-- TESTS
-- ============================================================

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 1),
  2::bigint,
  'returns 2 memories for Jan 2026'
);

SELECT is(
  (SELECT count FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  ) WHERE year = 2026 AND month = 2),
  2::bigint,
  'returns 2 memories for Feb 2026'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.get_month_counts(
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2030-01-01'::timestamptz,
    '2031-01-01'::timestamptz
  )),
  0,
  'empty year window returns zero rows'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.get_month_counts(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-01-01'::timestamptz,
    '2027-01-01'::timestamptz
  )),
  0,
  'non-existent circle returns zero rows'
);

SELECT finish();
ROLLBACK;
