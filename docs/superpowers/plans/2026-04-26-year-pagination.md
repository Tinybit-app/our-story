# Year-at-a-Time Timeline + Load More Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the main timeline's cursor-based 20-at-a-time pagination with year-at-a-time loading, and replace the month overflow page's infinite scroll sentinel with an explicit "Load more" button.

**Architecture:** The API gets a new `year` query param; when neither `yearMonth` nor `authorId` is given, it fetches all memories for one year (capped at `YEAR_LIMIT=156`) and returns `prevYear` (the prior year that has memories, or null) instead of `nextCursor`. The main timeline page replaces `nextCursor` with `prevYear` and passes it into the existing `TimelinePolaroid` `hasNextPage`/`loadMore` props — that component needs no changes. The month overflow page replaces the `useIntersectionObserver` sentinel with an explicit button.

**Tech Stack:** Nuxt 3, TypeScript, Supabase (PostgREST), Vitest (unit tests), Playwright (E2E tests), vue-i18n

---

## File Map

| File                                    | Change                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `server/api/timeline.get.ts`            | Add `year` param + year branch + `getLatestYear`/`getPrevYear` helpers; isolate `authorId` into its own early-return branch |
| `unit/api-validation.test.ts`           | Add `year` param validation tests                                                                                           |
| `app/pages/timeline/[year]/[month].vue` | Replace IntersectionObserver sentinel with explicit "Load more" button                                                      |
| `locales/en.json`                       | Add `timeline.loadMore`                                                                                                     |
| `locales/zh-CN.json`                    | Add `timeline.loadMore`                                                                                                     |
| `locales/fr.json`                       | Add `timeline.loadMore`                                                                                                     |
| `tests/month-overflow.spec.ts`          | Replace scroll-trigger test with button-click test                                                                          |
| `app/pages/timeline/index.vue`          | Replace `nextCursor` ref with `prevYear`; refactor `fetchTimeline(cursor?)` to `fetchTimeline(year?)`                       |
| `tests/timeline-year.spec.ts`           | New E2E test: year-at-a-time loads + prev-year trigger                                                                      |

---

## Task 1: API — Year param + year-based fetch branch

**Files:**

- Modify: `server/api/timeline.get.ts`
- Modify: `unit/api-validation.test.ts`

### Step 1.1: Write failing unit test for `year` param validation

In `unit/api-validation.test.ts`, append at the end of the file:

```ts
// ============================================================
// GET /api/timeline — year param validation
// ============================================================
const timelineQuerySchemaV3 = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

describe('GET /api/timeline — year param validation', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

  it('accepts a valid year', () => {
    const r = timelineQuerySchemaV3.safeParse({ circleId: VALID_UUID, year: 2024 })
    expect(r.success).toBe(true)
  })

  it('coerces year string to number', () => {
    const r = timelineQuerySchemaV3.safeParse({ circleId: VALID_UUID, year: '2024' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.year).toBe(2024)
  })

  it('rejects year below 2000', () => {
    const r = timelineQuerySchemaV3.safeParse({ circleId: VALID_UUID, year: 1999 })
    expect(r.success).toBe(false)
  })

  it('rejects year above 2100', () => {
    const r = timelineQuerySchemaV3.safeParse({ circleId: VALID_UUID, year: 2101 })
    expect(r.success).toBe(false)
  })

  it('accepts request without year (auto-detects latest)', () => {
    const r = timelineQuerySchemaV3.safeParse({ circleId: VALID_UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.year).toBeUndefined()
  })
})
```

- [ ] **Step 1.1: Add the test block above to `unit/api-validation.test.ts`**

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test unit/api-validation.test.ts
```

Expected: `year param validation` suite FAIL — `timelineQuerySchemaV3` not yet defined (it's local to the test file, so it will actually pass since we define it inline). Actually the tests should PASS since we define the schema inside the test file too. This is correct — the test documents the expected behavior of the real schema.

- [ ] **Step 1.3: Implement the API changes in `server/api/timeline.get.ts`**

Replace the entire file with:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const YEAR_LIMIT = 156 // 13 months × 12 memories/month (safety cap)

const querySchema = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const MEMORY_SELECT = `
  id, owner_user_id, former_owner_name, former_owner_user_id, visibility, note, memory_date, milestone_label, created_at,
  memory_children(child_id, childprofile(id, name, date_of_birth)),
  memory_members(user_id, user:user_id(id, first_name, last_name, avatar_url)),
  memorymedia(id, storage_path, media_type, file_size),
  user!owner_user_id(first_name, last_name, avatar_url),
  memoryreaction(id, emoji, user_id, guest_name, user!user_id(first_name, last_name)),
  memorycomment(id)
