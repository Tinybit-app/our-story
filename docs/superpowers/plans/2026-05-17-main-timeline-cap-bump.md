# Main Timeline Cap Bump + True Per-Month Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump the main `/timeline` view from 12 to 24 visible memories per month, and surface the **true** per-month memory count in the "See all N memories →" link via a new Postgres RPC. The existing UI copy stays the same — only `N` becomes accurate (was an under-count of API-returned bucket size; becomes the actual DB count).

**Architecture:** Add one Postgres function `get_month_counts(p_circle_id, p_user_id, p_year_start, p_year_end)` that returns `(year, month, count)` rows for the requesting user's visible memories in a date window. The `/api/timeline.get.ts` year-branch calls it in parallel with the memory fetch and includes `monthCounts: Record<string, number>` in the response. `useTimeline.ts` swaps its bucket-counting (`group.total++` accumulation) for the canonical RPC counts, and the `MONTH_CAP` display constant moves from 12 to 24.

This is a **post-sub-plan follow-up** addressing the under-count limitation discussed during sub-plan #5 review. Scope intentionally narrow: only the year-branch of `/api/timeline.get.ts`. The `yearMonth` branch already has accurate counts (sub-plan #5's `totalCount`); main `/timeline` is the only consumer that needs this fix.

**Source spec:** Not in the original spec — emerged from sub-plan #5 final-review discussion about main-timeline overview UX for hyper-active circles (new parents, weddings).

**Tech Stack:** Postgres 15+ (Supabase) + Nuxt 3 + Vitest. No new dependencies.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `supabase/migrations/035_get_month_counts_rpc.sql` | Create | New Postgres function `get_month_counts(p_circle_id uuid, p_user_id uuid, p_year_start timestamptz, p_year_end timestamptz)` returning `TABLE(year int, month int, count bigint)`. Counts memories visible to the user (own private OR circle visibility) grouped by `date_trunc('month', memory_date)` within the date window. |
| `supabase/tests/get_month_counts.test.sql` | Create | pgTAP test for the RPC. Seeds 2 users, 1 circle, several memories across months with mixed visibility, asserts the function returns correct counts and respects visibility. |
| `server/api/timeline.get.ts` | Modify | In the year-branch (and only the year-branch — `yearMonth` branch stays untouched), call `supabase.rpc('get_month_counts', ...)` in parallel with the existing memory query. Include `monthCounts: Record<string, number>` in the response. Bump `YEAR_LIMIT_DEFAULT` from 156 to 312 to match the new 24/month display cap. |
| `app/composables/useTimeline.ts` | Modify | (1) `MONTH_CAP` constant 12 → 24. (2) Accept the new `monthCounts` from API response (shape change). (3) `group.total` is set from `monthCounts[key]` instead of incrementing on each pushed memory. |
| `app/pages/timeline/index.vue` | Modify | (1) Extend the `$fetch` response type to include `monthCounts: Record<string, number>`. (2) Pass it into `useTimeline(memoriesFlat, monthCounts)`. |
| `unit/useTimeline.test.ts` | Modify | Add test cases for the new `monthCounts` plumbing: monthCounts-aware `group.total`, MONTH_CAP=24 display cap. |
| `package.json` | No change | `pnpm db:reset && pnpm db:test` already exist; the new pgTAP test runs as part of that. |

Total: 1 new SQL migration, 1 new pgTAP test, 3 modified TS/Vue files, 1 modified unit test. **No new components, no new routes, no UI copy changes.**

---

## Task 1: Migration — `get_month_counts` RPC

**Files:**
- Create: `supabase/migrations/035_get_month_counts_rpc.sql`
- Create: `supabase/tests/get_month_counts.test.sql`

### Step 1: Write the migration

Create `supabase/migrations/035_get_month_counts_rpc.sql` with this content:

