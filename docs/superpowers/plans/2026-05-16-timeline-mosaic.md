# Timeline Mosaic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TimelinePolaroid` with a unified `TimelineMosaic` grid that scales by column count (3 columns mobile, 4 columns desktop) via pure CSS. Delete the polaroid component family. Load the new fonts (Hanken Grotesk, JetBrains Mono, Instrument Serif italic). Add the year-ribbon italic suffix i18n keys. Ship as one PR off `dev` after sub-plan #1 (theme repaint) is merged.

**Architecture:** One Vue component (`TimelineMosaic.vue`) consumes the existing `monthGroups` from `useTimeline.ts`, renders year ribbons + month rows + a CSS-grid of `MosaicCell` instances, and exposes the same emit contract + `scrollToYear` ref API that `TimelinePolaroid` had. The page integration in [pages/timeline/index.vue](../../app/pages/timeline/index.vue) is a single component swap. Cell variants (square / wide / tall) come from a deterministic hash of the memory id (`mosaicVariant`) so layout never shifts on re-render or load-more. The text-only `.note` cell variant carries the italic-quote treatment from the spec.

This is **Sub-plan #2 of 7**. Depends on sub-plan #1 (Theme repaint) being merged. The next dependent sub-plans (#3-#4 modal, #5 month view, #7 viewer link) reuse `TimelineMosaic` and `MosaicCell` extensively.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) — §3 (architecture), §4 (Timeline Mosaic), §7 (year/month behavior), §14 build steps 2–6 and 18.

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3 + VueUse (for `useIntersectionObserver`) + Vitest (`pnpm test`) + Playwright (`pnpm test:e2e`).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/composables/useTimeline.ts` | Modify | Append `mosaicVariant(id: string)` helper that returns `'square' \| 'wide' \| 'tall'` from a deterministic hash of the memory id. Used by `MosaicCell` and the test. |
| `app/components/MosaicCell.vue` | Create | Single grid cell. Three internal variants: `photo` (also handles video media), `note` (text-only memories). Span class applied externally by the grid based on `mosaicVariant`. |
| `app/components/TimelineMosaic.vue` | Create | The grid container. Year ribbons + month rows + IntersectionObserver-driven `year-change` emit + load-more sentinel + `scrollToYear` ref method. Replaces `TimelinePolaroid`. |
| `app/pages/timeline/index.vue` | Modify | Swap `<TimelinePolaroid …>` → `<TimelineMosaic …>` and adjust the `monthGroups` prop binding if needed. Same emit handlers. |
| `app/components/TimelinePolaroid.vue` | Delete | Replaced by `TimelineMosaic`. |
| `app/components/PolaroidCard.vue` | Delete | No longer used. |
| `app/components/QuickNoteCard.vue` | Delete | Replaced by `MosaicCell`'s `.note` variant. |
| `nuxt.config.ts` | Modify | Update the Google Fonts `<link>` in `app.head.link`: add `Hanken Grotesk`, `JetBrains Mono`, `Instrument Serif` (italic); remove `Caveat` (polaroid-only) and possibly `Playfair Display` if it appears. Keep `DM Sans` (still default sans elsewhere; later sub-plans may swap it). |
| `tailwind.config.ts` | Modify | Add `fontFamily` entries for the three new fonts so `font-display`, `font-mono`, and the italic-serif accent can be referenced as Tailwind utilities. Keep the existing `sans: ['"DM Sans"', …]` for the rest of the app. |
| `locales/en.json` | Modify | Add `timeline.thisYearSuffix: "this year"` and `timeline.lastYearSuffix: "last year"`. |
| `locales/zh-CN.json` | Modify | Add `timeline.thisYearSuffix: "今年"` and `timeline.lastYearSuffix: "去年"`. |
| `locales/fr.json` | Modify | Add `timeline.thisYearSuffix: "cette année"` and `timeline.lastYearSuffix: "l'année dernière"`. |
| `unit/mosaicVariant.test.ts` | Create | Determinism + distribution test for the new helper. |
| `tests/timeline-mosaic-viewports.spec.ts` | Create | Playwright E2E: at 800×600 the grid is 4-col; at 375×600 it is 3-col. |
| `tests/timeline-year.spec.ts` | Modify | Existing test asserts polaroid tape labels; rewrite to assert the new year-ribbon ("2026 this year") + JetBrains Mono tally. |
| `tests/quick-note.spec.ts` | Modify | Selectors only — assert `.note` MosaicCell renders the open-quote glyph and meta line. |
| `tests/month-overflow.spec.ts` | Modify | Selectors only — month-row class names change. |

---

## Task 1: `mosaicVariant` helper (TDD)

**Files:**
- Modify: `app/composables/useTimeline.ts`
- Create: `unit/mosaicVariant.test.ts`

Implement the deterministic variant hash from spec §4.5. The same id must always produce the same variant, and the distribution across 10k random ids must be ~15% wide / ~13% tall / ~72% square (within 2% tolerance) so the grid feels varied but not chaotic.

### Step 1: Write the failing test

Create `unit/mosaicVariant.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { mosaicVariant } from '../app/composables/useTimeline'

describe('mosaicVariant · determinism', () => {
  test('the same id always returns the same variant', () => {
    const id = 'a8f0e1c2-b3d4-4e5f-9a0b-1c2d3e4f5a6b'
    const first = mosaicVariant(id)
    for (let i = 0; i < 100; i++) {
      expect(mosaicVariant(id)).toBe(first)
    }
  })

  test('different ids generally produce different variants', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      seen.add(mosaicVariant(`memory-${i}`))
    }
    // We expect to see at least two distinct variants in 50 trials.
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })
})

