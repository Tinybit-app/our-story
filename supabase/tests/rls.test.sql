BEGIN;
SELECT plan(18);

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

-- Circle A: user_a is owner, user_b is member
INSERT INTO public.Circle (id, name, created_by)
VALUES ('10000000-0000-0000-0000-000000000001', 'Circle A', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.CircleMember (user_id, circle_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member');

-- Private memory owned by user_a
INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility)
VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 'private');

-- Circle memory owned by user_a
INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility)
VALUES ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 'circle');

-- Circle B: user_c is owner (user_a and user_b are NOT members)
INSERT INTO public.Circle (id, name, created_by)
VALUES ('10000000-0000-0000-0000-000000000002', 'Circle B', '00000000-0000-0000-0000-000000000003');

INSERT INTO public.CircleMember (user_id, circle_id, role)
VALUES ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'owner');

-- Circle A: add a caregiver (user_c reused as caregiver in Circle A for test isolation)
-- Using a 4th user to avoid role confusion with user_c's owner role in Circle B
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000004', 'caregiver@test.com', '', now(), now(), now());

INSERT INTO public.CircleMember (user_id, circle_id, role)
VALUES ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'caregiver');

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
-- TEST 2: user_b can read circle memory in their circle
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE id = '20000000-0000-0000-0000-000000000002' AND visibility = 'circle'),
  1,
  'user_b can read circle memory they belong to'
);

-- ============================================================
-- TEST 3: user_b cannot read Circle B (not a member)
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'user_b cannot read a circle they are not a member of'
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
-- TEST 5: member (user_b) cannot insert a CircleMember into Circle A
-- (only owner/admin can)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$INSERT INTO public.CircleMember (user_id, circle_id, role)
    VALUES ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'member')$$,
  'new row violates row-level security policy for table "circlemember"',
  'member cannot add other users to a circle'
);

-- ============================================================
-- TEST 6: user_c cannot read user_a's profile (different circle)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000003');

SELECT is(
  (SELECT count(*)::int FROM public.User
   WHERE id = '00000000-0000-0000-0000-000000000001'),
  0,
  'user_c cannot read user_a profile (not in same circle)'
);

-- ============================================================
-- TEST 7: user_b can read user_a's profile (same circle)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.User
   WHERE id = '00000000-0000-0000-0000-000000000001'),
  1,
  'user_b can read user_a profile (same circle)'
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

-- ============================================================
-- TEST 10: caregiver cannot read private memories (RESTRICTIVE policy)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = '10000000-0000-0000-0000-000000000001' AND visibility = 'private'),
  0,
  'caregiver cannot read private memories in their circle'
);

-- ============================================================
-- TEST 11: caregiver CAN read circle-visibility memories
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = '10000000-0000-0000-0000-000000000001' AND visibility = 'circle'),
  1,
  'caregiver can read circle-visibility memories'
);

-- ============================================================
-- TEST 12: admin can insert a CircleMember (owner/admin gate)
-- Promote user_b to admin in Circle A, then verify they can add user_c.
-- ============================================================
RESET ROLE;
UPDATE public.CircleMember
  SET role = 'admin'
  WHERE user_id = '00000000-0000-0000-0000-000000000002'
    AND circle_id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT lives_ok(
  $$INSERT INTO public.CircleMember (user_id, circle_id, role)
    VALUES ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'member')$$,
  'admin can add a new member to a circle'
);

-- ============================================================
-- TEST 16: member (user_b) can read date_of_birth on their circle
-- ============================================================
-- Seed date_of_birth as superuser so we can verify member visibility
RESET ROLE;
UPDATE public.Circle
  SET date_of_birth = '2024-03-15'
  WHERE id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT date_of_birth FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  '2024-03-15'::date,
  'member can read date_of_birth from their circle'
);

-- ============================================================
-- TEST 17: owner (user_a) can update date_of_birth
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$UPDATE public.Circle SET date_of_birth = '2024-06-01'
    WHERE id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can update date_of_birth on their circle'
);

-- ============================================================
-- TEST 18: admin (user_b) cannot update date_of_birth
-- (Circle UPDATE policy is owner-only — silently no-ops)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.Circle
  SET date_of_birth = '2000-01-01'
  WHERE id = '10000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT date_of_birth FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  '2024-06-01'::date,
  'admin (non-owner) cannot update date_of_birth — row unchanged'
);
SET LOCAL ROLE authenticated;

-- ============================================================
-- TEST 13: member of a soft-deleted circle can no longer read
-- the circle row (get_my_circle_ids excludes deleted_at IS NOT NULL)
-- ============================================================
RESET ROLE;
-- Soft-delete Circle A (set deleted_at via superuser to bypass RLS)
UPDATE public.Circle
  SET deleted_at = now()
  WHERE id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;

-- user_b is still a CircleMember but circle is soft-deleted
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  0,
  'member cannot see a soft-deleted circle'
);

-- ============================================================
-- TEST 14: member of a soft-deleted circle can no longer read
-- memories that belonged to the deleted circle
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'member cannot read memories from a soft-deleted circle'
);

-- ============================================================
-- TEST 15: CircleInvite has no permissive SELECT policy —
-- authenticated users cannot read invites directly
-- (all invite reads go through service-role API routes)
-- ============================================================
RESET ROLE;
INSERT INTO public.CircleInvite (id, circle_id, email, token, status)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'invited@test.com',
  '40000000-0000-0000-0000-000000000001',
  'pending'
);
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000003');  -- user_c is owner of Circle B

SELECT is(
  (SELECT count(*)::int FROM public.CircleInvite
   WHERE id = '30000000-0000-0000-0000-000000000001'),
  0,
  'authenticated user cannot SELECT CircleInvite directly (no permissive policy)'
);

SELECT * FROM finish();
ROLLBACK;