```sql
-- 035_get_month_counts_rpc.sql
-- Returns the count of memories visible to a user in each month within a
-- date window for a given circle. Used by /api/timeline year-branch to
-- show accurate "See all N memories →" overflow counts on the main
-- timeline overview without serializing the whole year of rows.
--
-- Visibility: a memory is visible to the user if it is circle-visibility
-- OR private+owned-by-the-user. Mirrors the .or() filter in
-- /api/timeline.get.ts.

CREATE OR REPLACE FUNCTION public.get_month_counts(
  p_circle_id   UUID,
  p_user_id     UUID,
  p_year_start  TIMESTAMPTZ,
  p_year_end    TIMESTAMPTZ
)
RETURNS TABLE (
  year   INT,
  month  INT,
  count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    EXTRACT(YEAR  FROM date_trunc('month', m.memory_date))::INT  AS year,
    EXTRACT(MONTH FROM date_trunc('month', m.memory_date))::INT AS month,
    COUNT(*)::BIGINT                                            AS count
  FROM public.memory m
  WHERE m.circle_id = p_circle_id
    AND m.memory_date >= p_year_start
    AND m.memory_date <  p_year_end
    AND (
      m.visibility = 'circle'
      OR (m.visibility = 'private' AND m.owner_user_id = p_user_id)
    )
  GROUP BY date_trunc('month', m.memory_date)
  ORDER BY date_trunc('month', m.memory_date) DESC
$$;

-- Allow authenticated users to invoke the RPC (the function itself enforces
-- the visibility rule per the WHERE clause above).
GRANT EXECUTE ON FUNCTION public.get_month_counts(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
```

Notes:
- `SECURITY DEFINER` runs as the function owner (postgres), bypassing the user's RLS. The function's `WHERE` clause enforces visibility manually — same pattern as `get_my_circle_ids()` in migration 002.
- `STABLE` lets Postgres cache the result within a query.
- `SET search_path = ''` is the Supabase security hardening pattern (avoids resolver attacks via function name shadowing).
- `GRANT EXECUTE ... TO authenticated` is required because PostgREST's default is to disallow RPC calls unless explicitly granted.

### Step 2: Write the pgTAP test

Create `supabase/tests/get_month_counts.test.sql` with this content:

```sql
-- pgTAP test for get_month_counts RPC.
-- Verifies: correct per-month counts, visibility-rule filtering, empty windows.

BEGIN;
SELECT plan(6);

-- ── Seed data ────────────────────────────────────────────────────────────
-- Two users, one circle. user_a owns 5 memories: 3 in Jan 2026 (1 private,
-- 2 circle), 2 in Feb 2026 (both circle). user_b owns 1 private memory
-- in Jan 2026 — visible only to themselves.
DO $$
DECLARE
  user_a UUID := '11111111-1111-1111-1111-111111111111';
  user_b UUID := '22222222-2222-2222-2222-222222222222';
  circle UUID := '99999999-9999-9999-9999-999999999999';
BEGIN
  -- Users
  INSERT INTO auth.users (id, email) VALUES
    (user_a, 'a@test.com'),
    (user_b, 'b@test.com');
  INSERT INTO public.User (id, first_name) VALUES
    (user_a, 'Alice'),
    (user_b, 'Bob');

  -- Circle + memberships
  INSERT INTO public.Circle (id, name) VALUES (circle, 'Test');
  INSERT INTO public.CircleMember (circle_id, user_id, role) VALUES
    (circle, user_a, 'owner'),
    (circle, user_b, 'member');

  -- Memories
  INSERT INTO public.Memory (id, circle_id, owner_user_id, visibility, memory_date) VALUES
    (gen_random_uuid(), circle, user_a, 'circle',  '2026-01-15'::date),
    (gen_random_uuid(), circle, user_a, 'circle',  '2026-01-20'::date),
    (gen_random_uuid(), circle, user_a, 'private', '2026-01-25'::date),
    (gen_random_uuid(), circle, user_a, 'circle',  '2026-02-10'::date),
    (gen_random_uuid(), circle, user_a, 'circle',  '2026-02-14'::date),
    (gen_random_uuid(), circle, user_b, 'private', '2026-01-30'::date);
END $$;

-- ── Tests ────────────────────────────────────────────────────────────────

-- 1. user_a sees their own private + all circle memories.
--    Expected: Jan 2026 = 3 (2 circle + 1 own private),
--              Feb 2026 = 2 (both circle).
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

-- 2. user_b sees own private + all circle memories.
--    Expected: Jan 2026 = 3 (2 circle from user_a + 1 own private)
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

-- 3. user_b does NOT see user_a's private memory.
--    Expected: user_b sees 2 in Feb 2026 (both circle), NOT 3.
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

-- 4. Empty window returns no rows.
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

-- 5. Non-existent circle returns no rows.
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
```