describe('mosaicVariant · distribution', () => {
  function pseudoUuid(n: number): string {
    // Stable-but-varied id generator. Not crypto — just enough entropy
    // that the hash isn't bucketed pathologically by the test seed.
    return `${n.toString(16).padStart(8, '0')}-${(n * 31).toString(16).padStart(4, '0')}-${(n * 7919).toString(16).padStart(4, '0')}`
  }

  test('15% wide / 13% tall / 72% square (±2% over 10k samples)', () => {
    const counts = { square: 0, wide: 0, tall: 0 }
    for (let i = 0; i < 10_000; i++) {
      counts[mosaicVariant(pseudoUuid(i))]++
    }
    const pct = (n: number) => (n / 10_000) * 100
    expect(pct(counts.wide)).toBeGreaterThanOrEqual(13)
    expect(pct(counts.wide)).toBeLessThanOrEqual(17)
    expect(pct(counts.tall)).toBeGreaterThanOrEqual(11)
    expect(pct(counts.tall)).toBeLessThanOrEqual(15)
    expect(pct(counts.square)).toBeGreaterThanOrEqual(70)
    expect(pct(counts.square)).toBeLessThanOrEqual(74)
  })
})
```

### Step 2: Run, verify failure

```bash
pnpm test unit/mosaicVariant.test.ts
```

Expected: import error — `mosaicVariant` is not exported from `useTimeline`.

### Step 3: Implement the helper

In `app/composables/useTimeline.ts`, after the existing `useTimeline` function's closing brace, append:

```ts
/**
 * Maps a memory id to a deterministic grid cell variant.
 * ~15% of ids → 'wide' (2-col span), ~13% → 'tall' (2-row span),
 * the rest → 'square'. The hash is stable: the same id always produces
 * the same variant, so re-renders and load-more don't shift the layout.
 */
export function mosaicVariant(id: string): 'square' | 'wide' | 'tall' {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const m = h % 100
  if (m < 15) return 'wide'
  if (m < 28) return 'tall'
  return 'square'
}
```

### Step 4: Run, verify pass

```bash
pnpm test unit/mosaicVariant.test.ts
```

Expected: both describe blocks pass. The distribution test may take ~50ms.

```bash
pnpm test
```

Expected: full unit suite passes (the existing `unit/useTimeline.test.ts` doesn't touch the new export and should be unaffected).

### Step 5: Commit

```bash
git add app/composables/useTimeline.ts unit/mosaicVariant.test.ts
git commit -m "feat(timeline): add mosaicVariant deterministic cell-variant hash

Maps memory id → 'square' | 'wide' | 'tall' via a stable djb2-style
hash. ~15% wide, ~13% tall, ~72% square. The same id always produces
the same variant so re-renders and load-more never reshuffle the grid.

Used by MosaicCell (next task)."
```

---

## Task 2: `MosaicCell.vue`

**Files:**
- Create: `app/components/MosaicCell.vue`

A single grid cell. Two variants:

- **photo** — `<img>` or `<video>` filling the cell, with `filter: brightness(var(--photo-hover))` on hover and `transform: scale(1.04)`. Click anywhere → emit `open`.
- **note** — text-only memory (`memory.memorymedia.length === 0 && memory.note`). Square only — never spans. Background `--secondary`, 1px `--border`, Instrument Serif open-quote glyph at top-left, Hanken Grotesk body text clamped to 4 lines, JetBrains Mono date+author footer.

The span class (`wide` / `tall`) is applied externally by the grid using `mosaicVariant(memory.id)` — `MosaicCell` itself is agnostic to span.

### Step 1: Create the component

Create `app/components/MosaicCell.vue`:

```vue
<template>
  <div
    class="mosaic-cell"
    :class="{ note: isNote }"
    @click="$emit('open', { memory, rect: ($event.currentTarget as HTMLElement)?.getBoundingClientRect() ?? null, tilt: 0 })"
  >
    <!-- Quick-note (text-only) -->
    <template v-if="isNote">
      <div class="quote-glyph">“</div>
      <div class="note-body">{{ memory.note }}</div>
      <div class="note-meta">{{ noteMeta }}</div>
    </template>

    <!-- Photo or video -->
    <template v-else-if="firstMedia">
      <img
        v-if="!isVideo"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? ''"
        loading="lazy"
      />
      <video
        v-else
        :src="firstMedia.url ?? ''"
        muted
        playsinline
        preload="metadata"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Memory } from '~/composables/useTimeline'

const props = defineProps<{ memory: Memory }>()

defineEmits<{
  open: [
    payload: { memory: Memory; rect: DOMRect | null; tilt: number },
  ]
}>()

const isNote = computed(
  () => props.memory.memorymedia.length === 0 && Boolean(props.memory.note),
)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)
const isVideo = computed(() =>
  firstMedia.value?.media_type?.startsWith('video/') ?? false,
)

const noteMeta = computed(() => {
  const d = new Date(props.memory.memory_date)
  const monthAbbr = new Intl.DateTimeFormat('en', { month: 'short' })
    .format(d)
    .toUpperCase()
  const day = d.getUTCDate()
  const author =
    props.memory.user?.first_name ?? props.memory.former_owner_name ?? 'Member'
  return `${monthAbbr} ${day} · ${author.toUpperCase()}`
})
</script>

<style scoped>
.mosaic-cell {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: hsl(var(--card));
  cursor: pointer;
  position: relative;
}

.mosaic-cell img,
.mosaic-cell video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter 300ms ease,
    transform 350ms ease;
}

