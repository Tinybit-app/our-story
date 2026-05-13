# Polaroid Wall Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current masonry grid timeline with a Polaroid Wall layout — monthly sections of tilted polaroid cards, a year badge in the sticky header (updates on scroll), a year×month jump modal, and a month overflow page for months with >12 memories.

**Architecture:** `useTimeline.ts` composable groups the flat `Memory[]` into `MonthGroup[]` (12-item cap per month, `hasMore` flag) and `YearInfo[]` for the jump modal. `TimelinePolaroid.vue` is a presentational component that receives grouped data as props, sets up an `IntersectionObserver` on year-anchor elements, and emits `yearChange` to update the header badge in `index.vue`. The month overflow page at `/timeline/[year]/[month]` reuses the existing timeline API with a new `yearMonth` filter parameter.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Tailwind CSS, Vitest, Caveat font (Google Fonts), IntersectionObserver API

---

## File Structure

| Action | Path                                         | Responsibility                                                                                             |
| ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Create | `supabase/migrations/005_timeline_style.sql` | Adds `timeline_style` column to Circle — stub for future multi-style picker                                |
| Create | `app/composables/useTimeline.ts`             | Groups `Memory[]` → `MonthGroup[]` + `YearInfo[]`; pure reactive transform, no fetching                    |
| Create | `app/components/PolaroidCard.vue`            | Single polaroid card — photo, note, and milestone variants                                                 |
| Create | `app/components/TimelinePolaroid.vue`        | Polaroid wall: year sections, month headers, card grid, overflow links, IntersectionObserver year tracking |
| Modify | `app/pages/index.vue`                        | Add year badge to header, add jump modal, swap masonry grid for `<TimelinePolaroid>`                       |
| Modify | `server/api/timeline.get.ts`                 | Add `yearMonth` filter param for the month overflow page                                                   |
| Create | `app/pages/timeline/[year]/[month].vue`      | Month overflow page — all memories for one month, no cap                                                   |
| Modify | `app/assets/css/globals.css`                 | Add Caveat font import                                                                                     |
| Modify | `unit/api-validation.test.ts`                | Add test for `yearMonth` param validation                                                                  |

---

## Shared Types

Defined in `app/composables/useTimeline.ts` and imported by components.

```ts
export interface MediaItem {
  id: string
  media_type: string
  url: string | null
  thumbnailUrl: string | null
  file_size: number
}

export interface Memory {
  id: string
  owner_user_id: string
  visibility: 'private' | 'circle'
  note: string | null
  memory_date: string // ISO datetime string — sort key
  milestone_label: string | null
  milestone_is_custom: boolean
  created_at: string
  memorymedia: MediaItem[]
  user: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  memoryreaction: { id: string; emoji: string; user_id: string }[]
  memorycomment: { id: string }[]
}

export interface MonthGroup {
  year: number
  month: number // 1–12
  label: string // "March 2025" — formatted for display
  memories: Memory[] // max 12
  hasMore: boolean // true if ≥12 memories seen for this month
  anchorId: string // "anchor-2025" — shared by all months in the same year
}

export interface YearInfo {
  year: number
  months: number[] // sorted ascending list of months (1–12) that have ≥1 memory
}
```

---

## Task 1: DB migration — `timeline_style` on Circle

**Files:**

- Create: `supabase/migrations/005_timeline_style.sql`

This column stubs the future multi-style picker. Default is `'polaroid'` — all existing circles get it automatically. Only 'polaroid' is live in Phase 1; the other values are reserved for future releases. No API or UI needed yet — the column just needs to exist so Phase 2 can add a PATCH endpoint and settings UI without a schema change.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/005_timeline_style.sql
-- ============================================================
-- CIRCLE: add timeline_style for per-circle layout preference
-- Phase 1: only 'polaroid' is active. Other values are reserved
-- for future releases. Default ensures all existing circles
-- get the polaroid wall without an explicit migration step.
-- ============================================================
ALTER TABLE public.Circle
  ADD COLUMN IF NOT EXISTS timeline_style TEXT NOT NULL DEFAULT 'polaroid'
  CHECK (timeline_style IN ('polaroid', 'editorial', 'diary', 'rail', 'mosaic'));
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd /Users/dzheng/dev/tinybit/our-story
supabase db reset
```

Expected: migration runs without errors. `supabase status` shows local DB running.

- [ ] **Step 3: Verify the column exists**

```bash
supabase db diff --schema public
```

Expected: output shows `timeline_style` column on `circle` table.

- [ ] **Step 4: Run RLS tests to confirm nothing broke**

```bash
pnpm db:test
```

Expected: all pgTAP tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_timeline_style.sql
git commit -m "feat: add timeline_style to Circle for per-circle layout preference"
```

---

## Task 2: Add Caveat font

**Files:**

- Modify: `app/assets/css/globals.css`

Caveat is the handwritten font used for polaroid captions. Add it as a Google Fonts import so it loads before first render.

- [ ] **Step 1: Read the current globals.css to get exact content**

Read `app/assets/css/globals.css` — note the first line (the file may start with `@tailwind` directives).

- [ ] **Step 2: Add the font import at the very top of the file**

Prepend this line — it must be the first `@import` in the file:

```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap');
```

The rest of the file is unchanged.

- [ ] **Step 3: Verify font loads in dev**

```bash
pnpm dev
```

Open `localhost:3000` in a browser, open DevTools → Network → filter by "caveat". Expected: font files load from `fonts.gstatic.com`.

- [ ] **Step 4: Commit**

```bash
git add app/assets/css/globals.css
git commit -m "feat: add Caveat handwritten font for polaroid timeline captions"
```