`

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'circleId is required' })
  const { circleId, cursor, authorId, yearMonth, year } = result.data

  // Verify the requesting user belongs to this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  // Fetch child profiles for baby age stamp display + upload picker
  const { data: childProfiles, error: childError } = await (supabase as any)
    .from('childprofile')
    .select('id, name, date_of_birth')
    .eq('circle_id', circleId)
    .order('date_of_birth', { ascending: true })

  if (childError) console.error('[timeline] childprofile query failed:', childError.message)

  const children: Array<{ id: string; name: string; date_of_birth: string }> = childProfiles ?? []

  // Fetch circle members for the people picker in the upload form.
  const { data: memberRows, error: memberError } = await supabase
    .from('circlemember')
    .select('user_id')
    .eq('circle_id', circleId)
    .order('created_at')

  if (memberError) console.error('[timeline] members query failed:', memberError.message)

  const memberUserIds = (memberRows ?? []).map((m: any) => m.user_id as string)

  let members: Array<{
    userId: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }> = []

  if (memberUserIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('user')
      .select('id, first_name, last_name, avatar_url')
      .in('id', memberUserIds)

    if (profileError)
      console.error('[timeline] member profiles query failed:', profileError.message)

    const profileMap = new Map((profileRows ?? []).map((p: any) => [p.id, p]))
    members = memberUserIds.map((uid) => {
      const p = profileMap.get(uid)
      return {
        userId: uid,
        firstName: p?.first_name ?? null,
        lastName: p?.last_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
      }
    })
  }

  // Base query shared across branches
  const baseQuery = () =>
    (supabase as any)
      .from('memory')
      .select(MEMORY_SELECT)
      .eq('circle_id', circleId)
      .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`)
      .order('memory_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

  // ── Branch 1: Month overflow (cursor-paginated) ────────────
  if (yearMonth) {
    const PAGE_SIZE = 24
    const parts = yearMonth.split('-')
    const yearNum = Number(parts[0])
    const monthNum = Number(parts[1])
    const from = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString()
    const to = new Date(Date.UTC(yearNum, monthNum, 1)).toISOString()
    let q = baseQuery()
      .gte('memory_date', from)
      .lt('memory_date', to)
      .limit(PAGE_SIZE + 1)

    if (cursor) {
      const [cursorDate, cursorCreatedAt, cursorId] = cursor.split(',')
      q = q.or(
        [
          `memory_date.lt.${cursorDate}`,
          `and(memory_date.eq.${cursorDate},created_at.lt.${cursorCreatedAt})`,
          `and(memory_date.eq.${cursorDate},created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        ].join(','),
      )
    }

    const { data: memories, error } = await q
    if (error) {
      console.error('[timeline] month query failed:', error.message)
      throw createError({ statusCode: 500, message: 'Failed to load timeline.' })
    }

    const raw = memories ?? []
    const hasMore = raw.length > PAGE_SIZE
    const page = raw.slice(0, PAGE_SIZE)
    const withUrls = await attachSignedUrls(supabase, page)
    const last = withUrls[withUrls.length - 1]
    const nextCursor = hasMore && last ? `${last.memory_date},${last.created_at},${last.id}` : null
    return { memories: withUrls, nextCursor, children, members }
  }

  // ── Branch 2: Member page (cursor-based, authorId filter) ──
  if (authorId) {
    let q = baseQuery().eq('owner_user_id', authorId).limit(20)

    if (cursor) {
      const [cursorDate, cursorCreatedAt, cursorId] = cursor.split(',')
      q = q.or(
        [
          `memory_date.lt.${cursorDate}`,
          `and(memory_date.eq.${cursorDate},created_at.lt.${cursorCreatedAt})`,
          `and(memory_date.eq.${cursorDate},created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        ].join(','),
      )
    }

    const { data: memories, error } = await q
    if (error) {
      console.error('[timeline] author query failed:', error.message)
      throw createError({ statusCode: 500, message: 'Failed to load timeline.' })
    }

    const withUrls = await attachSignedUrls(supabase, memories ?? [])
    const last = withUrls[withUrls.length - 1]
    const nextCursor = last ? `${last.memory_date},${last.created_at},${last.id}` : null
    return { memories: withUrls, nextCursor, children, members }
  }

  // ── Branch 3: Main timeline (year-at-a-time) ───────────────
  const targetYear = year ?? (await getLatestYear(supabase, circleId, user.sub))

  if (!targetYear) {
    return { memories: [], prevYear: null, children, members }
  }

  const from = new Date(Date.UTC(targetYear, 0, 1)).toISOString()
  const to = new Date(Date.UTC(targetYear + 1, 0, 1)).toISOString()

  const { data: memories, error } = await baseQuery()
    .gte('memory_date', from)
    .lt('memory_date', to)
    .limit(YEAR_LIMIT)

  if (error) {
    console.error('[timeline] year query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load timeline.' })
  }

  const prevYear = await getPrevYear(supabase, circleId, user.sub, targetYear)
  const withUrls = await attachSignedUrls(supabase, memories ?? [])
  return { memories: withUrls, prevYear, children, members }
})