### Step 3: Run the migration locally and verify

```bash
pnpm db:reset
```

This applies all migrations including the new one. If the migration has a syntax error or references a non-existent column, the reset will fail. Fix and re-run.

```bash
pnpm db:test
```

Expected: all pgTAP tests pass, including the 6 new assertions for `get_month_counts`.

If any test fails, read the failure output carefully — pgTAP shows the expected vs actual values. The most likely failure mode is column-name casing (`Memory` vs `memory`, `owner_user_id` vs `owner_id`, etc.) — Postgres is case-sensitive when identifiers are quoted in the schema. Check existing migrations to confirm exact column names.

### Step 4: Commit

```bash
git add supabase/migrations/035_get_month_counts_rpc.sql supabase/tests/get_month_counts.test.sql
git commit -m "feat(db): get_month_counts RPC for accurate main-timeline overview

New Postgres function returns per-month memory counts for a circle
visible to a user within a date window. SECURITY DEFINER with manual
visibility enforcement (circle OR own private). Used by /api/timeline
year-branch to surface true 'See all N memories →' counts.

pgTAP test seeds two users + one circle with mixed circle/private
memories and asserts visibility filtering."
```

---

## Task 2: API integration — `/api/timeline.get.ts` year-branch

**Files:**
- Modify: `server/api/timeline.get.ts`

### Step 1: Locate the year-branch

Open `server/api/timeline.get.ts`. Find the branch that handles year-scoped queries (NOT the `yearMonth` branch — that one stays untouched). It looks like:

```ts
// (After the yearMonth branch ends)
// ... rest of the handler that does the year-scoped query ...

const [{ data: memories, error }, prevYear] = await Promise.all([
  baseQuery()
    .gte('memory_date', yearStart)
    .lt('memory_date', yearEnd)
    .limit(yearLimit),
  // (prevYear lookup query)
])
```

### Step 2: Bump YEAR_LIMIT_DEFAULT

At the top of the file, find:

```ts
const YEAR_LIMIT_DEFAULT = 156 // 12 per month × 13 months (main timeline cap)
```

Change to:

```ts
const YEAR_LIMIT_DEFAULT = 312 // 24 per month × 13 months (main timeline cap)
```

### Step 3: Add the RPC call to the year-branch's Promise.all

Find the existing `Promise.all([baseQuery()..., (prevYearLookup)])`. Add a third entry: the RPC call.