---

## Task 3: `useTimeline` composable

**Files:**

- Create: `app/composables/useTimeline.ts`
- Test: `unit/useTimeline.test.ts`

This composable is a pure reactive transformation. It takes a `Ref<Memory[]>` (the flat array accumulated from paginated API calls) and returns two derived `ComputedRef` values: `monthGroups` (the grouped + capped data the wall renders) and `yearInfos` (the year × month inventory for the jump modal).

The 12-item cap works like this: as memories accumulate across paginated fetches, `total` for each month-key increments. The first 12 go into `memories[]`; additional ones still increment `total` (so `hasMore` becomes true) but are not kept in memory.

- [ ] **Step 1: Write the failing tests**

Create `unit/useTimeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTimeline } from '~/composables/useTimeline'
import type { Memory } from '~/composables/useTimeline'

function makeMemory(
  id: string,
  dateStr: string,
  overrides: Partial<Memory> = {},
): Memory {
  return {
    id,
    owner_user_id: 'user-1',
    visibility: 'circle',
    note: null,
    memory_date: dateStr,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: dateStr,
    memorymedia: [],
    user: { first_name: 'Test', last_name: 'User', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    ...overrides,
  }
}

describe('useTimeline', () => {
  it('groups memories into month groups sorted newest first', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-15T10:00:00Z'),
      makeMemory('2', '2025-03-10T10:00:00Z'),
      makeMemory('3', '2025-01-05T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value).toHaveLength(2)
    expect(monthGroups.value[0].year).toBe(2025)
    expect(monthGroups.value[0].month).toBe(3)
    expect(monthGroups.value[0].memories).toHaveLength(2)
    expect(monthGroups.value[1].month).toBe(1)
  })

  it('caps each month at 12 memories and sets hasMore = true when exceeded', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 15 }, (_, i) =>
        makeMemory(
          `id-${i}`,
          `2025-06-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        ),
      ),
    )
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value).toHaveLength(1)
    expect(monthGroups.value[0].memories).toHaveLength(12)
    expect(monthGroups.value[0].hasMore).toBe(true)
  })

  it('sets hasMore = false when month has fewer than 12 memories', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-04-01T10:00:00Z'),
      makeMemory('2', '2025-04-02T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].hasMore).toBe(false)
  })

  it('updates reactively when memories are appended', () => {
    const memories = ref<Memory[]>([makeMemory('1', '2025-03-01T10:00:00Z')])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].memories).toHaveLength(1)

    memories.value = [
      ...memories.value,
      makeMemory('2', '2025-03-15T10:00:00Z'),
    ]
    expect(monthGroups.value[0].memories).toHaveLength(2)
  })

  it('includes correct months in yearInfos', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-01T10:00:00Z'),
      makeMemory('2', '2025-01-01T10:00:00Z'),
      makeMemory('3', '2024-12-01T10:00:00Z'),
    ])
    const { yearInfos } = useTimeline(memories)
    expect(yearInfos.value).toHaveLength(2)
    expect(yearInfos.value[0].year).toBe(2025)
    expect(yearInfos.value[0].months).toEqual([1, 3])
    expect(yearInfos.value[1].year).toBe(2024)
    expect(yearInfos.value[1].months).toEqual([12])
  })

  it('month label is formatted correctly', () => {
    const memories = ref<Memory[]>([makeMemory('1', '2025-03-15T10:00:00Z')])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].label).toBe('March 2025')
  })

  it('anchorId is shared across months in the same year', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-01T10:00:00Z'),
      makeMemory('2', '2025-01-01T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].anchorId).toBe('anchor-2025')
    expect(monthGroups.value[1].anchorId).toBe('anchor-2025')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test unit/useTimeline.test.ts
```

Expected: FAIL — "Cannot find module '~/composables/useTimeline'"

- [ ] **Step 3: Implement `useTimeline.ts`**

Create `app/composables/useTimeline.ts`:

```ts
import { computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface MediaItem {
  id: string
  media_type: string
  url: string | null
  thumbnailUrl: string | null
  file_size: number
}

export interface Memory {
  id: string
  owner_user_id: string
  visibility: 'private' | 'circle'
  note: string | null
  memory_date: string
  milestone_label: string | null
  milestone_is_custom: boolean
  created_at: string
  memorymedia: MediaItem[]
  user: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  memoryreaction: { id: string; emoji: string; user_id: string }[]
  memorycomment: { id: string }[]
}

export interface MonthGroup {
  year: number
  month: number
  label: string
  memories: Memory[]
  hasMore: boolean
  anchorId: string
}

export interface YearInfo {
  year: number
  months: number[]
}

const MONTH_CAP = 12

export function useTimeline(memoriesRef: Ref<Memory[]>): {
  monthGroups: ComputedRef<MonthGroup[]>
  yearInfos: ComputedRef<YearInfo[]>
} {
  const monthGroups = computed<MonthGroup[]>(() => {
    const map = new Map<
      string,
      { year: number; month: number; memories: Memory[]; total: number }
    >()

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
      if (group.memories.length < MONTH_CAP) {
        group.memories.push(memory)
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, { year, month, memories, total }]) => ({
        year,
        month,
        label: new Date(year, month - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        memories,
        hasMore: total >= MONTH_CAP,
        anchorId: `anchor-${year}`,
      }))
  })

  const yearInfos = computed<YearInfo[]>(() => {
    const map = new Map<number, Set<number>>()
    for (const group of monthGroups.value) {
      if (!map.has(group.year)) map.set(group.year, new Set())
      map.get(group.year)!.add(group.month)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, monthSet]) => ({
        year,
        months: Array.from(monthSet).sort((a, b) => a - b),
      }))
  })

  return { monthGroups, yearInfos }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test unit/useTimeline.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useTimeline.ts unit/useTimeline.test.ts
git commit -m "feat: add useTimeline composable with month grouping and 12-item cap"
```

---

## Task 4: `PolaroidCard` component

**Files:**

- Create: `app/components/PolaroidCard.vue`

Each card renders one of three variants:

- **Photo card**: has `memorymedia[0]` → show image in polaroid frame
- **Note card**: no media, has `note` → text fills the photo area with a lined-paper look
- **Milestone card**: has `milestone_label` → star badge, optional photo behind it

The tilt is deterministic based on `index` prop — no random, so SSR is safe and cards don't jump on hydration.

- [ ] **Step 1: Create `PolaroidCard.vue`**

```vue
<template>
  <article
    class="relative w-44 flex-shrink-0 cursor-pointer select-none rounded-sm bg-white p-2.5 pb-8 shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:bg-zinc-800"
    :style="{ transform: `rotate(${tilt}deg)`, zIndex: isHovered ? 10 : 1 }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Photo area -->
    <div
      class="aspect-[4/3] overflow-hidden rounded-[2px] bg-zinc-100 dark:bg-zinc-700"
    >
      <!-- Photo / video -->
      <img
        v-if="firstMedia?.thumbnailUrl || firstMedia?.url"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? 'Memory'"
        class="h-full w-full object-cover"
        loading="lazy"
      />

      <!-- Note-only: lined paper look -->
      <div
        v-else-if="memory.note"
        class="flex h-full w-full items-center justify-center bg-amber-50 p-3 dark:bg-zinc-700"
        style="background-image: repeating-linear-gradient(transparent, transparent 23px, #e5e0d8 24px);"
      >
        <p
          class="line-clamp-4 text-center font-['Caveat'] text-sm leading-6 text-zinc-700 dark:text-zinc-200"
        >
          {{ memory.note }}
        </p>
      </div>

      <!-- Placeholder -->
      <div v-else class="flex h-full w-full items-center justify-center">
        <svg
          class="h-8 w-8 text-zinc-300 dark:text-zinc-600"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    </div>

    <!-- Caption strip -->
    <div class="mt-2 min-h-[40px]">
      <!-- Milestone badge -->
      <p
        v-if="memory.milestone_label"
        class="mb-0.5 font-['Caveat'] text-[13px] font-semibold leading-tight text-amber-700 dark:text-amber-400"
      >
        ✦ {{ memory.milestone_label }}
      </p>

      <!-- Note caption (for photo cards — truncated) -->
      <p
        v-if="memory.note && firstMedia"
        class="line-clamp-2 font-['Caveat'] text-[13px] leading-tight text-zinc-600 dark:text-zinc-300"
      >
        {{ memory.note }}
      </p>
    </div>

    <!-- Author + date pin -->
    <div class="absolute bottom-2 left-2.5 right-2.5 flex items-center gap-1.5">
      <div
        class="h-4 w-4 flex-shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600"
      >
        <img
          v-if="memory.user?.avatar_url"
          :src="memory.user.avatar_url"
          class="h-full w-full object-cover"
        />
        <span
          v-else
          class="flex h-full w-full items-center justify-center text-[7px] font-bold text-zinc-500"
          >{{ initials }}</span
        >
      </div>
      <span
        class="truncate font-['Caveat'] text-[10px] text-zinc-400 dark:text-zinc-500"
        >{{ formattedDate }}</span
      >
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const props = defineProps<{
  memory: Memory
  index: number
}>()

// Deterministic tilts — 12-element cycle, no randomness, SSR-safe
const TILTS = [-2.5, 1.2, -0.8, 2.1, -1.6, 0.4, -2.0, 1.8, -0.5, 2.4, -1.2, 0.9]
const tilt = computed(() => TILTS[props.index % TILTS.length])

const isHovered = ref(false)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

const initials = computed(() => {
  const u = props.memory.user
  if (!u) return '?'
  return (
    [u.first_name?.[0], u.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?'
  )
})

const formattedDate = computed(() => {
  const d = new Date(props.memory.memory_date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>
```

- [ ] **Step 2: Verify it renders in dev**

```bash
pnpm dev
```

In `index.vue`, temporarily replace one `<MemoryCard>` with `<PolaroidCard :memory="memory" :index="0" />` to visually verify the card renders. Undo this after checking — the full swap happens in Task 6.

- [ ] **Step 3: Commit**

```bash
git add app/components/PolaroidCard.vue
git commit -m "feat: add PolaroidCard component with photo/note/milestone variants"
```

---

## Task 5: `TimelinePolaroid` component

**Files:**

- Create: `app/components/TimelinePolaroid.vue`

This component:

- Receives `monthGroups` and `yearInfos` as props
- Renders year sections (each with a `data-year` attribute for the IntersectionObserver)
- Within each year, renders month subsections with the polaroid card grid
- Shows an "See more in [Month]" overflow link when `hasMore` is true
- Sets up an IntersectionObserver to emit `yearChange` as the user scrolls past year boundaries
- Exposes a `scrollToYear(year)` method for the jump modal

- [ ] **Step 1: Create `TimelinePolaroid.vue`**

```vue
<template>
  <div>
    <!-- Empty state -->
    <div
      v-if="monthGroups.length === 0 && !loading"
      class="flex flex-col items-center justify-center py-32 text-center"
    >
      <div
        class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary"
      >
        <svg
          class="h-7 w-7 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
          />
          <circle cx="12" cy="13" r="3" />
        </svg>
      </div>
      <p class="mb-2 text-base font-semibold text-foreground">
        Your story starts here
      </p>
      <p class="max-w-xs text-sm leading-relaxed text-muted-foreground">
        Add your first photo or video to start building your shared timeline.
      </p>
    </div>

    <!-- Loading skeleton (first load) -->
    <div
      v-else-if="loading && monthGroups.length === 0"
      class="flex justify-center py-32"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <p class="text-xs text-muted-foreground">Loading memories…</p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-else>
      <template v-for="yearSection in yearSections" :key="yearSection.year">
        <!-- Year anchor — IntersectionObserver target -->
        <div
          :id="`anchor-${yearSection.year}`"
          :data-year="yearSection.year"
          class="relative mb-8 mt-2 flex items-center gap-4"
        >
          <!-- Year rule line -->
          <div class="h-px flex-1 bg-border" />
          <span
            class="select-none px-2 font-['Caveat'] text-3xl font-semibold text-muted-foreground/60"
          >
            {{ yearSection.year }}
          </span>
          <div class="h-px flex-1 bg-border" />
        </div>

        <!-- Month sections within this year -->
        <div
          v-for="group in yearSection.months"
          :key="group.label"
          class="mb-12"
        >
          <!-- Month header -->
          <div class="mb-4 flex items-baseline gap-3">
            <h2 class="font-['Caveat'] text-xl font-semibold text-foreground">
              {{ group.label }}
            </h2>
            <span class="text-xs text-muted-foreground"
              >{{ group.memories.length
              }}{{ group.hasMore ? '+' : '' }} memories</span
            >
          </div>

          <!-- Polaroid grid -->
          <div class="flex flex-wrap gap-5">
            <PolaroidCard
              v-for="(memory, i) in group.memories"
              :key="memory.id"
              :memory="memory"
              :index="i"
            />

            <!-- See more card -->
            <NuxtLink
              v-if="group.hasMore"
              :to="`/timeline/${group.year}/${group.month}`"
              class="flex aspect-[3/4] w-44 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-border px-3 text-center transition-colors hover:border-primary hover:bg-secondary"
            >
              <svg
                class="h-6 w-6 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span
                class="font-['Caveat'] text-sm leading-snug text-muted-foreground"
              >
                See all in<br />{{ group.label }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </template>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" class="mt-2 h-4" />

      <!-- Pagination loading -->
      <div
        v-if="loading && monthGroups.length > 0"
        class="flex justify-center py-6"
      >
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonthGroup, YearInfo } from '~/composables/useTimeline'

const props = defineProps<{
  monthGroups: MonthGroup[]
  yearInfos: YearInfo[]
  loading: boolean
  hasNextPage: boolean
}>()

const emit = defineEmits<{
  loadMore: []
  yearChange: [year: number]
}>()

// Group month groups by year for rendering
const yearSections = computed(() => {
  const map = new Map<number, MonthGroup[]>()
  for (const group of props.monthGroups) {
    if (!map.has(group.year)) map.set(group.year, [])
    map.get(group.year)!.push(group)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({ year, months }))
})

// Infinite scroll
const loadMoreEl = ref<HTMLElement>()
const { stop: stopLoadMore } = useIntersectionObserver(
  loadMoreEl,
  ([entry]) => {
    if (entry?.isIntersecting && props.hasNextPage && !props.loading) {
      emit('loadMore')
    }
  },
)

// Year badge tracking via IntersectionObserver
let yearObserver: IntersectionObserver | null = null

function setupYearObserver() {
  yearObserver?.disconnect()
  yearObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const year = Number((entry.target as HTMLElement).dataset.year)
          if (year) emit('yearChange', year)
        }
      }
    },
    { rootMargin: '-10% 0px -85% 0px', threshold: 0 },
  )
  document
    .querySelectorAll('[data-year]')
    .forEach((el) => yearObserver!.observe(el))
}

// Re-run observer when new year sections appear
watch(
  () => props.monthGroups.length,
  async () => {
    await nextTick()
    setupYearObserver()
  },
)

onMounted(async () => {
  await nextTick()
  setupYearObserver()
})

onUnmounted(() => {
  stopLoadMore()
  yearObserver?.disconnect()
})

// Exposed for jump modal
function scrollToYear(year: number) {
  const el = document.getElementById(`anchor-${year}`)
  if (!el) return
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - 120,
    behavior: 'smooth',
  })
}