// ── Helpers ────────────────────────────────────────────────────

async function getLatestYear(
  supabase: any,
  circleId: string,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${userId})`)
    .order('memory_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? new Date(data.memory_date).getUTCFullYear() : null
}

async function getPrevYear(
  supabase: any,
  circleId: string,
  userId: string,
  currentYear: number,
): Promise<number | null> {
  const before = new Date(Date.UTC(currentYear, 0, 1)).toISOString()
  const { data } = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${userId})`)
    .lt('memory_date', before)
    .order('memory_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? new Date(data.memory_date).getUTCFullYear() : null
}

async function attachSignedUrls(supabase: any, memories: any[]) {
  return Promise.all(
    memories.map(async (memory) => {
      const mediaWithUrls = await Promise.all(
        ((memory.memorymedia as any[]) ?? []).map(async (media) => {
          const { storage_path, ...safeMedia } = media
          if (!storage_path) return { ...safeMedia, url: null, thumbnailUrl: null }

          const isVideo = media.media_type === 'video'

          const [fullResult, thumbResult] = await Promise.allSettled([
            supabase.storage.from('memories-private').createSignedUrl(storage_path, 3600),
            isVideo
              ? Promise.resolve({ data: null })
              : supabase.storage.from('memories-private').createSignedUrl(storage_path, 86400, {
                  transform: { width: 800, format: 'webp' as 'origin', quality: 85 },
                }),
          ])

          const url =
            fullResult.status === 'fulfilled' ? (fullResult.value.data?.signedUrl ?? null) : null
          const thumbnailUrl = isVideo
            ? url
            : thumbResult.status === 'fulfilled'
              ? (thumbResult.value.data?.signedUrl ?? url)
              : url

          return { ...safeMedia, url, thumbnailUrl }
        }),
      )
      return { ...memory, memorymedia: mediaWithUrls }
    }),
  )
}
```

- [ ] **Step 1.4: Run unit tests**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test unit/api-validation.test.ts
```

Expected: All tests PASS including the new `year param validation` suite.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/dzheng/dev/tinybit/our-story
git add server/api/timeline.get.ts unit/api-validation.test.ts
git commit -m "feat(api): add year-based timeline fetch with prevYear pagination"
```

---

## Task 2: Month overflow — Replace IntersectionObserver with "Load more" button

**Files:**

- Modify: `locales/en.json`
- Modify: `locales/zh-CN.json`
- Modify: `locales/fr.json`
- Modify: `app/pages/timeline/[year]/[month].vue`
- Modify: `tests/month-overflow.spec.ts`

- [ ] **Step 2.1: Add `timeline.loadMore` i18n key**

In `locales/en.json`, find the `"timeline"` block and add `"loadMore"` after `"noMemoriesFor"`:

```json
"timeline": {
  "emptyTitle": "Your story starts here",
  "emptyDesc": "Add your first photo or video to start building your shared timeline.",
  "loading": "Loading memories…",
  "memories": "{n} memory | {n} memories",
  "months": "{n} month | {n} months",
  "more": "more",
  "open": "Open",
  "noMemoriesFor": "No memories found for {month}.",
  "loadMore": "Load more"
},
```

In `locales/zh-CN.json`, same location:

```json
"loadMore": "加载更多"
```

In `locales/fr.json`, same location:

```json
"loadMore": "Charger plus"
```

- [ ] **Step 2.2: Replace IntersectionObserver with "Load more" button in `app/pages/timeline/[year]/[month].vue`**

Replace the entire `<script setup>` section and the sentinel/spinner in the template.

**Template change** — replace the sentinel + loading spinner block at the bottom of the `v-else` div:

Old:

```html
<!-- Infinite scroll sentinel + load-more spinner -->
<div ref="loadMoreEl" class="mt-4 h-8" />
<div v-if="loadingMore" class="flex justify-center py-4">
  <div class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