```ts
const visibilityFilter = `visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`

const [memoryResult, prevYear, monthCountsResult] = await Promise.all([
  baseQuery()
    .gte('memory_date', yearStart)
    .lt('memory_date', yearEnd)
    .limit(yearLimit),
  // (existing prevYear lookup — leave as-is)
  supabase.rpc('get_month_counts', {
    p_circle_id: circleId,
    p_user_id: user.sub,
    p_year_start: yearStart,
    p_year_end: yearEnd,
  }),
])

const { data: memories, error } = memoryResult
// (existing error handling)

// Build the monthCounts map (key: 'YYYY-MM')
const monthCounts: Record<string, number> = {}
if (monthCountsResult.data) {
  for (const row of monthCountsResult.data as Array<{ year: number; month: number; count: number }>) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`
    monthCounts[key] = Number(row.count)
  }
}
```

### Step 4: Include `monthCounts` in the response

Find the return statement at the end of the year-branch:

```ts
return {
  memories: withUrls,
  prevYear,
  children,
  members,
  upcomingMilestone,
  milestoneNudgesEnabledForActiveCircle,
}
```

Add `monthCounts`:

```ts
return {
  memories: withUrls,
  prevYear,
  monthCounts,
  children,
  members,
  upcomingMilestone,
  milestoneNudgesEnabledForActiveCircle,
}
```

### Step 5: Verify the yearMonth branch is untouched

```bash
git diff server/api/timeline.get.ts
```

Confirm:
- `YEAR_LIMIT_DEFAULT` changed from 156 to 312.
- `Promise.all` in the year-branch now includes the RPC call.
- `monthCounts` is built and returned IN THE YEAR-BRANCH ONLY.
- The `yearMonth` branch (the `if (yearMonth) { ... }` block) is untouched.

### Step 6: Run the suite

```bash
pnpm test
```

Expected: existing tests still pass. The `/api/timeline` endpoint isn't directly unit-tested, so the suite count stays the same.

### Step 7: Commit

```bash
git add server/api/timeline.get.ts
git commit -m "feat(api): year-branch returns monthCounts via get_month_counts RPC

Bumps YEAR_LIMIT_DEFAULT 156 → 312 (24/month × 13 months) and adds a
parallel supabase.rpc('get_month_counts', ...) call inside the year
branch's Promise.all. Response now includes monthCounts: Record<string,
number> keyed by 'YYYY-MM' with the true per-month count.