defineExpose({ scrollToYear })
</script>
```

- [ ] **Step 2: Run dev server and check for compile errors**

```bash
pnpm dev
```

Expected: no TypeScript errors in console.

- [ ] **Step 3: Commit**

```bash
git add app/components/TimelinePolaroid.vue
git commit -m "feat: add TimelinePolaroid component with year sections, month groups, overflow links"
```

---

## Task 6: Update `index.vue` — swap grid, add year badge + jump modal

**Files:**

- Modify: `app/pages/index.vue`

Four changes in one task (they're tightly coupled — all touch the same file):

1. Replace masonry grid + loading/empty states with `<TimelinePolaroid>`
2. Add `currentYear` state and `yearInfos` state wired to TimelinePolaroid's emits
3. Add the year badge button to the sticky header
4. Add the year×month jump modal

- [ ] **Step 1: Read the current `app/pages/index.vue` in full**

Read `app/pages/index.vue` — confirm the exact existing structure before editing.

- [ ] **Step 2: Replace the script setup section**

Replace the entire `<script setup lang="ts">` block with:

```ts
const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const router = useRouter()

// ── User identity ──────────────────────────────────────────
const { data: profile } = await useFetch<{
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}>('/api/profile')

const userAvatarUrl = computed(() => profile.value?.avatarUrl ?? null)

