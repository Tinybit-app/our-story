BEGIN;
SELECT plan(9);

-- ============================================================
-- FIXTURES
-- ============================================================
-- Two fake auth users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'user_a@test.com', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'user_b@test.com', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'user_c@test.com', '', now(), now(), now());

-- Trigger creates public.User rows automatically

-- Family A: user_a is owner, user_b is member
INSERT INTO public.Family (id, name, created_by)
VALUES ('10000000-0000-0000-0000-000000000001', 'Family A', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.FamilyMember (user_id, family_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member');

-- Private memory owned by user_a
INSERT INTO public.Memory (id, owner_user_id, family_id, visibility)
VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 'private');

-- Family memory owned by user_a
INSERT INTO public.Memory (id, owner_user_id, family_id, visibility)
VALUES ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 'family');

-- Family B: user_c is owner (user_a and user_b are NOT members)
INSERT INTO public.Family (id, name, created_by)
VALUES ('10000000-0000-0000-0000-000000000002', 'Family B', '00000000-0000-0000-0000-000000000003');

INSERT INTO public.FamilyMember (user_id, family_id, role)
VALUES ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'owner');

-- ============================================================
-- HELPERS
-- ============================================================
-- Simulate auth.uid() = given UUID
CREATE OR REPLACE FUNCTION set_auth(user_id UUID) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TEST 1: user_b cannot read user_a's private memory
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE id = '20000000-0000-0000-0000-000000000001' AND visibility = 'private'),
  0,
  'user_b cannot read user_a private memory'
);

-- ============================================================
-- TEST 2: user_b can read family memory in their family
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE id = '20000000-0000-0000-0000-000000000002' AND visibility = 'family'),
  1,
  'user_b can read family memory they belong to'
);

-- ============================================================
-- TEST 3: user_b cannot read Family B (not a member)
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Family
   WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'user_b cannot read a family they are not a member of'
);

-- ============================================================
-- TEST 4: user_a can read their own private memory
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE id = '20000000-0000-0000-0000-000000000001' AND visibility = 'private'),
  1,
  'user_a can read their own private memory'
);

-- ============================================================
-- TEST 5: member (user_b) cannot insert a FamilyMember into Family A
-- (only owner/admin can)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$INSERT INTO public.FamilyMember (user_id, family_id, role)
    VALUES ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'member')$$,
  'new row violates row-level security policy for table "familymember"',
  'member cannot add other users to a family'
);

-- ============================================================
-- TEST 6: user_c cannot read user_a's profile (different family)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000003');

SELECT is(
  (SELECT count(*)::int FROM public.User
   WHERE id = '00000000-0000-0000-0000-000000000001'),
  0,
  'user_c cannot read user_a profile (not in same family)'
);

-- ============================================================
-- TEST 7: user_b can read user_a's profile (same family)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.User
   WHERE id = '00000000-0000-0000-0000-000000000001'),
  1,
  'user_b can read user_a profile (same family)'
);

-- ============================================================
-- TEST 8: user_b cannot delete user_a's memory
-- RLS DELETE with USING silently no-ops (doesn't throw) — verify row survives
-- ============================================================
DELETE FROM public.Memory WHERE id = '20000000-0000-0000-0000-000000000002';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.Memory WHERE id = '20000000-0000-0000-0000-000000000002'),
  1,
  'user_b (member) cannot delete user_a memory — row still exists'
);
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

-- ============================================================
-- TEST 9: owner (user_a) can read their own AccountStorage
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM public.AccountStorage
   WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  1,
  'user_a can read their own account storage'
);

SELECT * FROM finish();
ROLLBACK;