The yearMonth branch is unchanged — it already has accurate totalCount
from sub-plan #5."
```

---

## Task 3: Client — `useTimeline.ts` + page wiring

**Files:**
- Modify: `app/composables/useTimeline.ts`
- Modify: `app/pages/timeline/index.vue`
- Modify: `unit/useTimeline.test.ts`

### Step 1: Bump MONTH_CAP

In `app/composables/useTimeline.ts`, find:

```ts
const MONTH_CAP = 12
```

Change to:

```ts
const MONTH_CAP = 24
```

### Step 2: Accept `monthCounts` parameter

Find the `useTimeline` function signature:

```ts
export function useTimeline(memoriesRef: Ref<Memory[]>): {
  monthGroups: ComputedRef<MonthGroup[]>
  yearInfos: ComputedRef<YearInfo[]>
} {
```

Add a second parameter for `monthCounts`. To stay backward-compatible (in case any test or sandbox imports without it), make it optional:

```ts
export function useTimeline(
  memoriesRef: Ref<Memory[]>,
  monthCountsRef?: Ref<Record<string, number>>,
): {
  monthGroups: ComputedRef<MonthGroup[]>
  yearInfos: ComputedRef<YearInfo[]>
} {
```

### Step 3: Use `monthCounts[key]` for `group.total`

Find the loop in `monthGroups`:

```ts
const map = new Map<string, { year: number; month: number; memories: Memory[]; total: number }>()

for (const memory of memoriesRef.value) {
  const d = new Date(memory.memory_date)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const key = `${year}-${String(month).padStart(2, '0')}`

  if (!map.has(key)) {
    map.set(key, { year, month, memories: [], total: 0 })
  }

  const group = map.get(key)!
  group.total++
  group.memories.push(memory)
}
```

Change `group.total++` to `group.memories.push` only — the count is no longer derived from the bucket. After the loop, set `group.total` from `monthCountsRef`:

```ts
const map = new Map<string, { year: number; month: number; memories: Memory[]; total: number }>()

for (const memory of memoriesRef.value) {
  const d = new Date(memory.memory_date)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const key = `${year}-${String(month).padStart(2, '0')}`

  if (!map.has(key)) {
    map.set(key, { year, month, memories: [], total: 0 })
  }

  const group = map.get(key)!
  group.memories.push(memory)
}

// Set the canonical total from the RPC's monthCounts. Fall back to the
// bucket size if monthCounts isn't provided (backward-compat for callers
// that haven't been updated yet).
const counts = monthCountsRef?.value ?? {}
for (const [key, group] of map.entries()) {
  group.total = counts[key] ?? group.memories.length
}
```

### Step 4: Update the page to pass `monthCounts`

In `app/pages/timeline/index.vue`, find the `useTimeline` call and the data ref it consumes. Currently:

```ts
const memoriesFlat = ref<Memory[]>([])
// ...
const { monthGroups, yearInfos } = useTimeline(memoriesFlat)
```

Add a `monthCounts` ref alongside `memoriesFlat`:

```ts
const memoriesFlat = ref<Memory[]>([])
const monthCounts = ref<Record<string, number>>({})
// ...
const { monthGroups, yearInfos } = useTimeline(memoriesFlat, monthCounts)
```

Then find the `$fetch` call inside `fetchTimeline`. Currently looks something like:

```ts
const data = await $fetch<{
  memories: Memory[]
  prevYear: number | null
  children: ChildProfile[]
  members: CircleMember[]
  upcomingMilestone?: UpcomingMilestone | null
  milestoneNudgesEnabledForActiveCircle?: boolean
}>('/api/timeline', { query: { circleId: circleId.value, ...(year ? { year } : {}) } })
```

Add `monthCounts` to the type AND to the response handling:

```ts
const data = await $fetch<{
  memories: Memory[]
  prevYear: number | null
  monthCounts: Record<string, number>
  children: ChildProfile[]
  members: CircleMember[]
  upcomingMilestone?: UpcomingMilestone | null
  milestoneNudgesEnabledForActiveCircle?: boolean
}>('/api/timeline', { query: { circleId: circleId.value, ...(year ? { year } : {}) } })
```

After the existing line that updates `memoriesFlat.value`, merge the new monthCounts:

```ts
memoriesFlat.value = year
  ? [...memoriesFlat.value, ...data.memories]
  : data.memories

// Merge monthCounts (load-more on a new year ADDS to the map; first-page
// query for the most-recent year SEEDS the map).
monthCounts.value = year
  ? { ...monthCounts.value, ...(data.monthCounts ?? {}) }
  : (data.monthCounts ?? {})
```

### Step 5: Update the unit test

Open `unit/useTimeline.test.ts`. Find the existing tests. ADD a new `describe` block at the end:

```ts
describe('useTimeline · monthCounts integration', () => {
  test('group.total reads from monthCounts when provided', () => {
    const memories = ref<Memory[]>([
      makeMemory({ id: 'a', memory_date: '2026-04-01' }),
      makeMemory({ id: 'b', memory_date: '2026-04-15' }),
    ])
    const monthCounts = ref<Record<string, number>>({ '2026-04': 47 })
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find((g) => g.year === 2026 && g.month === 4)
    expect(aprilGroup?.total).toBe(47)
    expect(aprilGroup?.memories.length).toBe(2)
    expect(aprilGroup?.hasMore).toBe(true) // 47 > 24 = MONTH_CAP
  })

  test('group.total falls back to bucket length when monthCounts is empty', () => {
    const memories = ref<Memory[]>([
      makeMemory({ id: 'a', memory_date: '2026-04-01' }),
      makeMemory({ id: 'b', memory_date: '2026-04-15' }),
    ])
    const monthCounts = ref<Record<string, number>>({})
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find((g) => g.year === 2026 && g.month === 4)
    expect(aprilGroup?.total).toBe(2) // fallback
  })

  test('MONTH_CAP is 24 — months with up to 24 memories show all, hasMore=false', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 24 }, (_, i) =>
        makeMemory({ id: `m${i}`, memory_date: '2026-04-15' }),
      ),
    )
    const monthCounts = ref<Record<string, number>>({ '2026-04': 24 })
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find((g) => g.month === 4)
    expect(aprilGroup?.memories.length).toBe(24)
    expect(aprilGroup?.hasMore).toBe(false)
  })

  test('MONTH_CAP=24 — month with 25 memories displays 24 and sets hasMore', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 25 }, (_, i) =>
        makeMemory({ id: `m${i}`, memory_date: '2026-04-15' }),
      ),
    )
    const monthCounts = ref<Record<string, number>>({ '2026-04': 25 })
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find((g) => g.month === 4)
    expect(aprilGroup?.memories.length).toBe(24) // capped
    expect(aprilGroup?.total).toBe(25)
    expect(aprilGroup?.hasMore).toBe(true)
  })
})
```

(If the existing test file uses a `makeMemory` helper, reuse it. If not, define a minimal local one at the top of the new describe block.)

### Step 6: Run the tests

```bash
pnpm test
```

Expected: existing tests still pass + 4 new ones added. Total should jump from 585 to **589**.

If existing `useTimeline.test.ts` tests fail because they assumed `MONTH_CAP=12` semantics, update them to the new value. (The change is consistent: anything that relied on "12-element bucket" becomes "24-element bucket.")

### Step 7: Commit

```bash
git add app/composables/useTimeline.ts app/pages/timeline/index.vue unit/useTimeline.test.ts
git commit -m "feat(timeline): MONTH_CAP 12→24 + use monthCounts for true per-month total