const userDisplayName = computed(() => {
  const parts = [profile.value?.firstName, profile.value?.lastName].filter(
    Boolean,
  )
  return parts.length
    ? parts.join(' ')
    : (authUser.value?.email?.split('@')[0] ?? 'You')
})

const userInitials = computed(() => {
  const first = profile.value?.firstName?.[0] ?? ''
  const last = profile.value?.lastName?.[0] ?? ''
  return (
    (first + last).toUpperCase() ||
    userDisplayName.value.slice(0, 2).toUpperCase()
  )
})

// ── Dropdown ───────────────────────────────────────────────
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()
const uploadRef = ref<{ open: () => void; isOpen: ComputedRef<boolean> }>()
onClickOutside(menuRef, () => {
  menuOpen.value = false
})

// ── Theme ──────────────────────────────────────────────────
const colorMode = useColorMode()
const prefersDark = usePreferredDark()
const isDark = computed(() =>
  colorMode.preference === 'system'
    ? prefersDark.value
    : colorMode.preference === 'dark',
)
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
  menuOpen.value = false
}

// ── Auth ───────────────────────────────────────────────────
async function doLogout() {
  const { clear } = useUserState()
  await supabase.auth.signOut()
  clear()
  router.replace('/login')
}

// ── Guard ──────────────────────────────────────────────────
onMounted(async () => {
  const { ensure } = useUserState()
  const { hasMembership, needsProfile } = await ensure()
  if (needsProfile) {
    router.replace('/onboarding/profile')
    return
  }
  if (!hasMembership) {
    router.replace('/onboarding')
    return
  }
})