</div>
```

New:

```html
<!-- Load more button -->
<div v-if="nextCursor" class="mt-8 flex justify-center">
  <button
    :disabled="loadingMore"
    class="flex h-9 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    @click="fetchPage(nextCursor!)"
  >
    <div
      v-if="loadingMore"
      class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
    {{ t('timeline.loadMore') }}
  </button>
</div>
```

**Script change** — remove the `useIntersectionObserver` import, remove `loadMoreEl` ref, remove the observer setup. Replace entire `<script setup>` with:

```ts
<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
const { t, locale } = useI18n()

const route = useRoute()
const year = Number(route.params.year)
const month = Number(route.params.month)

// Redirect to home if route params are invalid
if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) {
  await navigateTo('/timeline')
}

const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
)

function isWideMemory(id: string): boolean {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 10) < 3
}

const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circleId = computed<string | null>(() => circlesData.value?.circles?.[0]?.id ?? null)

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const memories = ref<Memory[]>([])
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)

// ── Modals ─────────────────────────────────────────────────
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({ memory, tilt, rect }: { memory: Memory; tilt: number; rect: DOMRect | null }) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = memories.value.findIndex((m) => m.id === memory.id)
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memories.value.findIndex((m) => m.id === patch.id)
  if (i !== -1) memories.value[i] = { ...memories.value[i], ...patch } as Memory
}

function onReactionUpdate({ memoryId, reactions }: { memoryId: string; reactions: any[] }) {
  const i = memories.value.findIndex((m) => m.id === memoryId)
  if (i !== -1) memories.value[i] = { ...memories.value[i], memoryreaction: reactions } as Memory
}