The composable now accepts an optional monthCounts ref keyed by 'YYYY-MM'
and reads each group's total from it (falls back to bucket length).
MONTH_CAP bumped to 24 — months with up to 24 memories show fully, with
'See all N memories →' kicking in beyond that.

pages/timeline/index.vue wires the new ref to the API response's
monthCounts field. The 'See all N →' copy in TimelineMosaic is
unchanged — only N becomes accurate (was 'API-returned-bucket-size',
now is 'true DB count')."
```

---

## Task 4: Manual sweep + verification

**Files:** None modified.

- [ ] **Step 1: Start dev**

```bash
pnpm db:reset && pnpm dev
```

(The `db:reset` ensures the new RPC migration is applied.)

- [ ] **Step 2: Seed enough data to exercise the new path**

If you don't already have a test circle with >24 memories in some month, create one. Open the app, upload (or programmatically insert via Supabase Studio) 25–30 memories dated in the same month.

- [ ] **Step 3: Verify on `/timeline`**

- The grid for that dense month should display **24 cells** (was 12).
- Below the grid: `"See all 30 memories in {Month Year} →"` — the number should be the TRUE total, not 24 and not whatever-bucket-the-API-returned.
- Click the "See all" link → land on `/timeline/[year]/[month]` → spread header shows the same accurate count (30) in the hero meta.

- [ ] **Step 4: Verify on a sparse month**

- A month with ≤24 memories should NOT show the "See all" link (hasMore=false).
- All memories visible.

- [ ] **Step 5: Verify on a year with multiple dense months**

If you have, say, 100 in Jan + 80 in Feb + 5 in Dec:
- Jan shows 24 cells + "See all 100 →"
- Feb shows 24 cells + "See all 80 →"
- Dec shows 5 cells, no link.

This is the case the old YEAR_LIMIT=156 cliff couldn't handle — the new 312 limit + RPC fixes it.

- [ ] **Step 6: Test infinite scroll across years**

Scroll to bottom of the most-recent year. The page auto-fetches the previous year. Verify:
- Year ribbon appears for the new year.
- Months in the new year show accurate counts.
- `monthCounts` from the new year's response is merged into existing state (no overwrite).

---

## Task 5: Push + open PR

- [ ] **Step 1: Final test pass**

```bash
pnpm test
pnpm db:test
```

- [ ] **Step 2: Push**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open the PR**

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...monthcap-bump`

Suggested title: `Main timeline cap 12→24 + true per-month count`