// ── Circle data ────────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
const circleId = computed<string | null>(() => circle.value?.id ?? null)

// ── Timeline data ──────────────────────────────────────────
import type { Memory } from '~/composables/useTimeline'

const memoriesFlat = ref<Memory[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)

async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{
      memories: Memory[]
      nextCursor: string | null
    }>('/api/timeline', {
      query: { circleId: circleId.value, ...(cursor ? { cursor } : {}) },
    })
    memoriesFlat.value = cursor
      ? [...memoriesFlat.value, ...data.memories]
      : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

function onUploaded() {
  memoriesFlat.value = []
  nextCursor.value = null
  fetchTimeline()
}

onMounted(() => fetchTimeline())

const { monthGroups, yearInfos } = useTimeline(memoriesFlat)

// ── Year badge ─────────────────────────────────────────────
const currentYear = ref<number | null>(null)
const timelinePolaroidRef = ref<{ scrollToYear: (y: number) => void }>()

function onYearChange(year: number) {
  currentYear.value = year
}

// Set initial year from first memory
watch(
  monthGroups,
  (groups) => {
    if (groups.length && !currentYear.value) {
      currentYear.value = groups[0].year
    }
  },
  { immediate: true },
)

// ── Jump modal ─────────────────────────────────────────────
const jumpOpen = ref(false)

function openJump() {
  jumpOpen.value = true
  menuOpen.value = false
}

function jumpToYear(year: number) {
  jumpOpen.value = false
  nextTick(() => timelinePolaroidRef.value?.scrollToYear(year))
}

function jumpToMonth(year: number, month: number) {
  jumpOpen.value = false
  nextTick(() => {
    const el = document.getElementById(`anchor-${year}`)
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 120,
        behavior: 'smooth',
      })
  })
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// ── Invite ─────────────────────────────────────────────────
const canInvite = computed(() => {
  const role = circle.value?.role
  return role === 'owner' || role === 'admin'
})

const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteSending = ref(false)
const inviteError = ref('')
const inviteSentTo = ref('')

function closeInvite() {
  inviteOpen.value = false
  inviteEmail.value = ''
  inviteError.value = ''
  inviteSentTo.value = ''
}