.mosaic-cell:hover img,
.mosaic-cell:hover video {
  filter: brightness(var(--photo-hover));
  transform: scale(1.04);
}

.mosaic-cell.note {
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.note .quote-glyph {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-size: 36px;
  line-height: 0.5;
  color: hsl(var(--foreground) / 0.35);
  margin-bottom: 2px;
}

.note .note-body {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 400;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground) / 0.88);
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.note .note-meta {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(var(--foreground-faint));
  margin-top: 8px;
}
</style>
```

### Step 2: Verify it compiles

```bash
pnpm dev
```

Open the dev server (auth required to land on a real page); the component is imported but not yet rendered anywhere. The goal here is just to confirm no template/script errors. If `pnpm dev` reports an error in `MosaicCell.vue`, fix it.

(If verifying via `pnpm dev` is impractical, alternatively create a tiny route at `app/pages/_sandbox-mosaic-cell.vue` that renders three sample memories — photo, note, video — and open it locally. Remove the sandbox file before committing.)

### Step 3: Commit

```bash
git add app/components/MosaicCell.vue
git commit -m "feat(timeline): MosaicCell component for the new timeline grid

Single grid cell with two variants:
- photo / video: filling the cell, hover-brightness via --photo-hover
  and scale 1.04
- note (text-only): --secondary background, --border outline,
  Instrument Serif open-quote glyph, Hanken Grotesk body clamped to
  4 lines, JetBrains Mono date+author footer

Span class (wide/tall) is applied externally by the grid via
mosaicVariant — the cell itself is span-agnostic."
```

---

## Task 3: Load the new fonts

**Files:**
- Modify: `nuxt.config.ts` (`app.head.link[2]` — the `fonts.googleapis.com/css2` `<link>` stylesheet)
- Modify: `tailwind.config.ts` (`theme.extend.fontFamily`)

The `MosaicCell` component (Task 2) already references `'Hanken Grotesk'`, `'Instrument Serif'`, and `'JetBrains Mono'` in its scoped styles. Those references resolve to system fallbacks until the fonts are actually loaded. Wire them in now.

### Step 1: Update the Google Fonts URL in `nuxt.config.ts`

Find the existing line (around `nuxt.config.ts:28`):

```ts
href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap',
```

Replace with:

```ts
href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Hanken+Grotesk:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap',
```

Notes:
- `DM Sans` kept (still default sans for the rest of the app per §1 spec).
- `Caveat` removed (polaroid-specific, no longer used after Task 7's polaroid deletion).
- New fonts: `Hanken Grotesk` (300–800), `Instrument Serif` italic-only, `JetBrains Mono` (400/500/700).
- Single URL is required by Google Fonts (combining families with `&family=`).

### Step 2: Audit lingering `Caveat` references

```bash
rg --no-config -n "Caveat" app/ nuxt.config.ts tailwind.config.ts
```

Expected hits: only `TimelinePolaroid.vue` (which gets deleted in Task 7). If anything else references Caveat, decide per-file: either swap to a new font or leave it for a later sub-plan to clean up.

### Step 3: Update `tailwind.config.ts` `fontFamily`

In `tailwind.config.ts`, find:

```ts
fontFamily: {
  sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  display: ['Georgia', 'ui-serif', '"Times New Roman"', 'serif'],
},
```

Replace with:

```ts
fontFamily: {
  sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  display: ['Georgia', 'ui-serif', '"Times New Roman"', 'serif'],
  // New families for the timeline mosaic + later surfaces (spec §2)
  hanken: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
  serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
},
```

After this, `font-hanken`, `font-mono`, `font-serif` work as Tailwind utilities. The existing `font-sans` (DM Sans) continues to work for non-timeline pages.

### Step 4: Verify the fonts load

```bash
pnpm dev
```

Open any page. In the browser DevTools Network tab, filter for `fonts.googleapis.com` and confirm a `css2?...` request returns 200. Then in the Elements tab inspect any element styled with `font-hanken` and confirm the computed font-family resolves to `Hanken Grotesk`.

If the fonts don't load: check the URL spelling (`Hanken+Grotesk`, `Instrument+Serif`, `JetBrains+Mono` — case and `+` are significant). Re-check the `<link>` rel is `stylesheet`.

### Step 5: Commit

```bash
git add nuxt.config.ts tailwind.config.ts
git commit -m "feat(theme): load Hanken Grotesk + JetBrains Mono + Instrument Serif

Adds the three new font families to the Google Fonts stylesheet link
and the Tailwind fontFamily map. Used by the timeline mosaic and the
later modal / month / settings / members / viewer-link surfaces.

- Hanken Grotesk: 300/400/500/600/700/800 — UI text, body copy
- JetBrains Mono: 400/500/700 — dates, metadata, mono accents
- Instrument Serif italic — quote glyphs, year-ribbon italic suffix

Caveat removed (polaroid-only, deleted in next task). DM Sans kept as
the app-wide default until a later sub-plan migrates it."
```

---

## Task 4: i18n keys for the year ribbon

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/zh-CN.json`
- Modify: `locales/fr.json`

The `TimelineMosaic` year ribbon renders an italic suffix next to the current and previous year ("this year" / "last year"). Localize these.

### Step 1: Add to `en.json`

Open `locales/en.json`. Find the existing `"timeline"` object (which currently has `emptyTitle`, `emptyDesc`, `loading`, `memories`, `months`, `noMemoriesFor`, `loadMore` — confirm by reading the block). Add two new keys inside the `timeline` object:

```json
    "thisYearSuffix": "this year",
    "lastYearSuffix": "last year",
```