Suggested body:

```markdown
## Summary

Bumps `MONTH_CAP` from 12 to 24 on the main `/timeline` overview and adds a new Postgres RPC `get_month_counts` that returns the true per-month memory count for the year. The "See all N memories →" link's `N` is now accurate — previously it was the API-returned bucket size, which under-counted heavy months.

This addresses the under-count limitation identified during the sub-plan #5 review for active circles (new parents, weddings) where months easily exceed 12 memories.

## What changed

- **Migration:** new `get_month_counts(p_circle_id, p_user_id, p_year_start, p_year_end)` RPC returning `(year, month, count)` rows. SECURITY DEFINER, manual visibility enforcement (circle OR own private). pgTAP test covers visibility filtering and empty windows.
- **API:** `/api/timeline.get.ts` year-branch adds a parallel `supabase.rpc('get_month_counts', ...)` call and returns `monthCounts: Record<string, number>` in the response. `YEAR_LIMIT_DEFAULT` bumped 156 → 312 (24 × 13 months).
- **Composable:** `useTimeline.ts` accepts an optional `monthCountsRef` and sets `group.total` from it (falls back to bucket length). `MONTH_CAP` 12 → 24.
- **Page:** `pages/timeline/index.vue` wires the new ref to the API response.
- **Tests:** 6 new pgTAP assertions + 4 new Vitest cases in `useTimeline.test.ts`.

UI copy on the "See all N memories →" link is unchanged — only `N` becomes accurate.

## Out of scope

- `/api/timeline?yearMonth=` (month-page) branch — already has accurate `totalCount` from sub-plan #5.
- Display layouts — no component changes.
- Other unfixed UX questions (windowed top-K per month etc.) — current approach fetches up to 312/year and caps display at 24/month. Good enough at this dataset scale.

## Test plan
- [x] `pnpm test` passes (585 + 4 new = 589).
- [x] `pnpm db:test` passes (existing RLS + 6 new pgTAP assertions).
- [x] Manual sweep on `/timeline` with mixed-density months — accurate counts; sparse months no link; dense months show "See all N →".
- [ ] CI: full Playwright suite.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] `pnpm test` passes (589).
- [ ] `pnpm db:test` passes (existing + 6 new pgTAP cases).
- [ ] `/timeline` displays 24 cells per month for months with ≥24 memories.
- [ ] "See all N memories →" link shows the **true** count on heavy months (verifiable by clicking through and matching the spread header on the month page).
- [ ] No regression on sparse months (≤24 memories, no link, all visible).
- [ ] PR open and CI green.

---

## Risks

- **Migration safety.** The new function is additive (no schema change, no data migration, no DROP). Rolling back is `DROP FUNCTION public.get_month_counts(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);`. No data loss risk.
- **RPC permission.** `GRANT EXECUTE ... TO authenticated` is required for PostgREST. If we forget it, the RPC returns a 401-ish error at runtime and `monthCounts` will be empty (the composable falls back to bucket length — graceful degradation).
- **Backward compatibility.** The composable's new `monthCountsRef` parameter is optional. Existing callers that haven't been updated still work — they just get the old bucket-length behavior. This includes `pages/timeline/[year]/[month].vue` (the month page) and `pages/member/[userId].vue` (the member page) which both also call `useTimeline`. Verify they aren't visibly affected.
- **YEAR_LIMIT_DEFAULT bump payload size.** 312 memories per year-fetch is roughly 2× the previous 156. For a typical memory record (~2KB JSON with signed URLs and joined relations), that's ~600KB per year. Acceptable on broadband; worth flagging if mobile data usage becomes a concern. Mitigation if needed: lazy-load the secondary fields (children, members) separately.
- **RPC perf.** `GROUP BY date_trunc('month', memory_date)` hits the existing `(circle_id, memory_date)` index. Index seek + small in-memory grouping; sub-millisecond for typical datasets. No new index needed.
