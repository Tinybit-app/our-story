BEGIN;
SELECT plan(37);

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

-- user_outsider: has no circle memberships anywhere — used for non-member tests
-- (user_c gets added to Circle A during test 12, so can't be used for non-member assertions)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000005', 'outsider@test.com', '', now(), now(), now());

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
-- TEST 16: member (user_b) can read anniversary_date on their circle
-- ============================================================
-- Seed anniversary_date as superuser so we can verify member visibility
RESET ROLE;
UPDATE public.Circle
  SET anniversary_date = '2022-06-15'
  WHERE id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT anniversary_date FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  '2022-06-15'::date,
  'member can read anniversary_date from their circle'
);

-- ============================================================
-- TEST 17: owner (user_a) can update anniversary_date
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$UPDATE public.Circle SET anniversary_date = '2021-09-14'
    WHERE id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can update anniversary_date on their circle'
);

-- ============================================================
-- TEST 18: admin (user_b) cannot update anniversary_date
-- (Circle UPDATE policy is owner-only — silently no-ops)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.Circle
  SET anniversary_date = '2000-01-01'
  WHERE id = '10000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT anniversary_date FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  '2021-09-14'::date,
  'admin (non-owner) cannot update anniversary_date — row unchanged'
);
SET LOCAL ROLE authenticated;

-- ============================================================
-- TEST 19: circle member (user_a) can insert a Memory (quick note)
-- Policy: "members can insert memories" — owner_user_id = auth.uid()
--         AND circle_id IN get_my_circle_ids()
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility, note, memory_date)
    VALUES (
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'circle',
      'First word today: dada',
      '2024-06-15'
    )$$,
  'circle member can insert a memory (quick note) into their own circle'
);

-- ============================================================
-- TEST 20: non-member (user_outsider) cannot insert a Memory into Circle A
-- user_outsider has no CircleMember row for any circle.
-- (user_c was added to Circle A in TEST 12, so it cannot serve as the non-member.)
-- ============================================================
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000005');

SELECT throws_ok(
  $$INSERT INTO public.Memory (id, owner_user_id, circle_id, visibility, note, memory_date)
    VALUES (
      '30000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000001',
      'circle',
      'Sneaky note',
      '2024-06-15'
    )$$,
  'new row violates row-level security policy for table "memory"',
  'non-member cannot insert a memory into a circle they do not belong to'
);
SET LOCAL ROLE authenticated;

-- ============================================================
-- TEST 32: owner (user_a) can update circle name
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$UPDATE public.Circle SET name = 'Renamed Circle'
    WHERE id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can update circle name'
);

-- ============================================================
-- TEST 33: admin (user_b) cannot update circle name
-- (Circle UPDATE policy is owner-only — silently no-ops)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.Circle
  SET name = 'Hacked Name'
  WHERE id = '10000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT name FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  'Renamed Circle',
  'admin (non-owner) cannot update circle name — row unchanged'
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

-- ============================================================
-- TEST 19: member (user_b) can read ChildProfile in their circle
-- ============================================================
-- Seed a child profile as superuser
RESET ROLE;
-- Restore Circle A (soft-deleted in test 13) so we can insert ChildProfile
UPDATE public.Circle SET deleted_at = NULL WHERE id = '10000000-0000-0000-0000-000000000001';
INSERT INTO public.ChildProfile (id, circle_id, name, date_of_birth)
VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Baby Emma', '2024-01-01');
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.ChildProfile WHERE circle_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'member can read ChildProfile in their circle'
);

-- ============================================================
-- TEST 20: owner (user_a) can insert a ChildProfile
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$INSERT INTO public.ChildProfile (circle_id, name, date_of_birth)
    VALUES ('10000000-0000-0000-0000-000000000001', 'Baby Noah', '2024-06-01')$$,
  'owner can insert a ChildProfile'
);

-- ============================================================
-- TEST 21: member (user_b, now admin) cannot insert a ChildProfile
-- (ChildProfile insert is owner-only, not owner+admin)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$INSERT INTO public.ChildProfile (circle_id, name, date_of_birth)
    VALUES ('10000000-0000-0000-0000-000000000001', 'Sneaky Baby', '2024-03-01')$$,
  'new row violates row-level security policy for table "childprofile"',
  'admin (non-owner) cannot insert a ChildProfile'
);

-- ============================================================
-- TEST 22: member (user_b / admin) can read memory_children
--          for a circle-visible memory in their circle
-- ============================================================
-- Seed a memory_children record linking the circle memory to Baby Emma
RESET ROLE;
INSERT INTO public.memory_children (memory_id, child_id)
VALUES ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.memory_children
   WHERE memory_id = '20000000-0000-0000-0000-000000000002'),
  1,
  'member can read memory_children for a circle-visible memory they belong to'
);