Choose a position alphabetical or grouped near other display-text keys — match the file's existing convention.

### Step 2: Add to `zh-CN.json`

In `locales/zh-CN.json`, add to the `timeline` object:

```json
    "thisYearSuffix": "今年",
    "lastYearSuffix": "去年",
```

### Step 3: Add to `fr.json`

In `locales/fr.json`, add to the `timeline` object:

```json
    "thisYearSuffix": "cette année",
    "lastYearSuffix": "l'année dernière",
```

### Step 4: Verify JSON is valid

```bash
node -e "['en','zh-CN','fr'].forEach(l => JSON.parse(require('fs').readFileSync('locales/'+l+'.json', 'utf-8')))"
```

Expected: silent (no parse error).

### Step 5: Commit

```bash
git add locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(i18n): timeline.thisYearSuffix / lastYearSuffix keys

Italic suffix rendered next to the current/previous year on the new
timeline-mosaic year ribbon. en defaults are 'this year' / 'last year';
zh-CN uses 今年 / 去年; fr uses cette année / l'année dernière.
Translators may shorten further — the italic styling carries the
typographic weight regardless of length."
```

---

## Task 5: `TimelineMosaic.vue` — the grid container

**Files:**
- Create: `app/components/TimelineMosaic.vue`

The biggest task. This component:

- Renders year ribbons (with the italic suffix) and month rows.
- Lays out a CSS grid of `MosaicCell` instances per month with `mosaicVariant`-driven span classes.
- Mounts an `IntersectionObserver` over year-ribbon anchors and emits `year-change` with the year of the most-visible ribbon.
- Mounts a load-more sentinel at the bottom and emits `load-more` when it intersects (gated by `hasNextPage` + `loading`).
- Exposes a `scrollToYear(year: number)` ref method that smooth-scrolls to `#anchor-{year}`.
- Forwards memory-open clicks via `@open-memory`.
- Renders empty state and first-paint loading state per spec §10.

### Step 1: Create the component

Create `app/components/TimelineMosaic.vue`:

```vue
<template>
  <div ref="rootEl">
    <!-- Empty state -->
    <div
      v-if="monthGroups.length === 0 && !loading"
      class="flex flex-col items-center justify-center py-32 text-center"
    >
      <div
        class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"
      >
        <svg
          class="h-6 w-6 text-muted-foreground"
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
      <p class="mb-2 font-hanken text-base font-bold text-foreground">
        {{ t(typeConfig.emptyTitle) }}
      </p>
      <p
        class="max-w-xs font-hanken text-sm leading-relaxed text-muted-foreground"
      >
        {{ t(typeConfig.emptyDesc) }}
      </p>
    </div>

    <!-- First-load spinner -->
    <div
      v-else-if="loading && monthGroups.length === 0"
      class="flex justify-center py-32"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
        />
        <p class="font-hanken text-xs text-muted-foreground">
          {{ t('timeline.loading') }}
        </p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-else>
      <template v-for="yearSection in yearSections" :key="yearSection.year">
        <!-- Year ribbon -->
        <div
          :id="`anchor-${yearSection.year}`"
          :data-year="yearSection.year"
          class="year-ribbon"
        >
          <span class="yr">
            {{ yearSection.year }}
            <em v-if="suffixFor(yearSection.year)">{{ suffixFor(yearSection.year) }}</em>
          </span>
          <span class="tally">{{ yearTally(yearSection) }}</span>
        </div>

        <!-- Month rows -->
        <div
          v-for="group in yearSection.months"
          :key="group.label"
          :id="`month-${group.year}-${group.month}`"
          class="month-section"
        >
          <div class="month-row">
            <span class="mn">{{ monthName(group) }}</span>
            <span class="my">{{ group.year }}</span>
            <span class="mc">{{ t('timeline.memories', group.totalCount).toUpperCase() }}</span>
          </div>
          <div class="grid">
            <MosaicCell
              v-for="memory in group.memories"
              :key="memory.id"
              :memory="memory"
              :class="cellClass(memory.id, memory)"
              @open="(p) => $emit('openMemory', p)"
            />
          </div>
        </div>
      </template>

      <!-- Load-more sentinel + spinner -->
      <div ref="loadMoreEl" class="py-8">
        <div v-if="loading && monthGroups.length > 0" class="flex justify-center">
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import type { Memory, MonthGroup } from '~/composables/useTimeline'
import { mosaicVariant } from '~/composables/useTimeline'
import MosaicCell from '~/components/MosaicCell.vue'

const { t, locale } = useI18n()

const props = defineProps<{
  monthGroups: MonthGroup[]
  loading: boolean
  hasNextPage: boolean
  circleType: string | null
  circleId: string | null
}>()

const emit = defineEmits<{
  loadMore: []
  yearChange: [year: number]
  openMemory: [
    payload: { memory: Memory; rect: DOMRect | null; tilt: number },
  ]
  reactionUpdate: [{ memoryId: string; reactions: unknown[] }]
}>()

const rootEl = ref<HTMLElement>()
const loadMoreEl = ref<HTMLElement>()

// Group month-groups by year for ribbon rendering
interface YearSection {
  year: number
  months: MonthGroup[]
}
const yearSections = computed<YearSection[]>(() => {
  const byYear = new Map<number, MonthGroup[]>()
  for (const g of props.monthGroups) {
    if (!byYear.has(g.year)) byYear.set(g.year, [])
    byYear.get(g.year)!.push(g)
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({ year, months }))
})

const yearTally = (s: YearSection): string => {
  const total = s.months.reduce((sum, g) => sum + g.totalCount, 0)
  return t('timeline.memories', total).toUpperCase()
}

const currentYear = new Date().getFullYear()
const suffixFor = (year: number): string | null => {
  if (year === currentYear) return t('timeline.thisYearSuffix')
  if (year === currentYear - 1) return t('timeline.lastYearSuffix')
  return null
}

const monthName = (g: MonthGroup): string => {
  return new Intl.DateTimeFormat(locale.value, { month: 'long' })
    .format(new Date(g.year, g.month - 1, 1))
    .toUpperCase()
}

// Span class — first memory of each month is forced to .wide to anchor it
const cellClass = (id: string, memory: Memory): string => {
  // .note cells never span
  if (memory.memorymedia.length === 0 && memory.note) return ''
  const v = mosaicVariant(id)
  if (v === 'wide') return 'wide'
  if (v === 'tall') return 'tall'
  return ''
}

// Circle-type empty-state config
const typeConfig = computed(() => ({
  emptyTitle: `timeline.emptyTitle`,
  emptyDesc: `timeline.emptyDesc`,
}))

// IntersectionObserver — emit year-change for the most-visible ribbon
const yearRibbonObservers: Array<() => void> = []
watch(
  yearSections,
  (sections) => {
    yearRibbonObservers.forEach((stop) => stop())
    yearRibbonObservers.length = 0
    void requestAnimationFrame(() => {
      for (const s of sections) {
        const el = document.getElementById(`anchor-${s.year}`)
        if (!el) continue
        const { stop } = useIntersectionObserver(
          el,
          ([entry]) => {
            if (entry?.isIntersecting) emit('yearChange', s.year)
          },
          { threshold: 0.4 },
        )
        yearRibbonObservers.push(stop)
      }
    })
  },
  { immediate: true },
)

// Load-more sentinel
useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && props.hasNextPage && !props.loading) {
    emit('loadMore')
  }
})

// Public ref API: scrollToYear(year)
defineExpose({
  scrollToYear(year: number) {
    const el = document.getElementById(`anchor-${year}`)
    if (!el) return
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 80,
      behavior: 'smooth',
    })
  },
})
</script>

<style scoped>
/* ─── Year ribbon ───────────────────────────────────────────── */
.year-ribbon {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 0 0 14px;
  margin: 28px 0 22px;
  border-bottom: 1px solid hsl(var(--foreground) / 0.16);
}
.year-ribbon:first-child {
  margin-top: 0;
}
.year-ribbon .yr {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: hsl(var(--foreground));
}
.year-ribbon .yr em {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  margin-left: 4px;
}
.year-ribbon .tally {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: hsl(var(--foreground-faint));
  text-transform: uppercase;
}

/* ─── Month row ──────────────────────────────────────────────── */
.month-section {
  margin-bottom: 22px;
}
.month-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 8px;
}
.month-row .mn {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: hsl(var(--foreground));
  text-transform: uppercase;
}
.month-row .my {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 500;
  font-size: 11px;
  color: hsl(var(--foreground-faint));
}
.month-row .mc {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 400;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: hsl(var(--foreground-faint));
}

/* ─── Photo grid ─────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.grid > :deep(.wide) {
  grid-column: span 2;
  aspect-ratio: 2 / 1;
}
.grid > :deep(.tall) {
  grid-row: span 2;
  aspect-ratio: 1 / 2;
}
</style>
```

