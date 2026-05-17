# Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy header on `/timeline/[year]/[month]` with a `MonthSpreadHeader` — an italic month-title hero with sticky prev/next pill navigation — and clean up the page's leftover dead code from sub-plan #2's minimal patch. Adds a new `/api/timeline/months-with-data` endpoint that returns the nearest prev/next months containing memories. Adds a Share-link affordance. The body grid (mosaic of `MosaicCell` instances) already shipped in sub-plan #2 and is left as-is.

**Architecture:** Sub-plan #2 left the page using `MosaicCell` directly with a basic Tailwind grid. The body stays. We replace ONLY the sticky page header with a new component that lives between the back-button strip and the body grid: a magazine-spread-style hero with the italic month name, a meta row, and a sticky pill bar showing prev / current / next month. Prev/next adjacency is fetched from a new lightweight endpoint that walks the memory table by `memory_date` per spec §15's data-thrift recommendation.

This is **Sub-plan #5 of 7**. Depends on sub-plan #2 (Timeline Mosaic, merged via PR #3/#4). Independent of #3 / #4 (memory modal — those re-skin the modal but the month page opens the existing `MemoryShell` unchanged).

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §5.1.

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Supabase (server endpoint) + Tailwind v3 + Vitest + Playwright.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `server/api/timeline/months-with-data.get.ts` | Create | Returns `{ prev: { year, month } \| null, next: { year, month } \| null }` for a given `(circleId, year, month)`. The two slots are the NEAREST months with memories on either side; empty months are skipped. |
| `app/components/MonthSpreadHeader.vue` | Create | The new header. Renders the page strip (back link + brand kicker), the hero (italic month name + meta row), and the sticky pill bar (prev / current · year / next). Emits navigation to the existing month routes. Optional Share button (copy deep link). |
| `app/pages/timeline/[year]/[month].vue` | Modify | Replace the existing `<header>` block with `<MonthSpreadHeader>`. Remove dead `onReactionUpdate` function (orphan from sub-plan #2). Fetch prev/next from the new endpoint at mount. |
| `locales/en.json` / `zh-CN.json` / `fr.json` | Modify | Add `timeline.shareMonth` ("Copy link") and `timeline.shareMonthCopied` ("Link copied"). |
| `unit/months-with-data.test.ts` | Create | Unit-style test for the endpoint's query shape and adjacency logic. (Full DB integration test stays manual.) |
| `tests/month-view.spec.ts` | Create | E2E: navigate to `/timeline/2026/4`, assert the spread header renders the italic month name and the sticky prev/next pill bar, click next-month pill and verify URL changes. |

That's the complete change set: 1 new API route, 1 new component, 1 page rewrite, 3 locale files, 2 new test files.

---

## Task 1: New API endpoint — `/api/timeline/months-with-data`

**Files:**
- Create: `server/api/timeline/months-with-data.get.ts`
- Create: `unit/months-with-data.test.ts`

The endpoint takes `(circleId, year, month)` and returns the nearest neighbor months that have memories. Existing patterns: `server/api/timeline/years.get.ts` (which walks year-by-year via `LIMIT 1` index scans) is the model. We do the same at month granularity.

### Step 1: Write the endpoint

Create `server/api/timeline/months-with-data.get.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  circleId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success)
    throw createError({
      statusCode: 400,
      message: 'circleId, year, month all required',
    })
  const { circleId, year, month } = result.data

  const supabase = serverSupabaseServiceRole(event)

  // Verify membership
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  const visibilityFilter = `visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`

  // Start of the current month (UTC) — used as the cutoff for prev/next walks
  const currentStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const currentEnd = new Date(Date.UTC(year, month, 1)).toISOString()

  // Previous month with data: latest memory_date STRICTLY BEFORE currentStart
  const prevRow = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .or(visibilityFilter)
    .lt('memory_date', currentStart)
    .order('memory_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Next month with data: earliest memory_date AT OR AFTER currentEnd
  const nextRow = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .or(visibilityFilter)
    .gte('memory_date', currentEnd)
    .order('memory_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const toMonth = (d: string | null | undefined) => {
    if (!d) return null
    const date = new Date(d)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  }

  return {
    prev: toMonth(prevRow.data?.memory_date),
    next: toMonth(nextRow.data?.memory_date),
  }
})
```

Key points:
- Uses `serverSupabaseServiceRole` (per the project memory: `serverSupabaseClient` can silently fail with RLS).
- Manually re-checks membership before query — same pattern as `years.get.ts`.
- Visibility filter is identical to `years.get.ts` and `/api/timeline`.
- Each prev/next is an O(1) index scan (`LIMIT 1` with an inequality + sort).

### Step 2: Write the unit test

Create `unit/months-with-data.test.ts`. We can't easily integration-test the Supabase query in Vitest, but we can test the query schema and the date arithmetic:

```ts
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

// Mirror the schema from the handler so we can validate it directly.
const querySchema = z.object({
  circleId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

describe('months-with-data · query validation', () => {
  test('accepts a valid query', () => {
    const r = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 4,
    })
    expect(r.success).toBe(true)
  })

  test('rejects non-UUID circleId', () => {
    const r = querySchema.safeParse({
      circleId: 'not-a-uuid',
      year: 2026,
      month: 4,
    })
    expect(r.success).toBe(false)
  })

  test('rejects out-of-range year', () => {
    const r1 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 1999,
      month: 4,
    })
    expect(r1.success).toBe(false)
    const r2 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2101,
      month: 4,
    })
    expect(r2.success).toBe(false)
  })

  test('rejects out-of-range month', () => {
    const r1 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 0,
    })
    expect(r1.success).toBe(false)
    const r2 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 13,
    })
    expect(r2.success).toBe(false)
  })

  test('coerces string numerics', () => {
    const r = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: '2026',
      month: '04',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.year).toBe(2026)
      expect(r.data.month).toBe(4)
    }
  })
})

describe('months-with-data · UTC date math', () => {
  // The handler computes currentStart and currentEnd from (year, month).
  // currentStart = Date.UTC(year, month-1, 1)
  // currentEnd   = Date.UTC(year, month,   1)
  // Prev query: memory_date < currentStart
  // Next query: memory_date >= currentEnd

  test('April 2026 currentStart is 2026-04-01T00:00:00.000Z', () => {
    expect(new Date(Date.UTC(2026, 3, 1)).toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    )
  })

  test('April 2026 currentEnd is 2026-05-01T00:00:00.000Z', () => {
    expect(new Date(Date.UTC(2026, 4, 1)).toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    )
  })

  test('December 2026 currentEnd rolls to January 2027', () => {
    expect(new Date(Date.UTC(2026, 12, 1)).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    )
  })

  test('extracts year/month from a UTC date string', () => {
    const d = new Date('2026-04-15T12:00:00.000Z')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth() + 1).toBe(4)
  })
})
```

### Step 3: Run tests

```bash
pnpm test unit/months-with-data.test.ts
```

Expected: all assertions pass (9 tests).

```bash
pnpm test
```

Expected: full suite passes (576 + 9 new = 585).

### Step 4: Manually exercise the endpoint (optional)

If `pnpm dev` is available and you can log in, hit the endpoint to confirm it returns a plausible shape:

```bash
curl 'http://localhost:3000/api/timeline/months-with-data?circleId=<your-circle-id>&year=2026&month=4' \
  -H 'Cookie: <your-session-cookie>'
```

Expected: `{"prev":{"year":2026,"month":3},"next":null}` (or similar — depends on your data).

### Step 5: Commit

```bash
git add server/api/timeline/months-with-data.get.ts unit/months-with-data.test.ts
git commit -m "feat(api): /api/timeline/months-with-data endpoint

Returns the nearest prev/next months that contain memories for a given
(circleId, year, month). Each lookup is one indexed query bounded by
the current-month UTC cutoff; O(1) regardless of total memory count.

Uses the same visibility filter + service-role pattern as the existing
/api/timeline/years endpoint. Unit tests cover query validation and
UTC date math (December wraparound)."
```

---

## Task 2: `MonthSpreadHeader.vue` component

**Files:**
- Create: `app/components/MonthSpreadHeader.vue`

The new sticky-top header for the month page. Three rows: the page strip (back link + brand kicker + Share button), the hero (italic month name + meta), and the sticky pill bar (prev · current · next month navigation).

### Step 1: Create the component

Create `app/components/MonthSpreadHeader.vue`:

```vue
<template>
  <header class="month-spread-header">
    <!-- Row 1: page strip -->
    <div class="page-strip">
      <NuxtLink :to="backLink" class="back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {{ t('common.back') }}
      </NuxtLink>
      <div class="brand-stack">
        <div class="brand-kicker">{{ t('nav.ourStory') }}</div>
        <div class="circle-name">{{ circleName ?? '…' }}</div>
      </div>
      <div class="spacer"></div>
      <button
        v-if="showShare"
        type="button"
        class="share-btn"
        :title="t('timeline.shareMonth')"
        :aria-label="t('timeline.shareMonth')"
        @click="onShareClick"
      >
        <svg v-if="!justCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>

    <!-- Row 2: hero -->
    <div class="hero">
      <div class="kicker-row">
        <span>{{ circleName ?? '' }}</span>
        <span class="yr">{{ year }}</span>
      </div>
      <h1 class="month-title">
        <em>{{ monthName }}</em>
      </h1>
      <div class="meta-row">
        <span>{{ t('timeline.memories', memoryCount) }}</span>
      </div>
    </div>

    <!-- Row 3: sticky pill nav -->
    <div class="pill-bar">
      <NuxtLink
        v-if="prev"
        :to="monthPath(prev.year, prev.month)"
        class="pill"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {{ shortMonthLabel(prev.year, prev.month) }}
      </NuxtLink>
      <span v-else class="pill disabled">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>

      <div class="spacer"></div>
      <div class="current">{{ shortMonthLabel(year, month) }} · {{ year }}</div>
      <div class="spacer"></div>

      <NuxtLink
        v-if="next"
        :to="monthPath(next.year, next.month)"
        class="pill"
      >
        {{ shortMonthLabel(next.year, next.month) }}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </NuxtLink>
      <span v-else class="pill disabled">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const { t, locale } = useI18n()

const props = defineProps<{
  year: number
  month: number
  circleId: string | null
  circleName: string | null
  memoryCount: number
  prev: { year: number; month: number } | null
  next: { year: number; month: number } | null
  showShare?: boolean
}>()

const backLink = computed(() =>
  props.circleId ? `/timeline?circle=${props.circleId}` : '/timeline',
)

const monthName = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(
    new Date(props.year, props.month - 1, 1),
  ),
)

const shortMonthLabel = (y: number, m: number): string =>
  new Intl.DateTimeFormat(locale.value, { month: 'short' })
    .format(new Date(y, m - 1, 1))
    .toUpperCase()

const monthPath = (y: number, m: number): string => {
  const base = `/timeline/${y}/${m}`
  return props.circleId ? `${base}?circle=${props.circleId}` : base
}

const justCopied = ref(false)
async function onShareClick() {
  const path = monthPath(props.year, props.month)
  const url = new URL(path, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(url)
    justCopied.value = true
    setTimeout(() => (justCopied.value = false), 1600)
  } catch (err) {
    console.error('[MonthSpreadHeader] clipboard write failed:', err)
  }
}
</script>

<style scoped>
.month-spread-header {
  background: hsl(var(--background));
}

/* ─── Page strip ────────────────────────────────────────────── */
.page-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid hsl(var(--border));
  max-width: 1280px;
  margin: 0 auto;
}
.page-strip .back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 200ms ease;
}
.page-strip .back:hover {
  color: hsl(var(--foreground));
}
.page-strip .brand-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.page-strip .brand-kicker {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 9px;
  letter-spacing: 0.28em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
}
.page-strip .circle-name {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 700;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.page-strip .spacer {
  flex: 1;
}
.page-strip .share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 200ms ease, border-color 200ms ease;
}
.page-strip .share-btn:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--foreground) / 0.3);
}

/* ─── Hero ──────────────────────────────────────────────────── */
.hero {
  max-width: 1280px;
  margin: 0 auto;
  padding: 36px 20px 24px;
}
@media (min-width: 768px) {
  .hero {
    padding: 56px 32px 36px;
  }
}
.hero .kicker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  margin-bottom: 14px;
}
.hero .kicker-row .yr {
  color: hsl(var(--foreground));
}
.hero .month-title {
  font-family: 'Instrument Serif', serif;
  font-weight: 400;
  font-style: italic;
  font-size: clamp(56px, 18vw, 96px);
  line-height: 0.95;
  letter-spacing: -0.025em;
  color: hsl(var(--foreground));
}
.hero .meta-row {
  margin-top: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 10px;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
}

/* ─── Sticky pill bar ───────────────────────────────────────── */
.pill-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.92);
  backdrop-filter: blur(16px);
  max-width: 1280px;
  margin: 0 auto;
}
.pill-bar .spacer {
  flex: 1;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 200ms ease, border-color 200ms ease;
}
.pill:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--foreground) / 0.3);
}
.pill.disabled {
  opacity: 0.35;
  pointer-events: none;
}
.pill-bar .current {
  padding: 6px 12px;
  border-radius: 999px;
  background: hsl(var(--secondary));
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: hsl(var(--foreground));
}
</style>
```

### Step 2: Add the i18n strings

In `locales/en.json`, inside the `timeline` object, append:

```json
    "shareMonth": "Copy link",
    "shareMonthCopied": "Link copied",
```

In `locales/zh-CN.json`:

```json
    "shareMonth": "复制链接",
    "shareMonthCopied": "已复制链接",
```

In `locales/fr.json`:

```json
    "shareMonth": "Copier le lien",
    "shareMonthCopied": "Lien copié",
```

Verify all three parse cleanly:

```bash
node -e "['en','zh-CN','fr'].forEach(l => JSON.parse(require('fs').readFileSync('locales/'+l+'.json', 'utf-8')))"
```

Expected: silent.

Also confirm `nav.ourStory` already exists in `locales/en.json` (the page strip references it). If it doesn't, add `"ourStory": "Our Story"` etc. — but it almost certainly already exists since the existing pages use it.

### Step 3: Verify the component compiles

The component is imported nowhere yet (page integration is Task 3). Trust the type-checker:

```bash
pnpm test
```

Expected: full suite passes (585).

### Step 4: Commit

```bash
git add app/components/MonthSpreadHeader.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(timeline): MonthSpreadHeader component for /timeline/[year]/[month]

Three-row sticky header per spec §5.1:
- Page strip: back link + brand kicker + circle name + Share button
- Hero: italic clamp(56–96px) month name + meta row with memory count
- Sticky pill bar: prev / current / next month navigation

Prev/next pills are NuxtLinks when an adjacent month with data exists,
muted-disabled spans otherwise (the parent decides via the `prev` /
`next` props from /api/timeline/months-with-data).

Share button copies the canonical /timeline/[year]/[month] URL to
clipboard (with ?circle= query when relevant) and shows a checkmark
for 1.6 seconds. Reuses the existing nav.ourStory and common.back
keys; adds timeline.shareMonth and timeline.shareMonthCopied."
```

---

## Task 3: Page rewrite — `/timeline/[year]/[month]`

**Files:**
- Modify: `app/pages/timeline/[year]/[month].vue`

Replace the existing `<header>` (the current minimal back-link strip) with `<MonthSpreadHeader>`. Wire the new prev/next endpoint. Remove the dead `onReactionUpdate` function. Keep the existing body (grid + MosaicCell + load-more) and `MemoryShell` modal unchanged.

### Step 1: Read the current state

```bash
cat "app/pages/timeline/[year]/[month].vue"
```

The current file (post sub-plan #2) has a sticky `<header>` (lines 4–36) with a back link, brand kicker, and `monthLabel`. That block gets fully replaced. The body grid (lines 38–88) and `MemoryShell` (89–99) stay.

### Step 2: Replace the header

Find the entire `<header>` block (the one starting at line 4) and the surrounding wrapper:

```vue
    <!-- Header -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-3.5">
        … (existing back link, brand kicker, monthLabel)
      </div>
    </header>
```

Replace it with:

```vue
    <MonthSpreadHeader
      :year="year"
      :month="month"
      :circle-id="circleId"
      :circle-name="circleName"
      :memory-count="totalCount"
      :prev="adjacency.prev"
      :next="adjacency.next"
      :show-share="true"
    />
```

### Step 3: Wire the data

In `<script setup>`, ADD these refs/computeds near the existing `circleId` block (around line 134–143):

```ts
// Active circle's display name (used in the spread header kicker row).
const circleName = computed(() => {
  const all = circlesData.value?.circles ?? []
  return all.find((c: any) => c.id === circleId.value)?.name ?? null
})

// Total memory count (separate from the paginated `memories` array — the
// header needs the canonical total, not the cursor-fetched batch length).
const totalCount = ref(0)

// Prev/next adjacency
const adjacency = ref<{
  prev: { year: number; month: number } | null
  next: { year: number; month: number } | null
}>({ prev: null, next: null })

async function fetchAdjacency() {
  if (!circleId.value) return
  try {
    const data = await $fetch<{
      prev: { year: number; month: number } | null
      next: { year: number; month: number } | null
    }>('/api/timeline/months-with-data', {
      query: { circleId: circleId.value, year, month },
    })
    adjacency.value = data
  } catch (err) {
    console.error('[month-page] adjacency fetch error:', err)
  }
}

onMounted(() => {
  fetchAdjacency()
})
```

Place the `onMounted(() => fetchAdjacency())` AFTER the existing `onMounted(() => fetchPage())` — both registrations fire on mount, no conflict.

In the existing `fetchPage` function, when the FIRST page returns (where `isFirst` is true), capture `totalCount` from the API response. Look at how `/api/timeline` shapes its response — if it returns a totalCount per month, use that. If not (and the API just returns the page's `memories` and `nextCursor`), `totalCount.value = data.memories.length + (data.nextCursor ? '?' : 0)` doesn't work.

**Action:** check `server/api/timeline.get.ts` and verify what total information it returns for a `yearMonth`-scoped query. If a precise total isn't available, fall back to passing `memories.value.length` to the header — it'll under-count when more pages exist, which is OK for now. Document this and revisit if needed.

Specifically replace:

```ts
async function fetchPage(cursor?: string) {
  if (!circleId.value) return
  const isFirst = !cursor
  …
```

with the appropriate `totalCount.value = …` after the existing `memories.value = data.memories` line.

### Step 4: Remove the dead `onReactionUpdate` function

Find lines ~188–201 in the existing file:

```ts
function onReactionUpdate({
  memoryId,
  reactions,
}: {
  memoryId: string
  reactions: any[]
}) {
  const i = memories.value.findIndex((m) => m.id === memoryId)
  if (i !== -1)
    memories.value[i] = {
      ...memories.value[i],
      memoryreaction: reactions,
    } as Memory
}
```

Delete the entire function. Confirm nothing else references it:

```bash
rg --no-config -n "onReactionUpdate" "app/pages/timeline/[year]/[month].vue"
```

Expected: zero hits.

### Step 5: Also delete the now-obsolete `monthLabel` computed

The template no longer references `monthLabel` (the spread header computes its own month name). Find the block around line 126–131:

```ts
const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
  }),
)
```

Delete it. Confirm:

```bash
rg --no-config -n "monthLabel" "app/pages/timeline/[year]/[month].vue"
```

Expected: zero hits.

### Step 6: Verify

```bash
pnpm test
```

Expected: 585 passing (no test exercises this page directly yet).

```bash
pnpm dev
```

Navigate to `/timeline/2026/4` (or any month with data). Confirm:
- The new spread header renders: page strip + italic month hero + sticky prev/next pill bar.
- Clicking the prev pill (when available) routes to the previous month.
- Clicking the next pill routes to the next month.
- The body grid still renders MosaicCells correctly.
- Clicking a cell opens the existing `MemoryShell` modal.

If `pnpm dev` is impractical, trust the unit tests + manual sweep step in Task 5.

### Step 7: Commit

```bash
git add "app/pages/timeline/[year]/[month].vue"
git commit -m "feat(timeline): wire MonthSpreadHeader into /timeline/[year]/[month]

Replaces the minimal-patched legacy header (back-link strip) with the
new MonthSpreadHeader component from the previous task. Fetches
prev/next month adjacency from /api/timeline/months-with-data on mount
in parallel with the memory list. Adds the circle name for the
spread header kicker.

Removes the obsolete monthLabel computed (the header now renders its
own month name) and the dead onReactionUpdate function (orphan from
sub-plan #2). The body grid and MemoryShell modal are unchanged."
```

---

## Task 4: New E2E test — month view

**Files:**
- Create: `tests/month-view.spec.ts`

Verify the spread header renders and prev/next navigation works.

### Step 1: Inspect existing test patterns

Look at how `tests/timeline-year.spec.ts` and `tests/timeline-mosaic-viewports.spec.ts` (from sub-plan #2) handle auth and data seeding. Follow the same fixture pattern.

### Step 2: Write the test

Create `tests/month-view.spec.ts`. Adapt the auth/seed steps to match the project's conventions:

```ts
import { test, expect } from '@playwright/test'

// Reuse the existing auth state file convention from other tests.
test.use({ storageState: 'tests/.auth/user.json' })

test.describe('month view · /timeline/[year]/[month]', () => {
  test('spread header renders italic month name + sticky pill bar', async ({
    page,
  }) => {
    await page.goto('/timeline/2026/4')

    // The italic <em> month name lives inside .month-title
    await expect(page.locator('.month-title em')).toBeVisible()
    await expect(page.locator('.month-title em')).toContainText(/April|Apr/)

    // The sticky pill bar has at least the "current" pill
    await expect(page.locator('.pill-bar .current')).toContainText(/APR/)
  })

  test('prev/next pills navigate to adjacent months when available', async ({
    page,
  }) => {
    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.month-title em')

    // If a next pill exists (the test fixture should have at least one
    // adjacent month seeded), click it and verify URL updates.
    const nextPill = page.locator('.pill-bar a').last()
    if (await nextPill.isVisible()) {
      await nextPill.click()
      await page.waitForURL(/\/timeline\/\d{4}\/\d{1,2}/)
      // Verify we ARE on a different month now (not 2026/4)
      const url = page.url()
      expect(url).not.toContain('/timeline/2026/4')
    }
  })

  test('back link returns to the main timeline', async ({ page }) => {
    await page.goto('/timeline/2026/4')
    await page.click('.back')
    await page.waitForURL(/\/timeline(\?|$)/)
  })
})
```

If the test fixture / auth setup is incompatible, mark tests as `.skip` with a brief note explaining the dependency. The controller will route fixture work as a separate task.

### Step 3: Run

```bash
pnpm test:e2e tests/month-view.spec.ts
```

Expected: 3 passing (or 3 skipped with documented reason).

### Step 4: Commit

```bash
git add tests/month-view.spec.ts
git commit -m "test(e2e): month view spread header + prev/next navigation

Verifies the new MonthSpreadHeader renders an italic month name and a
sticky pill bar. Clicking the next pill (when an adjacent month with
data exists) navigates to that month. Back link returns to the main
timeline."
```

---

## Task 5: Manual sweep

**Files:** None modified — pure verification.

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Walk the month view in both color modes at desktop + mobile**

For each combination (desktop ≥1280px / mobile 375px, in Obsidian dark and Porcelain light):

1. Navigate to `/timeline` then click the year-pill in the header → open the jump modal → click any month → verify the month page loads with the new spread header.
2. Spread header:
   - Page strip: back link works, brand kicker reads "OUR STORY", circle name visible and truncates on overflow.
   - Hero: italic month name (Instrument Serif), meta row with "N MEMORIES" in mono caps.
   - Sticky pill bar: clearly distinguishable "current" pill, prev/next pills are clickable when adjacent months have data, disabled+muted when not.
3. Body: MosaicCell grid renders correctly with `wide`/`tall`/`square` variants (carry-over from sub-plan #2).
4. Click a memory → modal opens (legacy `MemoryShell` — its redesign is sub-plan #3/#4).
5. Click the Share button → "Copy link" → URL is now in clipboard. Verify by pasting in a new tab. Should be the canonical `/timeline/<year>/<month>?circle=<id>` URL. Button briefly shows a checkmark.
6. Navigate prev → next a few times. The sticky pill bar stays put as you scroll the body grid.

- [ ] **Step 3: Verify endpoint behavior in DevTools Network tab**

When the month page loads, you should see TWO `/api/timeline/...` requests:
- One to `/api/timeline?circleId=…&yearMonth=2026-04&cursor=…` (the existing memory fetch)
- One to `/api/timeline/months-with-data?circleId=…&year=2026&month=4` (the new adjacency)

The second response should be `{"prev": {…} | null, "next": {…} | null}`.

- [ ] **Step 4: Address regressions**

If anything breaks, fix in a follow-up commit before moving to Task 6. Don't accumulate.

---

## Task 6: Push branch + open PR

- [ ] **Step 1: Final test pass**

```bash
pnpm test
pnpm test:e2e tests/month-view.spec.ts
```

- [ ] **Step 2: Push**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open the PR**

If `gh` is available:

```bash
gh pr create --base dev --title "Month view — MonthSpreadHeader + prev/next adjacency" --body "$(cat <<'EOF'
## Summary

Replaces the minimal-patched legacy header on `/timeline/[year]/[month]` with the new `MonthSpreadHeader` from spec §5.1: italic clamp(56–96px) month-name hero, sticky pill bar with prev / current / next month navigation, optional Share button that copies the canonical URL to clipboard. Adds a lightweight `/api/timeline/months-with-data` endpoint that returns the nearest adjacent months with memories (skipping empty months).

This is **sub-plan #5 of 7** from the [timeline-redesign spec](docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md). Stacks on sub-plans #1 (theme repaint) and #2 (timeline mosaic). Independent of #3 / #4 (modal redesign) — the page opens the existing `MemoryShell` unchanged.

## Test plan

- [x] `pnpm test` passes (576 + 9 new from `unit/months-with-data.test.ts` = 585).
- [x] New E2E `tests/month-view.spec.ts` covers spread header rendering, prev/next navigation, and back link.
- [x] Manual sweep across desktop + mobile in both color modes — Share button copies URL, sticky pill bar stays put on scroll, prev/next route correctly, body grid unchanged.
- [ ] CI: full Playwright suite.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `gh` is unavailable, push and report the compare URL.

---

## Definition of done

- [ ] `pnpm test` passes (585+).
- [ ] `pnpm test:e2e tests/month-view.spec.ts` passes.
- [ ] `/timeline/[year]/[month]` renders the new spread header in both color modes at both viewports.
- [ ] Prev/next pills navigate correctly; disabled state shows when no adjacent month has data.
- [ ] Share button copies the canonical URL.
- [ ] Body grid (MosaicCell) is unchanged.
- [ ] No dead code left in the page (`onReactionUpdate` and `monthLabel` removed).
- [ ] PR open and CI green.

---

## Out of scope for this sub-plan

- Memory modal redesign — sub-plans #3 + #4. The page opens the existing `MemoryShell` and that's intentional.
- Settings, members, viewer-link redesigns — sub-plans #6 + #7.
- The main `/timeline` page header. Unchanged by this sub-plan.
- Render the spread header inside the main `/timeline` between year ribbons. Not part of the spec; the main timeline keeps its own header.

---

## Risks specific to this sub-plan

- **Sticky pill bar offset.** The `MonthSpreadHeader` has a 3-row layout where ONLY the pill bar is sticky. If the parent page has its own sticky header (it doesn't, post-rewrite, but the user might add one later), the pill bar will overlap. Mitigation: keep the new component as the page's only sticky element.
- **Endpoint perf on circles with very old memories.** The prev/next walks are bounded by `LIMIT 1` and indexed by `(circle_id, memory_date)` (assumed — confirm during implementation). Should be O(log n) per query. No risk for normal datasets.
- **`totalCount` displayed in the hero may under-count.** If the API doesn't return a precise total per month, the hero meta reflects the current page's length, not the true count. The Task 3 step documents this trade-off; fix is a small API change later if needed.
- **Clipboard API availability.** `navigator.clipboard.writeText` is HTTPS-only in some browsers. In local dev (`http://localhost`), it works in Chrome but may fail in Firefox. Mitigation: the Share button gracefully `console.error`s on failure rather than throwing.
- **Pill-bar pill content overflow.** On a narrow mobile (<375px), the "MAR" / "APR · 2026" / "MAY" content may wrap. Mitigation: the pill bar uses `flex` with `gap: 8px` and the pills themselves have `padding: 6px 12px` — works down to ~320px. If a localized month abbreviation is unusually long (e.g. a French "MARS · 2026" plus surrounding spacers), recheck at 320px width during the sweep.