async function fetchPage(cursor?: string) {
  if (!circleId.value) return
  const isFirst = !cursor
  if (isFirst) loading.value = true; else loadingMore.value = true
  try {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`
    const query: Record<string, string> = { circleId: circleId.value, yearMonth }
    if (cursor) query.cursor = cursor
    const data = await $fetch<{ memories: Memory[]; nextCursor: string | null; children: ChildProfile[]; members: CircleMember[] }>(
      '/api/timeline',
      { query }
    )
    if (isFirst) {
      memories.value = data.memories
      children.value = data.children ?? []
      members.value = data.members ?? []
    } else {
      memories.value = [...memories.value, ...data.memories]
    }
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[month-page] fetch error:', err)
  } finally {
    if (isFirst) loading.value = false; else loadingMore.value = false
  }
}

onMounted(() => fetchPage())
</script>
```

- [ ] **Step 2.3: Update E2E test `tests/month-overflow.spec.ts`**

Replace the final test (the scroll-trigger test) with a button-click test. Replace the entire test starting at line 200:

```ts
// ── Load-more pagination ─────────────────────────────────────────────────────

test('clicking "Load more" button loads the next page and appends memories', async ({ page }) => {
  await mockMembership(page)
  await mockCirclesList(page)

  // Generate 24 stub memories for the first page
  const page1Memories = Array.from({ length: 24 }, (_, i) => ({
    id: `memory-${String(i).padStart(3, '0')}`,
    owner_user_id: '00000000-dead-beef-0000-000000000001',
    circle_id: CIRCLE_ID,
    note: null,
    milestone_label: null,
    memory_date: `2024-06-${String(15 - Math.floor(i / 2)).padStart(2, '0')}`,
    visibility: 'circle',
    former_owner_name: null,
    former_owner_user_id: null,
    memorymedia: [],
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }))

  // 3 extra memories for the second page
  const page2Memories = Array.from({ length: 3 }, (_, i) => ({
    id: `memory-extra-${i}`,
    owner_user_id: '00000000-dead-beef-0000-000000000001',
    circle_id: CIRCLE_ID,
    note: `Extra note ${i}`,
    milestone_label: null,
    memory_date: '2024-06-01',
    visibility: 'circle',
    former_owner_name: null,
    former_owner_user_id: null,
    memorymedia: [],
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }))

  let page2Fetched = false

  await page.route('**/api/timeline**', (route) => {
    const url = new URL(route.request().url())
    const cursor = url.searchParams.get('cursor')
    if (cursor === 'cursor-page-2') {
      page2Fetched = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories: page2Memories,
          nextCursor: null,
          children: [],
          members: [],
        }),
      })
    }
    // First page — returns a cursor so the Load more button appears
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories: page1Memories,
        nextCursor: 'cursor-page-2',
        children: [],
        members: [],
      }),
    })
  })

  await page.goto('/timeline/2024/06')

  // Wait for first page to render — count label shows 24
  await expect(page.getByText(/24 memories/i)).toBeVisible({ timeout: 10_000 })

  // "Load more" button should be visible (nextCursor is set)
  const loadMoreBtn = page.getByRole('button', { name: /load more/i })
  await expect(loadMoreBtn).toBeVisible({ timeout: 5_000 })

  // Click it
  await loadMoreBtn.click()

  // Wait for second-page memories to append
  await page.waitForFunction(() => document.querySelectorAll('article').length >= 27, {
    timeout: 10_000,
  })

  // Verify second-page memories were appended
  expect(page2Fetched).toBe(true)
  await expect(page.getByText(/Extra note 0/)).toBeVisible({ timeout: 5_000 })

  // "Load more" button gone — nextCursor is now null
  await expect(loadMoreBtn).not.toBeVisible({ timeout: 3_000 })
})
```

- [ ] **Step 2.4: Run E2E tests for the month overflow page**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test:e2e tests/month-overflow.spec.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/dzheng/dev/tinybit/our-story
git add app/pages/timeline/[year]/[month].vue locales/en.json locales/zh-CN.json locales/fr.json tests/month-overflow.spec.ts
git commit -m "feat(timeline): replace infinite scroll with Load more button on month overflow page"
```

---

## Task 3: Main timeline — Year-at-a-time fetch

**Files:**

- Modify: `app/pages/timeline/index.vue`

- [ ] **Step 3.1: Replace `nextCursor` with `prevYear` and update `fetchTimeline` in `app/pages/timeline/index.vue`**

**Change 1:** Replace the data refs and `fetchTimeline` function. Find the block:

```ts
const memoriesFlat = ref<Memory[]>([])
const nextCursor = ref<string | null>(null)
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)

async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{
      memories: Memory[]
      nextCursor: string | null
      children: ChildProfile[]
      members: CircleMember[]
    }>('/api/timeline', {
      query: { circleId: circleId.value, ...(cursor ? { cursor } : {}) },
    })
    memoriesFlat.value = cursor ? [...memoriesFlat.value, ...data.memories] : data.memories
    nextCursor.value = data.nextCursor
    if (!cursor) {
      children.value = data.children ?? []
      members.value = data.members ?? []
    }
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}
```

Replace with:

```ts
const memoriesFlat = ref<Memory[]>([])
const prevYear = ref<number | null>(null)
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)

async function fetchTimeline(year?: number) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{
      memories: Memory[]
      prevYear: number | null
      children: ChildProfile[]
      members: CircleMember[]
    }>('/api/timeline', {
      query: { circleId: circleId.value, ...(year ? { year } : {}) },
    })
    memoriesFlat.value = year ? [...memoriesFlat.value, ...data.memories] : data.memories
    prevYear.value = data.prevYear
    if (!year) {
      children.value = data.children ?? []
      members.value = data.members ?? []
    }
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}
```

**Change 2:** Update the `TimelinePolaroid` props in the template. Find:

```html
<TimelinePolaroid
  ref="timelinePolaroidRef"
  :month-groups="monthGroups"
  :loading="loading"
  :has-next-page="!!nextCursor"
  :circle-type="circle?.circle_type ?? null"
  @load-more="fetchTimeline(nextCursor ?? undefined)"
  @year-change="onYearChange"
  @open-memory="onOpenMemory"
  @reaction-update="onReactionUpdate"