Notes:
- `useIntersectionObserver` is imported from `@vueuse/core` — already a dependency (used by `TimelinePolaroid` today).
- The `cellClass` returns class names, NOT inline styles — the parent `.grid > :deep(.wide)` selector applies the span. Vue's `:class` binding sets these classes on the rendered cell's root element.
- `defineExpose({ scrollToYear })` exposes the ref API to the page so `$ref.value?.scrollToYear(year)` still works from [pages/timeline/index.vue:1029](../../app/pages/timeline/index.vue#L1029).

### Step 2: Verify it compiles

```bash
pnpm dev
```

Component is imported nowhere yet; just confirm no template/script errors when `pnpm dev` builds.

### Step 3: Run unit tests

```bash
pnpm test
```

Expected: full suite still passes. `TimelineMosaic.vue` has no unit test of its own — its behavior is exercised by the E2E suite (Task 9) and the `mosaicVariant` distribution test from Task 1.

### Step 4: Commit

```bash
git add app/components/TimelineMosaic.vue
git commit -m "feat(timeline): TimelineMosaic grid container

Replaces TimelinePolaroid with a unified CSS grid:
- 3 cols on mobile, 4 cols on desktop, via a media query (no JS swap)
- Year ribbons with italic 'this year' / 'last year' suffix
- Month rows with mono memory count
- Span classes (.wide / .tall) applied via mosaicVariant hash
- IntersectionObserver-driven year-change emit
- Load-more sentinel
- Empty state + first-load spinner per spec §10
- scrollToYear exposed via defineExpose

Wired into pages/timeline/index.vue in the next task."
```

---

## Task 6: Swap `<TimelinePolaroid>` → `<TimelineMosaic>` in the timeline page

**Files:**
- Modify: `app/pages/timeline/index.vue` (the `<TimelinePolaroid>` element around line 420)

### Step 1: Update the template

In `app/pages/timeline/index.vue`, find:

```vue
      <TimelinePolaroid
        ref="timelinePolaroidRef"
        :month-groups="monthGroups"
        :loading="loading"
        :has-next-page="!!prevYear"
        :circle-type="circle?.circle_type ?? null"
        :circle-id="circleId"
        @load-more="fetchTimeline(prevYear ?? undefined)"
        @year-change="onYearChange"
        @open-memory="onOpenMemory"
        @reaction-update="onReactionUpdate"
      />
```

Replace with:

```vue
      <TimelineMosaic
        ref="timelineMosaicRef"
        :month-groups="monthGroups"
        :loading="loading"
        :has-next-page="!!prevYear"
        :circle-type="circle?.circle_type ?? null"
        :circle-id="circleId"
        @load-more="fetchTimeline(prevYear ?? undefined)"
        @year-change="onYearChange"
        @open-memory="onOpenMemory"
        @reaction-update="onReactionUpdate"
      />
```

### Step 2: Rename the ref in `<script setup>`

Find the ref declaration (around line 1004):

```ts
const timelinePolaroidRef = ref<{ scrollToYear: (y: number) => void }>()
```

Replace with:

```ts
const timelineMosaicRef = ref<{ scrollToYear: (y: number) => void }>()
```

Then find any usage of `timelinePolaroidRef` (e.g. inside `jumpToYear`):

```ts
function jumpToYear(year: number) {
  jumpOpen.value = false
  nextTick(() => timelinePolaroidRef.value?.scrollToYear(year))
}
```

Replace with:

```ts
function jumpToYear(year: number) {
  jumpOpen.value = false
  nextTick(() => timelineMosaicRef.value?.scrollToYear(year))
}
```

### Step 3: Verify the page renders

```bash
pnpm dev
```

Log in. Open `/timeline`. The new mosaic should render: year ribbons with italic suffix, month rows, photo grid (3-col on mobile, 4-col on desktop). Year pill updates as you scroll. Jump-to-year from header works. Load-more triggers on scroll-to-bottom.

If the page is blank or throws: open DevTools Console and trace. Common issues:
- `MosaicCell` not auto-imported → check Nuxt's `components: [{ path: '~/components' }]` config covers it (yes — sub-plan #1 didn't change this).
- Span classes not applying → confirm `:deep(.wide)` selectors are active by inspecting a wide cell in Elements panel.

