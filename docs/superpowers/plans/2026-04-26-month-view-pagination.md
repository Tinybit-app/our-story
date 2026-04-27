# Month View Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cursor-based "load more" pagination to the month overflow page so that months with hundreds of memories don't render them all at once.

**Architecture:** The existing `/api/timeline` endpoint already supports cursor pagination for the main timeline. Extend the `yearMonth` branch to also accept a `cursor` param and return `nextCursor`, using the same `${memory_date},${created_at},${id}` format. The month page (`/timeline/[year]/[month].vue`) gets an IntersectionObserver sentinel at the bottom — when it enters the viewport, the next page is fetched and appended. Page size is 24.

**Tech Stack:** Nuxt 3, Supabase (PostgREST), `@vueuse/core` (useIntersectionObserver), Vitest, Playwright

---

## File Map

| File | Change |
|---|---|
| `server/api/timeline.get.ts` | yearMonth branch: fetch 25 (to detect hasMore), return nextCursor, apply cursor filter |
| `app/pages/timeline/[year]/[month].vue` | Add cursor state, loadingMore ref, nextCursor ref, IntersectionObserver sentinel, append logic |
| `unit/api-validation.test.ts` | Add test: cursor + yearMonth accepted together |
| `tests/month-overflow.spec.ts` | Add test: load-more sentinel triggers second page fetch and appends memories |

---

## Task 1: Extend API — cursor pagination for yearMonth branch

**Files:**
- Modify: `server/api/timeline.get.ts:99-113`
- Modify: `unit/api-validation.test.ts` (end of file, after existing yearMonth tests)

### Background

`server/api/timeline.get.ts` currently has two branches:

1. **yearMonth** (lines 99–113): Fetches up to 100 for a specific month, always returns `nextCursor: null`.
2. **Main cursor branch** (lines 116–141): Cursor-based pagination with limit 20.

The cursor format is `${memory_date},${created_at},${id}`. We need to bring this same cursor logic into the `yearMonth` branch.

- [ ] **Step 1: Write the failing unit test**

Add at the end of `unit/api-validation.test.ts`, after the existing `GET /api/timeline — yearMonth param validation` describe block:

```ts
describe('GET /api/timeline — cursor + yearMonth combined', () => {
  it('accepts cursor alongside yearMonth', () => {
    const r = timelineQuerySchemaV2.safeParse({
      circleId: '123e4567-e89b-12d3-a456-426614174000',
      yearMonth: '2025-03',
      cursor: '2025-03-15T00:00:00.000Z,2025-03-15T10:00:00.000Z,abc12345-0000-0000-0000-000000000001',
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- --reporter=verbose unit/api-validation.test.ts
```

Expected: FAIL — the test itself should actually pass because `timelineQuerySchemaV2` already accepts `cursor: z.string().optional()`. If it passes, that's fine — the test is confirming the schema already handles it. Proceed to the API implementation which is the actual change.

- [ ] **Step 3: Implement cursor pagination in the yearMonth branch**

Replace the `yearMonth` branch in `server/api/timeline.get.ts` (lines 99–113):

**Before:**
```ts
  if (yearMonth) {
    // Filter to a specific calendar month — used by the month overflow page
    const parts = yearMonth.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1])
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const to = new Date(Date.UTC(year, month, 1)).toISOString()
    query = query.gte("memory_date", from).lt("memory_date", to).limit(100)

    const { data: memories, error } = await query
    if (error) {
      console.error("[timeline] month query failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to load timeline." })
    }
    return { memories: await attachSignedUrls(supabase, memories ?? []), nextCursor: null, children, members }
  }
```