async function sendInvite() {
  if (!circleId.value || !inviteEmail.value) return
  inviteSending.value = true
  inviteError.value = ''
  inviteSentTo.value = ''
  try {
    await $fetch('/api/circles/invite', {
      method: 'POST',
      body: { circleId: circleId.value, email: inviteEmail.value },
    })
    inviteSentTo.value = inviteEmail.value
    inviteEmail.value = ''
  } catch (err: any) {
    const msg = err?.data?.message ?? ''
    if (msg.includes('already been sent'))
      inviteError.value = 'An invite was already sent to this email.'
    else if (msg.includes('Max 10'))
      inviteError.value =
        'You have 10 pending invites. Wait for some to be accepted first.'
    else inviteError.value = 'Failed to send invite. Please try again.'
  } finally {
    inviteSending.value = false
  }
}
```

- [ ] **Step 3: Replace the template**

Replace the entire `<template>` block with:

```vue
<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
        <!-- Circle identity -->
        <div class="min-w-0 flex-1">
          <p
            class="mb-1 select-none text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
          >
            Our Story
          </p>
          <div class="flex-wrap-nowrap flex items-center gap-2">
            <p
              class="truncate text-sm font-semibold leading-none text-foreground"
            >
              {{ circle?.name ?? '…' }}
            </p>
            <span class="flex-shrink-0 text-xs text-border">·</span>
            <NuxtLink
              v-if="circle?.memberCount"
              to="/members"
              class="flex-shrink-0 whitespace-nowrap text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground"
            >
              {{ circle.memberCount }}
              {{ circle.memberCount === 1 ? 'member' : 'members' }}
            </NuxtLink>

            <!-- Year badge -->
            <button
              v-if="currentYear"
              class="inline-flex h-5 flex-shrink-0 cursor-pointer items-center gap-1 rounded-full border-none bg-foreground px-2 text-[10px] font-bold tracking-wide text-background transition-opacity hover:opacity-70"
              @click="openJump"
            >
              {{ currentYear }}
              <svg
                width="8"
                height="8"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Avatar + dropdown -->
        <div ref="menuRef" class="relative flex-shrink-0">
          <button
            class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-border transition-all hover:ring-ring"
            @click="menuOpen = !menuOpen"
          >
            <img
              v-if="userAvatarUrl"
              :src="userAvatarUrl"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-[10px] font-bold text-foreground">{{
              userInitials
            }}</span>
          </button>

          <!-- Dropdown -->
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-2 w-56 origin-top-right overflow-hidden rounded-[14px] border border-border bg-card shadow-xl"
            >
              <div class="border-b border-border px-4 py-3">
                <p class="truncate text-sm font-semibold text-foreground">
                  {{ userDisplayName }}
                </p>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">
                  {{ authUser?.email }}
                </p>
              </div>
              <div class="py-1">
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="menuOpen = false"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  Profile settings
                </button>
                <button
                  v-if="canInvite"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="
                    menuOpen = false
                    inviteOpen = true
                  "
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  Invite member
                </button>
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                  @click="toggleTheme"
                >
                  <svg
                    v-if="isDark"
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path
                      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    />
                  </svg>
                  <svg
                    v-else
                    class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  {{ isDark ? 'Light mode' : 'Dark mode' }}
                </button>
                <div class="mx-3 h-px bg-border" />
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-secondary"
                  @click="doLogout"
                >
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log out
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Timeline -->
    <main class="mx-auto max-w-5xl px-5 py-6">
      <TimelinePolaroid
        ref="timelinePolaroidRef"
        :month-groups="monthGroups"
        :year-infos="yearInfos"
        :loading="loading"
        :has-next-page="!!nextCursor"
        @load-more="fetchTimeline(nextCursor ?? undefined)"
        @year-change="onYearChange"
      />
    </main>

    <!-- Jump modal -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="jumpOpen"
        class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
        @click.self="jumpOpen = false"
      >
        <div
          class="absolute inset-0 bg-black/45 backdrop-blur-sm"
          @click="jumpOpen = false"
        />
        <div
          class="relative w-full max-w-lg -translate-y-0 rounded-2xl border border-border bg-card p-5 shadow-2xl transition-transform duration-200"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">Jump to</h2>
            <button
              class="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              @click="jumpOpen = false"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            v-for="info in yearInfos"
            :key="info.year"
            class="mb-4 last:mb-0"
          >
            <!-- Year row -->
            <div
              class="grid gap-1.5"
              style="grid-template-columns: 44px repeat(12, 1fr);"
            >
              <!-- Year label -->
              <button
                class="py-1 text-left text-xs font-bold text-foreground transition-colors hover:text-accent"
                @click="jumpToYear(info.year)"
              >
                {{ info.year }}
              </button>
              <!-- Month cells -->
              <button
                v-for="m in 12"
                :key="m"
                class="h-7 rounded text-[10px] font-medium transition-colors"
                :class="
                  info.months.includes(m)
                    ? 'cursor-pointer bg-secondary text-muted-foreground hover:bg-accent hover:text-background'
                    : 'cursor-default bg-transparent text-transparent'
                "
                :disabled="!info.months.includes(m)"
                @click="info.months.includes(m) && jumpToMonth(info.year, m)"
              >
                {{ info.months.includes(m) ? MONTH_ABBR[m - 1] : '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Invite dialog -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="inviteOpen"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeInvite"
        />
        <div
          class="relative w-full max-w-sm rounded-[20px] border border-border bg-card p-6 shadow-2xl"
        >
          <h2 class="mb-1 font-display text-lg font-bold text-foreground">
            Invite someone
          </h2>
          <p class="mb-5 text-xs text-muted-foreground">
            They'll get an email with a link to join
            {{ circle?.name ?? 'your circle' }}.
          </p>
          <form @submit.prevent="sendInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="their@email.com"
              required
              :disabled="inviteSending"
              class="mb-3 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p v-if="inviteError" class="mb-3 text-xs text-destructive">
              {{ inviteError }}
            </p>
            <p
              v-if="inviteSentTo"
              class="mb-3 text-xs text-green-600 dark:text-green-400"
            >
              Invite sent to {{ inviteSentTo }}.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-[10px] border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                @click="closeInvite"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="inviteSending || !inviteEmail"
                class="flex-1 rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {{ inviteSending ? 'Sending…' : 'Send invite' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Upload memory (headless) -->
    <UploadMemory
      v-if="circleId"
      ref="uploadRef"
      :circle-id="circleId"
      hide-trigger
      @uploaded="onUploaded"
    />

    <!-- FAB -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="circleId && !uploadRef?.isOpen"
        class="pointer-events-none fixed inset-x-0 bottom-6 z-40"
      >
        <div class="mx-auto flex max-w-5xl justify-end px-5">
          <button
            class="group pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-primary pl-5 pr-6 text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
            @click="uploadRef?.open()"
          >
            <svg
              class="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span class="text-sm font-semibold">Add memory</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
```

- [ ] **Step 4: Run dev and visually verify the timeline renders**

```bash
pnpm dev
```

Open `localhost:3000`. Verify:

- [ ] Header shows circle name, member count, and year badge (if memories exist)
- [ ] Timeline shows polaroid cards grouped by month
- [ ] Cards have random-ish tilts
- [ ] Dark mode (toggle in dropdown) looks correct
- [ ] Year badge shows current year; scrolling past a year boundary updates it
- [ ] Clicking year badge opens jump modal with year × month grid

- [ ] **Step 5: Run unit tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: replace masonry grid with Polaroid Wall timeline, add year badge and jump modal"
```

---

## Task 7: Add `yearMonth` filter to timeline API

**Files:**

- Modify: `server/api/timeline.get.ts`
- Modify: `unit/api-validation.test.ts`

The month overflow page needs to fetch all memories for a specific month. The existing cursor-based pagination doesn't support filtering by month. Add an optional `yearMonth` param (format: `"2025-03"`) that, when present, filters to that calendar month and returns up to 100 results without cursor pagination.

- [ ] **Step 1: Write the failing test**

Open `unit/api-validation.test.ts` and add this describe block at the end of the file:

```ts
// ============================================================
// GET /api/timeline — yearMonth param validation
// ============================================================
const timelineQuerySchema = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})

describe('GET /api/timeline — yearMonth param validation', () => {
  it('accepts a valid yearMonth string', () => {
    const r = timelineQuerySchema.safeParse({
      circleId: '00000000-0000-0000-0000-000000000001',
      yearMonth: '2025-03',
    })
    expect(r.success).toBe(true)
  })

  it('rejects yearMonth with invalid month 13', () => {
    const r = timelineQuerySchema.safeParse({
      circleId: '00000000-0000-0000-0000-000000000001',
      yearMonth: '2025-13',
    })
    expect(r.success).toBe(false)
  })

  it('rejects yearMonth with invalid month 00', () => {
    const r = timelineQuerySchema.safeParse({
      circleId: '00000000-0000-0000-0000-000000000001',
      yearMonth: '2025-00',
    })
    expect(r.success).toBe(false)
  })

  it('rejects yearMonth with wrong format', () => {
    const r = timelineQuerySchema.safeParse({
      circleId: '00000000-0000-0000-0000-000000000001',
      yearMonth: '03-2025',
    })
    expect(r.success).toBe(false)
  })

  it('accepts request without yearMonth (normal cursor pagination)', () => {
    const r = timelineQuerySchema.safeParse({
      circleId: '00000000-0000-0000-0000-000000000001',
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test unit/api-validation.test.ts
```

Expected: FAIL — `timelineQuerySchema` is not yet defined in the route.

- [ ] **Step 3: Update `server/api/timeline.get.ts`**

Replace the `querySchema` definition and add month-filter logic:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'circleId is required' })
  const { circleId, cursor, authorId, yearMonth } = result.data

  // Verify the requesting user belongs to this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  let query = supabase
    .from('memory')
    .select(
      `
      id, owner_user_id, visibility, note, memory_date, milestone_label, milestone_is_custom, created_at,
      memorymedia(id, storage_path, media_type, file_size),
      user!owner_user_id(first_name, last_name, avatar_url),
      memoryreaction(id, emoji, user_id),
      memorycomment(id)
    `,
    )
    .eq('circle_id', circleId)
    .or(
      `visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`,
    )
    .order('memory_date', { ascending: false })
    .order('id', { ascending: false })

  if (authorId) {
    query = query.eq('owner_user_id', authorId)
  }

  if (yearMonth) {
    // Filter to a specific calendar month — used by the month overflow page
    const [year, month] = yearMonth.split('-').map(Number)
    const from = new Date(year, month - 1, 1).toISOString()
    const to = new Date(year, month, 1).toISOString() // start of next month
    query = query.gte('memory_date', from).lt('memory_date', to).limit(100)
    // When filtering by month, return all results (no cursor pagination needed)
    const { data: memories, error } = await query
    if (error) {
      console.error('[timeline] month query failed:', error.message)
      throw createError({
        statusCode: 500,
        message: 'Failed to load timeline.',
      })
    }
    return {
      memories: await attachSignedUrls(supabase, memories ?? []),
      nextCursor: null,
    }
  }

  // Cursor-based pagination for the main timeline
  query = query.limit(20)

  if (cursor) {
    const [cursorDate, cursorId] = cursor.split(',')
    query = (query as any).or(
      `memory_date.lt.${cursorDate},and(memory_date.eq.${cursorDate},id.lt.${cursorId})`,
    )
  }

  const { data: memories, error } = await query

  if (error) {
    console.error('[timeline] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load timeline.' })
  }

  const memoriesWithUrls = await attachSignedUrls(supabase, memories ?? [])
  const last = memoriesWithUrls[memoriesWithUrls.length - 1]
  const nextCursor = last ? `${last.memory_date},${last.id}` : null

  return { memories: memoriesWithUrls, nextCursor }
})