### Step 4: Commit

```bash
git add app/pages/timeline/index.vue
git commit -m "feat(timeline): swap TimelinePolaroid → TimelineMosaic on /timeline

Page integration. Renames the ref binding. All emit handlers preserved
(onYearChange, onOpenMemory, onReactionUpdate, fetchTimeline) so the
parent page logic is unchanged. The polaroid layout is now dead code;
deletion follows in Task 10."
```

---

## Task 7: Update existing E2E tests for the new structure

**Files:**
- Modify: `tests/timeline-year.spec.ts`
- Modify: `tests/quick-note.spec.ts`
- Modify: `tests/month-overflow.spec.ts`

### Step 1: Audit existing assertions

```bash
rg -n "Caveat|tape|polaroid|isWide" tests/
```

Any hit is something that needs updating to the new DOM.

### Step 2: Update `tests/timeline-year.spec.ts`

The current test asserts the polaroid amber-tape year label. Find the assertion (likely a selector like `.font-Caveat`, the amber background color, or text containing the year by itself). Replace with one that targets the new year ribbon:

```ts
await expect(page.locator('.year-ribbon .yr').first()).toContainText('2026')
await expect(page.locator('.year-ribbon .yr em').first()).toContainText('this year')
await expect(page.locator('.year-ribbon .tally').first()).toContainText('MEMORIES')
```

(Use the actual class names from `TimelineMosaic.vue`'s scoped CSS. Playwright's locator works with scoped-class hashes via attribute matchers if needed: `page.locator('[class*="year-ribbon"] [class*="yr"]')`. Prefer the unscoped data-attribute approach: `data-year="2026"`.)

Better: in `TimelineMosaic.vue`, the year ribbon already has `data-year="{year}"` on its root. Use that selector:

```ts
await expect(page.locator('[data-year="2026"]')).toBeVisible()
```

### Step 3: Update `tests/quick-note.spec.ts`

The test creates a text-only memory and asserts it renders. With the new `MosaicCell.note` variant, the assertion is for the `.note` class and the open-quote glyph:

```ts
await expect(page.locator('.mosaic-cell.note').first()).toBeVisible()
await expect(page.locator('.mosaic-cell.note .quote-glyph').first()).toHaveText('“')
await expect(page.locator('.mosaic-cell.note .note-body').first()).toContainText(
  /* fragment of the memory's note text */,
)
```

### Step 4: Update `tests/month-overflow.spec.ts`

Likely just asserts that a month with > N memories paginates or shows the right count. Find any selector targeting old polaroid classes and swap to the new structure. The month-row count assertion can target `.month-row .mc`:

```ts
await expect(page.locator('.month-row .mc').first()).toContainText(/\d+ MEMORIES/)
```

### Step 5: Run the E2E suite

```bash
pnpm test:e2e
```

Expected: all tests pass. If a test fails, read the failure message — it should say which selector didn't resolve. Update the selector, re-run.

If any test reveals a behavior the new component doesn't yet implement, STOP and report — that's a gap in the implementation, not a test bug.

### Step 6: Commit

```bash
git add tests/timeline-year.spec.ts tests/quick-note.spec.ts tests/month-overflow.spec.ts
git commit -m "test(e2e): update existing specs for the new mosaic structure

Year-ribbon and month-row selectors replace the old polaroid tape and
pinned-photo classes. Quick-note assertions target .mosaic-cell.note
and the Instrument Serif open-quote glyph. No behavior change — just
DOM-shape updates."
```

---

## Task 8: New E2E — viewport-driven column count