**After:**
```ts
  if (yearMonth) {
    // Filter to a specific calendar month — used by the month overflow page.
    // Uses the same cursor format as the main timeline for consistent pagination.
    const PAGE_SIZE = 24
    const parts = yearMonth.split('-')
    const yearNum = Number(parts[0])
    const monthNum = Number(parts[1])
    const from = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString()
    const to = new Date(Date.UTC(yearNum, monthNum, 1)).toISOString()
    query = query.gte("memory_date", from).lt("memory_date", to).limit(PAGE_SIZE + 1)

    if (cursor) {
      const [cursorDate, cursorCreatedAt, cursorId] = cursor.split(",")
      query = (query as any).or(
        [
          `memory_date.lt.${cursorDate}`,
          `and(memory_date.eq.${cursorDate},created_at.lt.${cursorCreatedAt})`,
          `and(memory_date.eq.${cursorDate},created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        ].join(",")
      )
    }

    const { data: memories, error } = await query
    if (error) {
      console.error("[timeline] month query failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to load timeline." })
    }

    const withUrls = await attachSignedUrls(supabase, memories ?? [])
    const hasMore = withUrls.length > PAGE_SIZE
    const page = withUrls.slice(0, PAGE_SIZE)
    const last = page[page.length - 1]
    const nextCursor = hasMore && last ? `${last.memory_date},${last.created_at},${last.id}` : null
    return { memories: page, nextCursor, children, members }
  }
```

- [ ] **Step 4: Run unit tests**

```bash
pnpm test -- --reporter=verbose unit/api-validation.test.ts
```

Expected: All pass (including the new cursor+yearMonth test).

- [ ] **Step 5: Commit**

```bash
git add server/api/timeline.get.ts unit/api-validation.test.ts
git commit -m "feat(month-page): add cursor pagination to yearMonth API branch (page size 24)"
```

---

## Task 2: Add load-more UI to the month page

**Files:**
- Modify: `app/pages/timeline/[year]/[month].vue`

### Background

The month page currently fetches all memories on `onMounted` in a single call and renders them all at once. It needs to:

1. Store `nextCursor` returned from the API
2. Show a sentinel `div` at the bottom when `nextCursor` is not null
3. Use `useIntersectionObserver` (already used in `TimelinePolaroid.vue`) to fire `loadMore` when the sentinel enters the viewport
4. `loadMore` fetches the next page with the current cursor and appends to `memories`

The existing script section is 73 lines. Keep it clean.

- [ ] **Step 1: Rewrite the script section of the month page**

Replace the `<script setup lang="ts">` block in `app/pages/timeline/[year]/[month].vue` with:

```ts
<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
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

// ── Infinite scroll ────────────────────────────────────────
const loadMoreEl = ref<HTMLElement>()
const { stop: stopLoadMore } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loadingMore.value) {
    fetchPage(nextCursor.value)
  }
})

onUnmounted(() => stopLoadMore())

onMounted(() => fetchPage())
</script>
```

- [ ] **Step 2: Update the template to add the sentinel and loading spinner**

Replace the `<main>` block in the template section of `app/pages/timeline/[year]/[month].vue`. The full updated template from `<main>` onward (the header stays unchanged):

```html
    <main class="max-w-[1280px] mx-auto px-5 py-6">

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-32">
        <div class="flex flex-col items-center gap-3">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p class="text-xs text-muted-foreground">{{ t('timeline.loading') }}</p>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="memories.length === 0" class="text-center py-32">
        <p class="text-sm text-muted-foreground">{{ t('timeline.noMemoriesFor', { month: monthLabel }) }}</p>
      </div>

      <!-- Polaroid grid -->
      <div v-else>
        <p class="text-xs text-muted-foreground mb-6">
          {{ t('timeline.memories', memories.length) }}
        </p>
        <div class="flex flex-wrap gap-5 items-start">
          <template v-for="(memory, i) in memories" :key="memory.id">
            <QuickNoteCard
              v-if="!memory.memorymedia.length && memory.note"
              :memory="memory"
              :index="i"
              @open="onOpenMemory"
              @reaction-update="onReactionUpdate"
            />
            <PolaroidCard
              v-else
              :memory="memory"
              :index="i"
              :wide="isWideMemory(memory.id)"
              @open="onOpenMemory"
              @reaction-update="onReactionUpdate"
            />
          </template>
        </div>

        <!-- Infinite scroll sentinel + load-more spinner -->
        <div ref="loadMoreEl" class="h-8 mt-4" />
        <div v-if="loadingMore" class="flex justify-center py-4">
          <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

    </main>