async function attachSignedUrls(supabase: any, memories: any[]) {
  return Promise.all(
    memories.map(async (memory) => {
      const mediaWithUrls = await Promise.all(
        ((memory.memorymedia as any[]) ?? []).map(async (media) => {
          const { storage_path, ...safeMedia } = media
          if (!storage_path)
            return { ...safeMedia, url: null, thumbnailUrl: null }

          const [fullResult, thumbResult] = await Promise.allSettled([
            supabase.storage
              .from('memories-private')
              .createSignedUrl(storage_path, 3600),
            supabase.storage
              .from('memories-private')
              .createSignedUrl(storage_path, 86400, {
                transform: {
                  width: 800,
                  format: 'webp' as 'origin',
                  quality: 85,
                },
              }),
          ])

          const url =
            fullResult.status === 'fulfilled'
              ? (fullResult.value.data?.signedUrl ?? null)
              : null
          const thumbnailUrl =
            thumbResult.status === 'fulfilled'
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

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests pass including the 5 new yearMonth validation tests.

- [ ] **Step 5: Commit**

```bash
git add server/api/timeline.get.ts unit/api-validation.test.ts
git commit -m "feat: add yearMonth filter to timeline API for month overflow page"
```

---

## Task 8: Month overflow page

**Files:**

- Create: `app/pages/timeline/[year]/[month].vue`

This page shows all memories for one specific month when the main timeline caps at 12. It reuses `PolaroidCard` in a full uncapped grid. A "← Back" link returns to the main timeline, scrolled to that year.

- [ ] **Step 1: Create `app/pages/timeline/[year]/[month].vue`**

```vue
<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3.5">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </NuxtLink>
        <div class="min-w-0 flex-1">
          <p
            class="mb-1 select-none text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
          >
            Our Story
          </p>
          <p class="text-sm font-semibold leading-none text-foreground">
            {{ monthLabel }}
          </p>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-5 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-32">
        <div class="flex flex-col items-center gap-3">
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          <p class="text-xs text-muted-foreground">Loading memories…</p>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="memories.length === 0" class="py-32 text-center">
        <p class="text-sm text-muted-foreground">
          No memories found for {{ monthLabel }}.
        </p>
      </div>

      <!-- Polaroid grid (uncapped) -->
      <div v-else>
        <p class="mb-6 text-xs text-muted-foreground">
          {{ memories.length }}
          {{ memories.length === 1 ? 'memory' : 'memories' }}
        </p>
        <div class="flex flex-wrap gap-5">
          <PolaroidCard
            v-for="(memory, i) in memories"
            :key="memory.id"
            :memory="memory"
            :index="i"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const route = useRoute()
const year = Number(route.params.year)
const month = Number(route.params.month)

// Validate route params — redirect to home if malformed
if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) {
  navigateTo('/')
}

const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  }),
)

const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circleId = computed<string | null>(
  () => circlesData.value?.circles?.[0]?.id ?? null,
)

const memories = ref<Memory[]>([])
const loading = ref(false)

onMounted(async () => {
  if (!circleId.value) return
  loading.value = true
  try {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`
    const data = await $fetch<{ memories: Memory[]; nextCursor: null }>(
      '/api/timeline',
      {
        query: { circleId: circleId.value, yearMonth },
      },
    )
    memories.value = data.memories
  } catch (err) {
    console.error('[month-page] fetch error:', err)
  } finally {
    loading.value = false
  }
})
</script>
```

- [ ] **Step 2: Verify the month page in dev**

With the dev server running, navigate to `localhost:3000/timeline/2025/3` (adjust year/month to one that has memories in your dev data). Verify:

- [ ] Header shows "March 2025" (or the correct month label)
- [ ] Polaroid cards render without a 12-item cap
- [ ] "Back" link returns to `/`
- [ ] Invalid route (e.g., `/timeline/2025/99`) redirects to home

- [ ] **Step 3: Commit**

```bash
git add app/pages/timeline/
git commit -m "feat: add month overflow page at /timeline/[year]/[month]"
```

---

## Task 9: Update build plan docs

**Files:**

- Modify: `docs/build-plan.md`

- [ ] **Step 1: Mark Milestone 6 tasks as done**

In `docs/build-plan.md`, find the Milestone 6 section and update:

```markdown
### Milestone 6: Timeline

- [x] 6.1 Signed URL API (cursor-based, memory_date ordering)
- [x] 6.2 Timeline UI (Polaroid Wall — monthly sections, 12-item cap, year badge, jump modal, month overflow page)
```

Also update the `timeline_style` column note — it now exists in the DB (added in 005_timeline_style.sql).

- [ ] **Step 2: Commit**

```bash
git add docs/build-plan.md
git commit -m "docs: mark Milestone 6 timeline as complete"
```

---

## Self-Review

### Spec coverage

- [x] Cursor-based timeline with `memory_date` ordering — existing API unchanged, still correct
- [x] Infinite scroll — `loadMore` emit from TimelinePolaroid → `fetchTimeline(nextCursor)`
- [x] Skeleton states — loading spinner on initial load and pagination load
- [x] Empty state — shown when `monthGroups.length === 0 && !loading`
- [x] Year navigation — year badge in header, jump modal with year×month grid
- [x] Month 12-item cap with overflow link — `hasMore` flag + "See all" card
- [x] Month overflow page — `/timeline/[year]/[month]`
- [x] `timeline_style` column stub for future multi-style picker
- [x] Only `memory_date` ordering (not `created_at`) — design spec requirement maintained
- [x] `storage_path` never returned — `attachSignedUrls` strips it before returning

### Placeholder scan

- No TBD or TODO in plan
- All code blocks are complete
- Type names are consistent: `Memory`, `MonthGroup`, `YearInfo`, `MediaItem` used the same way throughout

### Type consistency

- `MonthGroup.anchorId` defined as `anchor-${year}` in Task 3 and used as `id=\`anchor-${yearSection.year}\`` in Task 5 ✓
- `TimelinePolaroid` emits `loadMore` and `yearChange` — both consumed in Task 6's `index.vue` ✓
- `PolaroidCard` props: `memory: Memory`, `index: number` — used consistently in Tasks 4, 5, 8 ✓
- `fetchTimeline(nextCursor ?? undefined)` — matches `fetchTimeline(cursor?: string)` signature ✓