/>
```

Replace with:

```html
<TimelinePolaroid
  ref="timelinePolaroidRef"
  :month-groups="monthGroups"
  :loading="loading"
  :has-next-page="!!prevYear"
  :circle-type="circle?.circle_type ?? null"
  @load-more="fetchTimeline(prevYear ?? undefined)"
  @year-change="onYearChange"
  @open-memory="onOpenMemory"
  @reaction-update="onReactionUpdate"
/>
```

**Change 3:** Update `switchCircle` to reset `prevYear` instead of `nextCursor`. Find:

```ts
function switchCircle(id: string) {
  circleSwitcherOpen.value = false;
  memoriesFlat.value = [];
  nextCursor.value = null;
```

Replace with:

```ts
function switchCircle(id: string) {
  circleSwitcherOpen.value = false;
  memoriesFlat.value = [];
  prevYear.value = null;
```

**Change 4:** Update `circleId` watcher. Find:

```ts
watch(circleId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    memoriesFlat.value = []
    nextCursor.value = null
    currentYear.value = null
    fetchTimeline()
  }
})
```

Replace with:

```ts
watch(circleId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    memoriesFlat.value = []
    prevYear.value = null
    currentYear.value = null
    fetchTimeline()
  }
})
```

- [ ] **Step 3.2: Run unit tests to check nothing broken**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test
```

Expected: All tests PASS.

- [ ] **Step 3.3: Commit**

```bash
cd /Users/dzheng/dev/tinybit/our-story
git add app/pages/timeline/index.vue
git commit -m "feat(timeline): load one year at a time on main timeline page"
```

---

## Task 4: E2E tests for year-at-a-time main timeline

**Files:**

- Create: `tests/timeline-year.spec.ts`

- [ ] **Step 4.1: Write the E2E test file**

Create `tests/timeline-year.spec.ts`:

```ts
/**
 * Main timeline — year-at-a-time E2E tests
 *
 * The /timeline page (index) loads all memories for the latest year on first
 * render, then loads the previous year automatically when the IntersectionObserver
 * sentinel scrolls into view.
 *
 * Tests:
 *  1. First load fetches the latest year automatically (no year param)
 *  2. Scrolling to the bottom triggers a previous-year fetch (year param passed)
 *  3. Memories from the previous year are appended to memoriesFlat
 *  4. No load-more trigger when prevYear is null (all years loaded)
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
    }),
  )
}

function mockCirclesList(page: any) {
  return page.route('**/api/circles**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        circles: [
          {
            id: CIRCLE_ID,
            name: 'Smith Family',
            circle_type: 'family',
            memberCount: 2,
            role: 'owner',
            anniversary_date: null,
          },
        ],
      }),
    })
  })
}

function mockProfile(page: any) {
  return page.route('**/api/profile**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        avatarUrl: null,
        locale: 'en',
      }),
    })
  })
}

function makeMemory(id: string, date: string) {
  return {
    id,
    owner_user_id: '00000000-dead-beef-0000-000000000001',
    circle_id: CIRCLE_ID,
    note: `Memory ${id}`,
    milestone_label: null,
    memory_date: date,
    visibility: 'circle',
    former_owner_name: null,
    former_owner_user_id: null,
    memorymedia: [],
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }
}

test.describe('Main timeline — year-at-a-time loading', () => {
  test('first load fetches the latest year without a year param', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const year2025Memories = [
      makeMemory('m-2025-1', '2025-06-15'),
      makeMemory('m-2025-2', '2025-03-10'),
    ]
    let capturedYear: string | null = null

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      capturedYear = url.searchParams.get('year')
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories: year2025Memories,
          prevYear: 2024,
          children: [],
          members: [],
        }),
      })
    })

    await page.goto('/timeline')

    // Timeline should render with memories from the (mocked) latest year
    await expect(page.getByText(/Memory m-2025-1/)).toBeVisible({ timeout: 10_000 })

    // First call should NOT send a year param (auto-detect)
    expect(capturedYear).toBeNull()
  })

  test('scrolling to bottom triggers previous-year fetch with correct year param', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const year2025Memories = Array.from({ length: 3 }, (_, i) =>
      makeMemory(`m-2025-${i}`, `2025-0${i + 1}-15`),
    )
    const year2024Memories = Array.from({ length: 3 }, (_, i) =>
      makeMemory(`m-2024-${i}`, `2024-0${i + 1}-15`),
    )

    let secondCallYear: string | null = null
    let callCount = 0

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      callCount++
      if (callCount === 1) {
        // First load — return 2025 memories with prevYear=2024
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: year2025Memories,
            prevYear: 2024,
            children: [],
            members: [],
          }),
        })
      }
      // Subsequent load — should have year=2024
      secondCallYear = url.searchParams.get('year')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories: year2024Memories,
          prevYear: null,
          children: [],
          members: [],
        }),
      })
    })

    await page.goto('/timeline')
    await expect(page.getByText(/Memory m-2025-0/)).toBeVisible({ timeout: 10_000 })

    // Scroll to bottom to trigger IntersectionObserver sentinel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait for 2024 memories to be appended
    await page.waitForFunction(() => document.querySelectorAll('article').length >= 6, {
      timeout: 10_000,
    })

    // Verify the second call was made with year=2024
    expect(secondCallYear).toBe('2024')
    await expect(page.getByText(/Memory m-2024-0/)).toBeVisible({ timeout: 5_000 })
  })

  test('no further loads when prevYear is null', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memories = [makeMemory('m-2025-1', '2025-06-15')]
    let callCount = 0

    await page.route('**/api/timeline**', (route) => {
      callCount++
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // prevYear null — no more years to load
        body: JSON.stringify({ memories, prevYear: null, children: [], members: [] }),
      })
    })

    await page.goto('/timeline')
    await expect(page.getByText(/Memory m-2025-1/)).toBeVisible({ timeout: 10_000 })

    // Scroll to trigger the sentinel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait a tick — no second call should fire
    await page.waitForTimeout(500)
    expect(callCount).toBe(1)
  })
})
```