-- ============================================================
-- TEST 23: owner (user_a) can insert a memory_children record
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$INSERT INTO public.memory_children (memory_id, child_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001')$$,
  'owner can insert memory_children for their own memory'
);

-- ============================================================
-- TEST 24: non-owner (user_b / admin) cannot insert memory_children
--          for a memory they do not own
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$INSERT INTO public.memory_children (memory_id, child_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001')$$,
  'new row violates row-level security policy for table "memory_children"',
  'non-owner cannot insert memory_children for a memory they do not own'
);

-- ============================================================
-- TEST 25: member (user_b) can read memory_members for a
--          circle-visible memory in their circle
-- ============================================================
-- Seed a memory_members record as superuser (user_b tagged in the circle memory)
RESET ROLE;
INSERT INTO public.memory_members (memory_id, user_id)
VALUES ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.memory_members
   WHERE memory_id = '20000000-0000-0000-0000-000000000002'),
  1,
  'member can read memory_members for a circle-visible memory they belong to'
);

-- ============================================================
-- TEST 26: uploader (user_a) can insert a memory_members record
--          for a memory they own
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$INSERT INTO public.memory_members (memory_id, user_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  'uploader can insert memory_members for their own memory'
);

-- ============================================================
-- TEST 27: non-uploader (user_b / admin) cannot insert memory_members
--          for a memory they did not upload
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$INSERT INTO public.memory_members (memory_id, user_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')$$,
  'new row violates row-level security policy for table "memory_members"',
  'non-uploader cannot insert memory_members for a memory they did not upload'
);

-- ============================================================
-- TEST 28: owner (user_a) can update circle_type
-- ============================================================
RESET ROLE;
UPDATE public.Circle SET deleted_at = NULL WHERE id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$UPDATE public.Circle SET circle_type = 'couple'
    WHERE id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can update circle_type on their circle'
);

-- ============================================================
-- TEST 29: admin (user_b) cannot update circle_type
-- (Circle UPDATE policy is owner-only — silently no-ops)
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.Circle
  SET circle_type = 'travel'
  WHERE id = '10000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT circle_type FROM public.Circle
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  'couple',
  'admin (non-owner) cannot update circle_type — row unchanged'
);
SET LOCAL ROLE authenticated;

-- ============================================================
-- TEST 34: owner (user_a) can UPDATE a ChildProfile in their circle
-- PATCH /api/circles/[id]/children/[childId] uses service role, but we
-- verify the underlying RLS UPDATE policy also permits the owner directly.
-- ============================================================
RESET ROLE;
UPDATE public.Circle SET deleted_at = NULL WHERE id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_auth('00000000-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$UPDATE public.ChildProfile SET name = 'Emma Updated'
    WHERE id = '50000000-0000-0000-0000-000000000001'$$,
  'owner can update ChildProfile name in their circle'
);

-- ============================================================
-- TEST 35: admin (user_b) cannot UPDATE a ChildProfile
-- ChildProfile UPDATE policy is owner-only (same as INSERT).
-- The UPDATE silently no-ops — verify the name was not changed.
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.ChildProfile
  SET name = 'Hacked Name'
  WHERE id = '50000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT name FROM public.ChildProfile WHERE id = '50000000-0000-0000-0000-000000000001'),
  'Emma Updated',
  'admin (non-owner) cannot update ChildProfile — row unchanged'
);
SET LOCAL ROLE authenticated;

-- ============================================================
-- TEST 36: memory owner (user_a) can UPDATE their own memory note
-- The PATCH /api/memories/[id] route uses service role, but the underlying
-- RLS UPDATE policy (owner_user_id = auth.uid()) must also allow this.
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$UPDATE public.Memory SET note = 'Updated note text'
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  'memory owner can update their own memory note'
);

-- ============================================================
-- TEST 37: non-owner (user_b) cannot UPDATE another user's memory
-- The UPDATE silently no-ops — verify the note was not changed.
-- ============================================================
SELECT set_auth('00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

UPDATE public.Memory
  SET note = 'Hacked note'
  WHERE id = '20000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT is(
  (SELECT note FROM public.Memory WHERE id = '20000000-0000-0000-0000-000000000001'),
  'Updated note text',
  'non-owner cannot update another user''s memory note — row unchanged'
);
SET LOCAL ROLE authenticated;

SELECT * FROM finish();
ROLLBACK;