**Files:**
- Create: `tests/timeline-mosaic-viewports.spec.ts`

Verify the 3-col / 4-col CSS media query actually fires.

### Step 1: Write the test

Create `tests/timeline-mosaic-viewports.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// These tests assume a logged-in user with at least one memory in the
// current circle. Reuse the existing auth fixture if present in this
// repo (check tests/helpers or tests/fixtures); otherwise the test
// must drive a login flow first.

test.describe('timeline mosaic · viewport-driven column count', () => {
  test('renders 3 columns at mobile viewport (< 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid')

    const cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    // 3 tracks → 2 spaces between them. Count tokens.
    expect(cols.split(/\s+/).length).toBe(3)
  })

  test('renders 4 columns at desktop viewport (≥ 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid')

    const cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    expect(cols.split(/\s+/).length).toBe(4)
  })

  test('crossing the 768px boundary swaps column count', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid')

    await page.setViewportSize({ width: 700, height: 800 })
    // Allow CSS to re-evaluate the media query
    await page.waitForTimeout(50)

    const cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    expect(cols.split(/\s+/).length).toBe(3)
  })
})
```

Note: the test inspects `getComputedStyle` to count grid tracks — this is the most robust way to verify the media query actually fired without depending on a specific pixel width per track.

### Step 2: Run

```bash
pnpm test:e2e tests/timeline-mosaic-viewports.spec.ts
```

Expected: 3 tests pass. If they fail because login is required and there's no test fixture set up: extend the test with the existing test-account login flow (search `tests/` for a working pattern), or mark the test `.skip` and document the dependency for a future task.

### Step 3: Commit

```bash
git add tests/timeline-mosaic-viewports.spec.ts
git commit -m "test(e2e): timeline mosaic renders 3 cols mobile / 4 cols desktop

Inspects getComputedStyle on the .grid element to count grid-template-
columns tracks. Verifies the 768px media query boundary swaps the
column count both at static viewports and at runtime resize."
```

---

## Task 9: Delete the polaroid files

**Files:**
- Delete: `app/components/TimelinePolaroid.vue`
- Delete: `app/components/PolaroidCard.vue`
- Delete: `app/components/QuickNoteCard.vue`

The new mosaic is rendering; the polaroid is dead code.

### Step 1: Confirm no remaining references

```bash
rg -n "TimelinePolaroid|PolaroidCard|QuickNoteCard|isWideMemory" app/ tests/ unit/
```

Expected: any hit is either inside the file being deleted itself, or a test that hasn't been updated yet. If a `pages/timeline/[year]/[month].vue` still uses `PolaroidCard` / `QuickNoteCard` — that's sub-plan #5's territory (month view). For this sub-plan, that's acceptable. STOP and report if any unexpected reference exists in `app/components/` (besides the three files being deleted) or `app/pages/timeline/index.vue`.

### Step 2: Delete the files

```bash
git rm app/components/TimelinePolaroid.vue
git rm app/components/PolaroidCard.vue
git rm app/components/QuickNoteCard.vue
```

### Step 3: Run the full test + dev sanity check

```bash
pnpm test
pnpm dev
```

Expected: tests pass; dev server compiles cleanly; `/timeline` renders the mosaic.

If `pages/timeline/[year]/[month].vue` still references `PolaroidCard` / `QuickNoteCard` (it likely does — that's sub-plan #5's scope) and now throws because they don't exist: add a TEMPORARY stub or update the page minimally to use `MosaicCell` instead. The proper redesign is sub-plan #5; the goal here is just "the route doesn't 500." If you can't make the route work with a minimal change, STOP and report — the controller will route the fix.

### Step 4: Commit

```bash
git add -A
git commit -m "chore(timeline): delete polaroid components

Removed from app/components/:
- TimelinePolaroid.vue (replaced by TimelineMosaic)
- PolaroidCard.vue (replaced by MosaicCell)
- QuickNoteCard.vue (replaced by MosaicCell .note variant)

The /timeline/[year]/[month] route uses PolaroidCard / QuickNoteCard
in some configurations; sub-plan #5 (month view) re-skins that route
to use TimelineMosaic + MonthSpreadHeader. Until then, any minimal
patches required to keep the route alive are included here."
```

---

## Task 10: Manual sweep + final verification

**Files:** None modified — pure verification.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`. Log in.

- [ ] **Step 2: Walk `/timeline` in dark and light modes at desktop + mobile**

For each combination, confirm:
- Year ribbon renders with italic suffix on the current and previous years.
- Month rows render with uppercase letter-spaced mono.
- Grid shows 3 cols at mobile (~375px), 4 at desktop (~1280px).
- A mix of square / wide / tall photo cells (≈72/15/13). Watching for >5 wide cells in a row would signal hash distribution drift — investigate if so.
- `.note` cells render Instrument Serif open quote, body text clamped, mono footer.
- Hover on a photo cell brightens (dark) / darkens (light) and scales 1.04.
- Click on any cell opens the existing modal (modal redesign is sub-plan #3).
- Year pill at top updates as you scroll.
- Jump-to-year + jump-to-month from the header still work.
- Scroll to the bottom — load-more fires.

- [ ] **Step 3: Walk `/timeline/2026/4` (or any month with data)**

This route uses `PolaroidCard` / `QuickNoteCard` until sub-plan #5. With those files deleted, the page should still render (the minimal patch from Task 9 Step 3 keeps it alive) — verify it doesn't 500. The full redesign comes in sub-plan #5.

- [ ] **Step 4: Verify the test suite**

```bash
pnpm test
pnpm test:e2e
```

Expected: all green.

- [ ] **Step 5: Document any regressions for follow-up**

If you find a visual issue that's clearly in scope for this sub-plan, fix it now (small CSS tweak in `TimelineMosaic.vue` or `MosaicCell.vue`). If it's a layout question that touches the spec, STOP and discuss with the controller — do not redesign the cell.

---

## Task 11: Push branch and open PR

**Files:** None modified.

- [ ] **Step 1: Verify the suite is green**

```bash
pnpm test
pnpm test:e2e
```

- [ ] **Step 2: Push the branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open the PR**

If `gh` is available:

```bash
gh pr create --base dev --title "Timeline Mosaic — replace polaroid with unified grid" --body "$(cat <<'EOF'
## Summary