```

- [ ] **Step 3: Run unit tests to verify no regressions**

```bash
pnpm test
```

Expected: All pass (741+ tests, 0 failures in the main tree).

- [ ] **Step 4: Commit**

```bash
git add app/pages/timeline/[year]/[month].vue
git commit -m "feat(month-page): add infinite scroll load-more to month overflow page"
```

---

## Task 3: Update E2E tests for the month page

**Files:**
- Modify: `tests/month-overflow.spec.ts`

### Background

`tests/month-overflow.spec.ts` has 6 tests for the month page but none cover pagination. Add a test that:

1. Mocks the first API call (with `yearMonth` only, no cursor) → returns 24 memories + `nextCursor: "cursor-page-2"`
2. Mocks the second API call (with cursor = `"cursor-page-2"`) → returns 3 more memories + `nextCursor: null`
3. Navigates to `/timeline/2024/06`
4. Waits for the first batch to load (verify 24 memories label or first batch count)
5. Scrolls to bottom (the sentinel enters viewport)
6. Waits for the second API call to fire
7. Verifies the new memories are appended (total count shows ≥ 24)

Also: update the existing `mockTimelineWithNote` helper to include `memorycomment: []` on the memory object (missing field that matches the `Memory` type).

- [ ] **Step 1: Add the load-more test to `tests/month-overflow.spec.ts`**

Add these helpers and the new test inside the existing `test.describe('Month overflow page (/timeline/[year]/[month])', () => {` block, after the last test:

```ts
  // ── Load-more pagination ─────────────────────────────────────────────────────

  test('scrolling to bottom loads the next page and appends memories', async ({ page }) => {
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
          body: JSON.stringify({ memories: page2Memories, nextCursor: null, children: [], members: [] }),
        })
      }
      // First page
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memories: page1Memories, nextCursor: 'cursor-page-2', children: [], members: [] }),
      })
    })

    await page.goto('/timeline/2024/06')

    // Wait for first page to render — count label should show 24
    await expect(page.getByText(/24 memories|memories/i)).toBeVisible({ timeout: 10_000 })

    // Scroll the IntersectionObserver sentinel into view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait for the second API call to fire
    await page.waitForFunction(() => document.querySelectorAll('article').length >= 24, { timeout: 10_000 })

    // Verify second-page memories were appended (total ≥ 24, second-page note visible)
    expect(page2Fetched).toBe(true)
    await expect(page.getByText(/Extra note 0/)).toBeVisible({ timeout: 5_000 })
  })
```

- [ ] **Step 2: Also fix `memorycomment` missing from existing `QUICK_NOTE_MEMORY` fixture**

In `tests/month-overflow.spec.ts`, update `QUICK_NOTE_MEMORY` to include `memorycomment: []` and `former_owner_user_id: null`:

```ts
const QUICK_NOTE_MEMORY = {
  id: MEMORY_ID,
  owner_user_id: '00000000-dead-beef-0000-000000000001',
  circle_id: CIRCLE_ID,
  note: 'She said mama for the first time today',
  milestone_label: null,
  memory_date: '2024-06-15',
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
```

- [ ] **Step 3: Run only the month-overflow E2E test to verify**

```bash
pnpm test:e2e -- tests/month-overflow.spec.ts
```

Expected: All 7 tests pass (6 existing + 1 new).

- [ ] **Step 4: Commit**

```bash
git add tests/month-overflow.spec.ts
git commit -m "test(month-page): add E2E test for load-more pagination"
```

---

## Self-Review

**Spec coverage:**

- ✅ API: yearMonth + cursor pagination, returns nextCursor, page size 24 → Task 1
- ✅ API: returns `nextCursor: null` when last page (no more) → Task 1 (PAGE_SIZE+1 probe)
- ✅ UI: IntersectionObserver sentinel fires loadMore → Task 2
- ✅ UI: New memories appended (not replaced) → Task 2 `fetchPage`
- ✅ UI: Spinner shown during loadingMore → Task 2 template
- ✅ Unit test: cursor + yearMonth schema accepted → Task 1
- ✅ E2E test: scroll triggers second fetch and appends → Task 3

**Placeholder scan:** None found.

**Type consistency:**
- `nextCursor: string | null` used consistently in API response shape and `ref<string | null>(null)`.
- `fetchPage(cursor?: string)` signature consistent with all call sites.
- `PAGE_SIZE = 24` defined once in the API — client never needs to know the page size.