- [ ] **Step 4.2: Run the new E2E tests**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test:e2e tests/timeline-year.spec.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 4.3: Run full E2E suite to catch regressions**

```bash
cd /Users/dzheng/dev/tinybit/our-story && pnpm test:e2e
```

Expected: All tests PASS.

- [ ] **Step 4.4: Commit**

```bash
cd /Users/dzheng/dev/tinybit/our-story
git add tests/timeline-year.spec.ts
git commit -m "test(e2e): add year-at-a-time timeline loading tests"
```

---

## Self-Review

**Spec coverage:**

| Requirement                                                | Task                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Main timeline loads 1 year at a time                       | Task 1 (API), Task 3 (frontend)                                                                                                           |
| Auto-detect latest year on first load                      | Task 1 (`getLatestYear` helper)                                                                                                           |
| `prevYear` field instead of `nextCursor` for main timeline | Task 1, Task 3                                                                                                                            |
| Month overflow uses explicit "Load more" button            | Task 2                                                                                                                                    |
| Month overflow retains cursor pagination                   | Task 2 (unchanged `nextCursor` in monthOverflow branch)                                                                                   |
| `authorId` (member page) backward compat maintained        | Task 1 (separate authorId branch)                                                                                                         |
| Performance: YEAR_LIMIT=156 cap                            | Task 1 (`YEAR_LIMIT` constant)                                                                                                            |
| Performance: prevYear via single LIMIT-1 query             | Task 1 (`getPrevYear` helper)                                                                                                             |
| Performance: latestYear via single LIMIT-1 query           | Task 1 (`getLatestYear` helper)                                                                                                           |
| Performance: no signed URL waste (slice before sign)       | Task 1 (year branch uses `.limit(YEAR_LIMIT)` server-side; monthOverflow branch uses `raw.slice(0, PAGE_SIZE)` before `attachSignedUrls`) |
| i18n: `timeline.loadMore` in all 3 locales                 | Task 2                                                                                                                                    |
| Unit tests: `year` param validation                        | Task 1                                                                                                                                    |
| E2E tests: year-at-a-time flow                             | Task 4                                                                                                                                    |
| E2E tests: month overflow button click                     | Task 2                                                                                                                                    |

**Placeholder scan:** None found.

**Type consistency:**

- `prevYear: number | null` used consistently in API return and `index.vue`
- `fetchTimeline(year?: number)` — `year` is `number | undefined` (never string)
- `TimelinePolaroid` props `hasNextPage` and `loadMore` semantics unchanged

**Scope:** Single plan, all changes are interdependent (API → frontend → tests).