Replaces `TimelinePolaroid` with `TimelineMosaic` — a single CSS grid that scales by column count (3 mobile / 4 desktop) via media query. Deletes the polaroid component family. Loads the new fonts. Adds the year-ribbon italic-suffix i18n keys.

- New components: `TimelineMosaic.vue`, `MosaicCell.vue`.
- New helper: `mosaicVariant()` in `useTimeline.ts` — deterministic hash → square / wide / tall.
- Page swap in `pages/timeline/index.vue`.
- Deleted: `TimelinePolaroid.vue`, `PolaroidCard.vue`, `QuickNoteCard.vue`.
- Fonts: Hanken Grotesk, JetBrains Mono, Instrument Serif (italic) — added; Caveat removed.
- i18n: `timeline.thisYearSuffix` / `timeline.lastYearSuffix` in en, zh-CN, fr.

This is **sub-plan #2 of 7** from the [timeline-redesign spec](docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md). Stacks on sub-plan #1 (theme repaint). The memory modal still opens (existing `MemoryShell`) — modal redesign is sub-plan #3. The `/timeline/[year]/[month]` route gets a placeholder; full redesign is sub-plan #5.

## Test plan

- [x] `pnpm test` passes — new `unit/mosaicVariant.test.ts` (determinism + distribution) + existing unchanged.
- [x] `pnpm test:e2e` passes — new `tests/timeline-mosaic-viewports.spec.ts` + updates to `timeline-year`, `quick-note`, `month-overflow`.
- [x] Manual sweep: `/timeline` at desktop + mobile in both color modes — year ribbon, month rows, span variety, .note cells, hover, click, year-pill, jump menu, load-more all working.
- [ ] CI: full Playwright suite.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `gh` is unavailable, push and report the compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...<branch-name>`.

- [ ] **Step 4: Return PR URL or compare URL**

---

## Definition of done

- [ ] `pnpm test` passes (includes `unit/mosaicVariant.test.ts`).
- [ ] `pnpm test:e2e` passes (includes `tests/timeline-mosaic-viewports.spec.ts`).
- [ ] `/timeline` renders the new mosaic in both color modes at both viewports.
- [ ] Year-pill updates on scroll; jump-to-month works; load-more triggers.
- [ ] `app/components/TimelinePolaroid.vue`, `PolaroidCard.vue`, `QuickNoteCard.vue` are deleted (`git ls-files | rg -i polaroid` returns nothing).
- [ ] Three new fonts load (verify in DevTools Network).
- [ ] PR open and CI green.

When all checked: ready to merge. Once merged, sub-plan #3 (Memory modal — extraction) can begin.

---

## Out of scope for this sub-plan

- Memory modal redesign — sub-plans #3 + #4.
- Month view (`/timeline/[year]/[month]`) — sub-plan #5. The route stays minimally functional but un-redesigned.
- Settings, members, viewer-link redesigns — sub-plans #6 + #7.
- Removing DM Sans globally — DM Sans stays in the Tailwind `font-sans` slot; a later sub-plan may swap it to Hanken Grotesk app-wide.
- Removing Playfair Display from font loading — if it appears, leave it; remove when no consumer remains.
- Email template restyling — emails are out of scope per spec §13.

---

## Risks specific to this sub-plan

- **`pages/timeline/[year]/[month].vue` deletion-cascade.** That page imports `PolaroidCard` / `QuickNoteCard`. Deleting them WILL break that route until sub-plan #5 re-skins it. The plan calls for a minimal patch in Task 9 Step 3. If the patch turns out to be non-trivial (e.g. the page has heavy custom logic that can't be re-pointed in a few lines), defer the deletion to sub-plan #5 and document that in a follow-up commit instead.
- **Span gaps in the 3-col mobile grid.** `.wide` cells at 3 columns leave a 1-column-wide gap on the next row when an adjacent cell doesn't fill it. Spec §15 notes this and suggests suppressing `.wide` on mobile as a fallback. Decide during Task 10 visual sweep.
- **IntersectionObserver re-registration on `monthGroups` change.** The `watch` block re-creates observers on every prop change. For ~50 year ribbons that's fine, but if a future feature loads thousands of years, this becomes O(N) on every load-more. Acceptable for now; flag for follow-up if perf becomes an issue.
- **Font-loading FOUC.** The new fonts load via Google Fonts at runtime. There may be a brief moment where the page renders with the system fallback before swapping. The `display=swap` directive on the URL minimizes this. If it's visually jarring, switch to `display=optional` or preload the key weights.
- **Playwright test selectors after Vue scoped CSS hashing.** Scoped CSS in `<style scoped>` blocks produces hashed attribute selectors (e.g. `.year-ribbon[data-v-abc123]`). Playwright locators using bare class names (`.year-ribbon`) still work because the rendered HTML has both the class and the hashed attribute. If tests start failing inconsistently, switch to `data-testid` attributes on the relevant elements.
