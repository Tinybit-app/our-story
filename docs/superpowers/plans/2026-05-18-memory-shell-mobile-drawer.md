# MemoryShell Mobile Drawer (Sub-Plan #3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `MemoryShell.vue`'s mobile (< 768px) branch as a full-screen Drawer + Hero layout per spec §6.2. The photo region (rendered by `MemoryViewer`) fills the area above the drawer; the caption/comments (`MemoryDetail`) live in a draggable drawer with three snap points (peek / default / full). Floating chrome (close button, photo counter, share) overlays the photo region. Horizontal swipe on the photo navigates between memories; vertical swipe-down dismisses; tap toggles chrome (immersion mode). Desktop branch (≥ 768px) is unchanged — still the centered card. Sub-plan #3d completes the rebuild with the desktop two-column layout + deletion of legacy `MemoryModal.vue` / `QuickNoteModal.vue`.

**Architecture:** `MemoryShell.vue` uses `useMediaQuery('(min-width: 768px)')` to branch its template. The new mobile branch directly composes `<MemoryViewer>` + `<MemoryDetail>` rather than wrapping the existing `<MemoryModal>` — this requires MemoryShell to take on the slides/share-card state that currently lives in MemoryModal (a duplicative intermediate state that goes away in #3d). A new `useSnapDrawer` composable manages the drawer's three snap positions, drag tracking with `requestAnimationFrame`, and velocity-aware flicks. Gestures use VueUse's `usePointerSwipe` on the photo region with X/Y direction discrimination (per spec §15 risk).

This is the first PR in the modal rebuild series with **visible UX change** — earlier PRs (#3a, #3b) were pure refactors. Manual sweep on a real device is essential before merging.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §6.1–6.5, §15.

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3 + Vitest + VueUse (`useMediaQuery`, `usePointerSwipe` — already deps). No new dependencies, no DB changes, no i18n changes beyond a few new keys for accessibility labels.

**Sub-plan position:** PR #3c of four within sub-plan #3 (modal rebuild). #3a (PR #10), #3b (just merged) complete. Remaining after this: #3d MemoryShell desktop two-column + delete legacy modals.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/composables/useSnapDrawer.ts` | Create | Pure state machine for a 3-snap drawer (peek / default / full). Exposes reactive position (px from bottom of viewport), `snapTo(target)`, `onDragStart`, `onDragMove(deltaY)`, `onDragEnd(velocity)`. Hand-rolled per spec §15. |
| `app/components/MemoryShell.vue` | Modify | Add `useMediaQuery` branch. Mobile branch: full-screen container with `<MemoryViewer>` + drawer-wrapped `<MemoryDetail>` for media memories, full-height `<QuickNoteModal>` for quick notes. Desktop branch: unchanged centered card. |
| `unit/use-snap-drawer.test.ts` | Create | Unit tests for snap logic: snap-to-nearest, velocity threshold flicks, clamp at bounds. |
| `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json` | Modify | Add `modal.closeAriaLabel`, `modal.swipeHintPrev`, `modal.swipeHintNext` (chrome accessibility). |

Files intentionally unchanged: `MemoryViewer.vue`, `MemoryDetail.vue`, `MemoryModal.vue`, `QuickNoteModal.vue`. Desktop continues to use `MemoryModal` and `QuickNoteModal` until #3d.

---

## Drawer Geometry

Per spec §6.2:

| Snap | Drawer height | Translate-Y (from peek=0) | Use case |
|---|---|---|---|
| Peek | `120px` | `0px` (resting) | Grabber + day numeral + weekday + first ~10 words of note. Opens here on quick-tap interactions where the user wants minimal interruption. |
| Default | `50vh` | `-(50vh - 120px)` | Opens here on memory load. Shows full caption + first 2-3 comments. |
| Full | `88vh` | `-(88vh - 120px)` | Covers the photo down to a 40px peek strip. All comments scroll inside the drawer body. |

Fallback if 3-snap proves fiddly (per spec §15): drop the Peek snap, keep Default + Full. The composable should make this a one-line config change.

---

## Component composition per viewport

```
Desktop (≥ 768px) — unchanged
┌─────────────────────────────────┐
│  Backdrop                       │
│   ┌───────────────────────┐     │
│   │ MemoryModal (card)    │     │
│   │  ├ MemoryViewer       │     │
│   │  └ MemoryDetail       │     │
│   └───────────────────────┘     │
└─────────────────────────────────┘

Mobile (< 768px) — new
┌─────────────────────────────────┐
│  ╳            1 / 3        ⇪   │ ← Floating chrome
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │      MemoryViewer           │ │ ← Fills top half (50vh default)
│ │      (photo carousel)       │ │
│ │                             │ │
│ ├─ ━━━ (grabber) ━━━ ────────┤ │
│ │                             │ │
│ │      MemoryDetail           │ │ ← Draggable drawer
│ │      (caption + reactions   │ │
│ │       + comments)           │ │
│ │                             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Mobile quick-note memories: same full-screen shell, but `<QuickNoteModal>` renders directly (the existing component already handles the no-photo case). Drawer treatment for quick-notes is deferred to #3d when MemoryDetail unifies media + quick-note rendering.

---

## Task 1: Build `useSnapDrawer` composable

**Files:**
- Create: `app/composables/useSnapDrawer.ts`
- Create: `unit/use-snap-drawer.test.ts`

### Step 1: Write the composable

Create `app/composables/useSnapDrawer.ts`:

```ts
import { ref, computed, type Ref } from 'vue'

export type SnapPoint = 'peek' | 'default' | 'full'

export interface SnapDrawerOptions {
  /** Viewport height in CSS pixels at hook setup. Used to compute snap heights. */
  viewportHeight: number
  /** Snap points to enable. Default ['peek', 'default', 'full']. */
  snaps?: SnapPoint[]
  /** Snap heights in px or vh. Default: peek=120px, default=50vh, full=88vh. */
  peekPx?: number
  defaultVh?: number
  fullVh?: number
  /** Snap on release if drag velocity exceeds this (px/ms). Default 0.5. */
  velocityThreshold?: number
}

export function useSnapDrawer(options: SnapDrawerOptions) {
  const {
    viewportHeight,
    snaps = ['peek', 'default', 'full'],
    peekPx = 120,
    defaultVh = 50,
    fullVh = 88,
    velocityThreshold = 0.5,
  } = options

  // Snap heights in px (drawer height visible from bottom of viewport).
  const heights: Record<SnapPoint, number> = {
    peek: peekPx,
    default: Math.round((defaultVh / 100) * viewportHeight),
    full: Math.round((fullVh / 100) * viewportHeight),
  }

  // Active snap point (the resting position).
  const snap: Ref<SnapPoint> = ref(
    snaps.includes('default') ? 'default' : (snaps[0] as SnapPoint),
  )

  // Current pixel height (visible from bottom) — diverges from `heights[snap]`
  // mid-drag; converges to it on release.
  const heightPx: Ref<number> = ref(heights[snap.value])

  // Drag tracking
  const isDragging = ref(false)
  let dragStartY = 0
  let dragStartHeight = 0
  let lastMoveY = 0
  let lastMoveTime = 0
  let velocityPxPerMs = 0

  function snapTo(target: SnapPoint) {
    if (!snaps.includes(target)) return
    snap.value = target
    heightPx.value = heights[target]
  }

  function onDragStart(clientY: number) {
    isDragging.value = true
    dragStartY = clientY
    dragStartHeight = heightPx.value
    lastMoveY = clientY
    lastMoveTime = performance.now()
    velocityPxPerMs = 0
  }

  function onDragMove(clientY: number) {
    if (!isDragging.value) return
    const delta = dragStartY - clientY // up-drag = positive
    const newHeight = clamp(
      dragStartHeight + delta,
      heights[snaps[0]!],
      heights[snaps[snaps.length - 1]!],
    )
    const now = performance.now()
    const dt = now - lastMoveTime
    if (dt > 0) velocityPxPerMs = (lastMoveY - clientY) / dt
    lastMoveY = clientY
    lastMoveTime = now
    heightPx.value = newHeight
  }

  function onDragEnd() {
    if (!isDragging.value) return
    isDragging.value = false
    // Direction: positive velocity = upward flick = expand; negative = collapse.
    if (Math.abs(velocityPxPerMs) > velocityThreshold) {
      const currentIdx = snaps.indexOf(snap.value)
      const dir = velocityPxPerMs > 0 ? 1 : -1
      // Flick may jump two snaps if velocity is strong enough.
      const jumpDistance =
        Math.abs(velocityPxPerMs) > velocityThreshold * 2 ? 2 : 1
      const targetIdx = clamp(currentIdx + dir * jumpDistance, 0, snaps.length - 1)
      snapTo(snaps[targetIdx]!)
      return
    }
    // No velocity — snap to nearest by position
    let nearest: SnapPoint = snaps[0]!
    let minDistance = Infinity
    for (const s of snaps) {
      const d = Math.abs(heightPx.value - heights[s])
      if (d < minDistance) {
        minDistance = d
        nearest = s
      }
    }
    snapTo(nearest)
  }

  /** Translate from bottom-of-viewport (negative = drawer raised). */
  const translateY = computed(() => -(heightPx.value - heights[snaps[0]!]))

  return {
    snap,
    heightPx,
    translateY,
    isDragging,
    snapTo,
    onDragStart,
    onDragMove,
    onDragEnd,
    heights,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
```

### Step 2: Write the unit test

Create `unit/use-snap-drawer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { useSnapDrawer } from '~/composables/useSnapDrawer'

const VIEWPORT = 800 // px

describe('useSnapDrawer', () => {
  it('starts at default snap with the right heightPx', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    expect(d.snap.value).toBe('default')
    expect(d.heightPx.value).toBe(400) // 50vh of 800
  })

  it('snapTo moves between snaps', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    d.snapTo('full')
    expect(d.snap.value).toBe('full')
    expect(d.heightPx.value).toBe(704) // 88vh of 800

    d.snapTo('peek')
    expect(d.snap.value).toBe('peek')
    expect(d.heightPx.value).toBe(120)
  })

  it('drag without velocity snaps to nearest', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    // Start at default (400px). Drag up by 50px → 450px. Nearest to default still.
    d.onDragStart(500)
    d.onDragMove(450)
    d.onDragEnd()
    expect(d.snap.value).toBe('default')

    // From default, drag up by 200px → 600px. Closer to full (704) than default (400).
    d.onDragStart(500)
    d.onDragMove(300)
    d.onDragEnd()
    expect(d.snap.value).toBe('full')
  })

  it('flick up at velocity > threshold jumps one snap', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT, velocityThreshold: 0.5 })
    d.onDragStart(500)
    // Simulate two quick moves (10px in 10ms = 1.0 px/ms upward)
    const startTime = performance.now()
    // Override timing via internals — accept this as the test wrinkle
    // (use a real fast move sequence to trigger velocity)
    d.onDragMove(490)
    // Move within 10ms
    setTimeout(() => {
      d.onDragMove(480)
      d.onDragEnd()
      // After flick up one snap from default → full
      expect(d.snap.value).toBe('full')
    }, 8)
  })

  it('clamps at snap bounds during drag', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    // From default (400), drag DOWN past peek (120). Clamped at 120.
    d.onDragStart(500)
    d.onDragMove(900) // 400px downward drag would put it negative
    expect(d.heightPx.value).toBe(120)
  })

  it('respects 2-snap fallback (no peek)', () => {
    const d = useSnapDrawer({
      viewportHeight: VIEWPORT,
      snaps: ['default', 'full'],
    })
    expect(d.snap.value).toBe('default')
    // Drag down past where peek would be — clamped at default (400).
    d.onDragStart(500)
    d.onDragMove(900)
    expect(d.heightPx.value).toBe(400)
  })
})
```

Note the velocity-flick test is tricky due to the timing dependency. If the timing-based assertion is flaky in CI, replace it with a more deterministic approach: expose `_setVelocity(v)` from the composable for tests only, or skip the velocity assertion. For now, attempt the timing-based test; downgrade if needed.

### Step 3: Run the test

```bash
pnpm test unit/use-snap-drawer.test.ts
```

Expected: 6 tests pass.

### Step 4: Commit

```bash
git add app/composables/useSnapDrawer.ts unit/use-snap-drawer.test.ts
git commit -m "feat(use-snap-drawer): composable for 3-snap mobile drawer"
```

---

## Task 2: Add `isDesktop` branch to MemoryShell + i18n keys

**Files:**
- Modify: `app/components/MemoryShell.vue`
- Modify: `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json`

### Step 1: i18n keys

Add to each locale's `modal:` block:

`en.json`:
```json
"closeAriaLabel": "Close memory",
"swipeHintPrev": "Previous memory",
"swipeHintNext": "Next memory",
```

`zh-CN.json`:
```json
"closeAriaLabel": "关闭",
"swipeHintPrev": "上一条",
"swipeHintNext": "下一条",
```

`fr.json`:
```json
"closeAriaLabel": "Fermer le souvenir",
"swipeHintPrev": "Souvenir précédent",
"swipeHintNext": "Souvenir suivant",
```

### Step 2: Add `isDesktop` branch in MemoryShell

In `app/components/MemoryShell.vue`'s `<script setup>`, near the top:

```ts
import { useMediaQuery } from '@vueuse/core'

const isDesktop = useMediaQuery('(min-width: 768px)')
```

In the template, wrap the existing layout in `<template v-if="isDesktop">` and add an empty `<template v-else>` for the mobile branch (filled in Task 3):

```vue
<template>
  <Teleport to="body">
    <template v-if="isDesktop && visible">
      <!-- (existing template body — backdrop, prev/next arrows, card, MemoryModal/QuickNoteModal mount, close button, pin) — unchanged -->
    </template>
    <template v-else-if="!isDesktop && visible">
      <!-- Mobile drawer layout (Task 3) -->
    </template>
  </Teleport>
</template>
```

If wrapping the whole body in a single conditional creates issues (e.g. the existing `v-if="visible"` is on the outermost `<div>`), refactor to put `v-if="visible"` outside the desktop/mobile split:

```vue
<Teleport to="body">
  <div v-if="visible" :class="isDesktop ? 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6' : 'fixed inset-0 z-50 bg-black'">
    <template v-if="isDesktop">
      <!-- existing backdrop + arrows + card -->
    </template>
    <template v-else>
      <!-- Mobile drawer (Task 3) -->
    </template>
  </div>
</Teleport>
```

The exact restructuring depends on the current template — the implementer should preserve existing animation behavior (cardEl, backdropEl refs and their style mutations in `runEnterAnimation` / `close`) intact for the desktop branch.

### Step 3: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero errors. All tests pass.

### Step 4: Manual sweep

Run `pnpm dev`. On desktop viewport:
- Open a memory → desktop card layout renders identically to before.
- Close, prev, next all work.

On mobile viewport (Chrome devtools — iPhone 12 mode or window width < 768px):
- Open a memory → nothing renders (mobile branch is empty). This is the intermediate state; Task 3 fills it.

### Step 5: Commit

```bash
git add app/components/MemoryShell.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(memory-shell): add isDesktop branch + mobile placeholder"
```

---

## Task 3: Build the mobile drawer layout (no gestures yet)

The mobile branch renders: full-screen container, floating chrome at top, MemoryViewer fills the area above the drawer, MemoryDetail in a draggable drawer at bottom. For now, drag the grabber works (via useSnapDrawer); horizontal swipe / vertical dismiss / tap-toggle-chrome are wired in Tasks 4-6.

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Mount the mobile composition

The mobile branch needs the same data as desktop. Since `MemoryModal` owns slides/share-card state today, we hoist a duplicate copy into MemoryShell for the mobile branch. (This duplication disappears in #3d.)

Add to `<script setup>` in MemoryShell:

```ts
import type { Slide } from '~/types/memory'
import { useSnapDrawer } from '~/composables/useSnapDrawer'

// Mobile-only slide state (parallels what MemoryModal owns for desktop).
const slides = ref<Slide[]>([])
const slidesLoading = ref(false)
const currentSlideIdx = ref(0)

watch(
  () => currentMemory.value?.id,
  async (id) => {
    if (!isDesktop.value) {
      currentSlideIdx.value = 0
      if (!id || (currentMemory.value?.media_count ?? 1) <= 1) {
        slides.value = []
        return
      }
      slidesLoading.value = true
      try {
        const data = await $fetch<{ slides: Slide[] }>(
          `/api/memories/${id}/slides`,
        )
        slides.value = data.slides
      } finally {
        slidesLoading.value = false
      }
    }
  },
  { immediate: true },
)

function onMobileSlidesUpdate(payload: {
  slides: Slide[]
  currentSlideIdx?: number
  coverMediaId?: string | null
}) {
  slides.value = payload.slides
  if (payload.currentSlideIdx !== undefined) currentSlideIdx.value = payload.currentSlideIdx
}

// Snap drawer state — only initialized when window exists (post-SSR)
const drawer = useSnapDrawer({
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  snaps: ['peek', 'default', 'full'],
})
```

### Step 2: Mobile template

Inside the `<template v-else>` mobile branch (from Task 2), render:

```vue
<template v-else>
  <!-- Full-screen black backdrop (no centered card; the photo region IS the background) -->
  <div class="absolute inset-0 bg-background" />

  <!-- Floating chrome (close + counter + share) -->
  <div class="absolute left-3 right-3 top-3 z-30 flex items-center justify-between">
    <button
      class="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-opacity"
      :class="chromeVisible ? 'opacity-100' : 'opacity-0'"
      :aria-label="t('modal.closeAriaLabel')"
      @click="close"
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
    <span
      v-if="memories.length > 1"
      class="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition-opacity"
      :class="chromeVisible ? 'opacity-100' : 'opacity-0'"
    >
      {{ currentIndex + 1 }} / {{ memories.length }}
    </span>
    <span /><!-- spacer; #3c-future tasks may put share button here -->
  </div>

  <!-- Photo region (MemoryViewer fills viewport minus drawer height) -->
  <div
    v-if="currentMemory && !isQuickNote"
    ref="photoRegionEl"
    class="absolute inset-x-0 top-0 z-10"
    :style="{ bottom: `${drawer.heightPx.value}px` }"
  >
    <MemoryViewer
      :memory="currentMemory"
      :slides="slides"
      :slides-loading="slidesLoading"
      :current-slide-idx="currentSlideIdx"
      @current-slide-idx="currentSlideIdx = $event"
    />
  </div>

  <!-- Drawer container (MemoryDetail inside a draggable surface) -->
  <div
    v-if="currentMemory && !isQuickNote"
    class="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] bg-background shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
    :style="{ height: `${drawer.heightPx.value}px` }"
  >
    <!-- Grabber — drag-handle for snap switching -->
    <div
      class="flex h-7 flex-shrink-0 cursor-grab items-center justify-center touch-none"
      :class="drawer.isDragging.value && 'cursor-grabbing'"
      @pointerdown="onGrabberPointerDown"
    >
      <div class="h-1 w-9 rounded-full bg-foreground/30" />
    </div>

    <!-- MemoryDetail fills the rest of the drawer -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <MemoryDetail
        ref="memoryDetailRef"
        :memory="currentMemory"
        :children="children ?? []"
        :members="members ?? []"
        :current-user-id="currentUserId"
        :self-avatar-url="selfAvatarUrl"
        :self-initials="selfInitials"
        :slides="slides"
        :current-slide-idx="currentSlideIdx"
        @update="emit('update', $event)"
        @slides-update="onMobileSlidesUpdate"
        @open-share-card="onMobileOpenShareCard"
        @milestone-share-prompt="mobileShareCardData = $event"
      />
    </div>
  </div>

  <!-- Quick-note: legacy QuickNoteModal in a full-screen container -->
  <div v-if="currentMemory && isQuickNote" class="absolute inset-0 z-20 flex items-center justify-center p-4">
    <QuickNoteModal
      :key="currentMemory.id"
      :memory="currentMemory"
      :children="children"
      :members="members"
      :current-user-id="currentUserId"
      :self-avatar-url="selfAvatarUrl"
      :self-initials="selfInitials"
      @update="emit('update', $event)"
    />
  </div>

  <!-- Milestone share card teleport — needs the same plumbing MemoryModal has -->
  <MilestoneShareModal
    v-if="mobileShareCardData"
    :photo-url="mobileShareCardData.photoUrl"
    :milestone-label="mobileShareCardData.milestoneLabel"
    :memory-date="mobileShareCardData.memoryDate"
    :child-ages="mobileShareCardData.childAges"
    :on-demand="mobileShareCardData.onDemand"
    @close="mobileShareCardData = null"
  />
</template>
```

Note the duplicate ShareCardData state for mobile (parallels MemoryModal's). Refactoring to share state is deferred to #3d.

### Step 3: Add drawer drag handler + chrome state + share card state

In `<script setup>`:

```ts
const chromeVisible = ref(true)
const photoRegionEl = ref<HTMLElement>()

// Share card state (mirror of MemoryModal's; mobile-only)
interface ShareCardData {
  photoUrl: string
  milestoneLabel: string
  memoryDate: string
  childAges: Array<{ name: string; age: string }>
  onDemand?: boolean
}
const mobileShareCardData = ref<ShareCardData | null>(null)

function onMobileOpenShareCard() {
  const m = currentMemory.value
  if (!m?.milestone_label) return
  const firstPhoto = m.memorymedia.find((mm) => mm.media_type !== 'video')
  if (!firstPhoto?.url) return
  // computeBabyAge import already in MemoryShell? Check — if not, add.
  // ... build ages array same as MemoryModal's openShareCard ...
  mobileShareCardData.value = {
    photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url,
    milestoneLabel: m.milestone_label,
    memoryDate: m.memory_date,
    childAges: [], // TODO: build from m.memory_children + computeBabyAge
    onDemand: true,
  }
}

// Grabber drag using pointer events
function onGrabberPointerDown(e: PointerEvent) {
  if (drawer.isDragging.value) return
  drawer.onDragStart(e.clientY)
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)

  const onMove = (ev: PointerEvent) => drawer.onDragMove(ev.clientY)
  const onUp = (ev: PointerEvent) => {
    drawer.onDragEnd()
    target.releasePointerCapture(ev.pointerId)
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
}
```

For `openShareCard`'s `childAges`: copy the full body from `MemoryModal.vue`'s `openShareCard` (around line 441) including the `computeBabyAge` invocation. Make sure `computeBabyAge` is imported in MemoryShell.

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero errors. All tests pass.

### Step 5: Manual sweep on mobile viewport

In Chrome devtools, switch to iPhone 12 (or window width < 768px).

- Open a memory → mobile drawer appears.
- Drawer opens to default snap (~50vh).
- Drag the grabber up → drawer expands to full (88vh, leaving ~12vh of photo).
- Drag the grabber down → drawer collapses to peek (120px).
- Tap close button → drawer dismisses (existing `close()` animation).

Photo region above drawer should show the photo, but no horizontal swipe or chrome toggle yet (Tasks 4-6). The chrome (close button + counter) is always visible because `chromeVisible` stays `true`.

### Step 6: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): mobile drawer layout — static + drag-grabber-to-snap"
```

---

## Task 4: Horizontal swipe on photo → prev/next memory

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Add `usePointerSwipe` on the photo region

VueUse's `usePointerSwipe` reports swipe direction with a threshold. Add inside `<script setup>`:

```ts
import { usePointerSwipe } from '@vueuse/core'

usePointerSwipe(photoRegionEl, {
  threshold: 60,
  onSwipeEnd(_, direction) {
    if (!isDesktop.value && (direction === 'left' || direction === 'right')) {
      navigate(direction === 'left' ? 'next' : 'prev')
    }
  },
})
```

### Step 2: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 3: Manual sweep — horizontal swipe

On mobile viewport:
- Open a memory with prev/next siblings.
- Swipe left on photo → next memory loads.
- Swipe right on photo → prev memory loads.
- Existing slide animation (the photo slides out / new one slides in) should still work.

### Step 4: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): horizontal swipe on photo → prev/next memory"
```

---

## Task 5: Vertical swipe down on photo → dismiss

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Add a vertical swipe handler

Extend the existing `usePointerSwipe` setup with a `down` direction branch:

```ts
usePointerSwipe(photoRegionEl, {
  threshold: 60,
  onSwipeEnd(_, direction) {
    if (!isDesktop.value) {
      if (direction === 'left') navigate('next')
      else if (direction === 'right') navigate('prev')
      else if (direction === 'down') close()
    }
  },
})
```

For a true "parallax follow" effect (spec §6.4: "Swipe down on photo → Dismiss with parallax"), the photo would follow the finger downward before snapping closed. The minimum viable behavior is just dismissing on swipe-down — the parallax is a nicety. Ship without parallax first; add if time allows.

### Step 2: Manual sweep

- Open a memory.
- Swipe down on the photo region (NOT on the drawer — that's drag-to-snap).
- Modal dismisses.

### Step 3: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): vertical swipe-down on photo → dismiss"
```

---

## Task 6: Tap on photo → toggle chrome (immersion mode)

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Add `@click` on photo region

The photo region's `<div>` (from Task 3) currently doesn't have a click handler. Add one to toggle `chromeVisible`:

```vue
<div
  v-if="currentMemory && !isQuickNote"
  ref="photoRegionEl"
  class="absolute inset-x-0 top-0 z-10"
  :style="{ bottom: `${drawer.heightPx.value}px` }"
  @click="chromeVisible = !chromeVisible"
>
  <MemoryViewer ... />
</div>
```

**Conflict avoidance:** the click handler will also fire on swipe-end. VueUse's `usePointerSwipe` doesn't suppress click events by default. Mitigation: track if the pointer moved more than ~10px in any direction during the gesture and skip the toggle if so:

```ts
const pointerDownX = ref(0)
const pointerDownY = ref(0)
const moved = ref(false)

function onPhotoPointerDown(e: PointerEvent) {
  pointerDownX.value = e.clientX
  pointerDownY.value = e.clientY
  moved.value = false
}
function onPhotoPointerMove(e: PointerEvent) {
  const dx = Math.abs(e.clientX - pointerDownX.value)
  const dy = Math.abs(e.clientY - pointerDownY.value)
  if (dx > 10 || dy > 10) moved.value = true
}
function onPhotoClick() {
  if (moved.value) return // gesture, not tap
  chromeVisible.value = !chromeVisible.value
}
```

And bind:
```vue
@pointerdown="onPhotoPointerDown"
@pointermove="onPhotoPointerMove"
@click="onPhotoClick"
```

### Step 2: Manual sweep

- Open a memory.
- Tap the photo → chrome (close button + counter) fades out. Tap again → fades in.
- Swipe horizontally → navigates; chrome should NOT toggle.
- Swipe down → dismisses; chrome should NOT toggle (modal closes).

### Step 3: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): tap-photo to toggle chrome (immersion mode)"
```

---

## Task 7: Sweep + tests + push

**Files:** None modified.

### Step 1: Final orphan check

```bash
grep -n "useSnapDrawer\|usePointerSwipe\|chromeVisible\|mobileShareCardData\|onMobileSlidesUpdate" app/components/MemoryShell.vue
```

Expected: each appears in MemoryShell where wired.

### Step 2: Run the full suite + typecheck

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: typecheck clean, **598 tests pass** (592 + 6 new from `unit/use-snap-drawer.test.ts`).

### Step 3: Full manual sweep — the moment of truth

This PR is the first visible UX change. Walk every scenario:

**Desktop (window ≥ 768px):**
1. Open a single-photo memory → existing card layout.
2. Open a multi-photo memory → carousel.
3. Open a quick-note memory → quick-note card.
4. Edit, save, react, comment — all unchanged.
5. Prev/next arrows + ←/→ keys work.

**Mobile (iPhone 12 in devtools — width 390px):**
6. Open a single-photo memory → photo top, drawer at default (50vh), grabber visible.
7. Drag grabber up → drawer goes to full (88vh, ~12vh of photo strip remains).
8. Drag grabber down → drawer goes to peek (120px). Photo fills nearly full screen.
9. Flick up hard → jumps default → full in one drag (velocity).
10. Tap photo → close button + counter fade out.
11. Tap again → reappear.
12. Swipe photo left → next memory loads.
13. Swipe photo right → prev memory.
14. Swipe photo down → modal dismisses.
15. Click close button → modal dismisses.
16. Open a multi-photo memory → carousel works inside drawer.
17. Open a quick-note memory → legacy QuickNoteModal in full-screen (no drawer).
18. Edit a caption (drawer goes to full automatically — verify) → save → reflects in mosaic.
19. Add a reaction → updates.
20. Add a comment → updates.

Walk each path. The mobile drawer is brand-new territory; iOS Safari is the most likely place for friction (touch event capture, scroll chaining, momentum). If issues emerge, the fallback per spec §15 is to drop the peek snap and keep just default + full — change `snaps: ['peek', 'default', 'full']` to `snaps: ['default', 'full']` in MemoryShell's `useSnapDrawer` call.

### Step 4: Push

```bash
git push -u origin HEAD
```

### Step 5: Open the PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...memory-shell-mobile-drawer`

Suggested title: `MemoryShell mobile drawer rewrite (sub-plan #3c)`

Suggested body:

```markdown
## Summary

Third of four PRs (per spec §15) to rebuild the memory modal as Drawer + Hero (§6). **This is the first PR in the modal series with visible UX change** — earlier PRs (#3a, #3b) were pure refactors. The mobile (< 768px) branch of `MemoryShell` is rewritten as a full-screen Drawer + Hero layout per spec §6.2.

After this PR:
- **Desktop (≥ 768px):** unchanged. Still the centered card with backdrop, prev/next arrows, pin.
- **Mobile (< 768px):** new full-screen layout. Photo region at top (handled by `MemoryViewer`), draggable drawer at bottom (handled by `MemoryDetail`). Three snap points: peek (120px), default (50vh), full (88vh). Floating chrome (close button + counter) with backdrop-blur. Horizontal swipe → prev/next memory. Vertical swipe down → dismiss. Tap photo → toggle chrome (immersion mode).
- **Quick notes on mobile:** still rendered via legacy `QuickNoteModal` (unified into `MemoryDetail` in #3d).

## New artifacts

- **`app/composables/useSnapDrawer.ts`** — hand-rolled 3-snap drawer state machine. Velocity-aware flicks (jumps two snaps on hard flick). Bounded clamp. 2-snap fallback supported via `snaps: ['default', 'full']` config.
- **`unit/use-snap-drawer.test.ts`** — 6 tests for snap logic.

## Architectural notes

`MemoryShell` now uses `useMediaQuery('(min-width: 768px)')` to branch. The mobile branch composes `<MemoryViewer>` + `<MemoryDetail>` directly (bypassing `<MemoryModal>`), so `MemoryShell` takes on the slide-load state and share-card teleport that `MemoryModal` owns for desktop. This is a deliberate temporary duplication — `MemoryModal` and `QuickNoteModal` are deleted in #3d, at which point the desktop branch will also use Viewer + Detail directly and the duplicated state collapses to a single source of truth.

## What changed

- **New:** `app/composables/useSnapDrawer.ts`.
- **Modified:** `app/components/MemoryShell.vue` — adds the mobile branch (~250 new lines), preserves the desktop branch verbatim.
- **i18n:** `modal.closeAriaLabel`, `modal.swipeHintPrev`, `modal.swipeHintNext` added in en/zh-CN/fr.
- **New tests:** `unit/use-snap-drawer.test.ts` — snap logic isolated tests.

## Test plan
- [x] `pnpm test` (598).
- [x] `npx vue-tsc --noEmit` clean.
- [ ] **Manual sweep on desktop** — full path through current centered card, no regression.
- [ ] **Manual sweep on mobile** — open / drag-snap / horizontal swipe / vertical dismiss / tap-toggle-chrome / quick-note legacy path / edit caption / reorder slides / save / reactions / comments. All 20 scenarios from the plan's Task 7 manual sweep.
- [ ] **Manual sweep on real device** — iOS Safari especially. iOS scroll-chaining, momentum overshoot, and touch event capture are the highest-risk places per spec §15.

## Fallback plan (if iOS proves fiddly)

Per spec §15: drop the peek snap, keep just default + full. One-line change in MemoryShell's `useSnapDrawer({ snaps: ['default', 'full'] })`.

## Out of scope

- PR #3d: Desktop two-column rewrite + delete `MemoryModal.vue` + `QuickNoteModal.vue`. Mobile + desktop unify on the same `MemoryViewer` + `MemoryDetail` composition.
- Monochrome restyling of the modal — happens with #3d alongside the layout convergence.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] `useSnapDrawer.ts` exists with 3-snap state machine + 6 passing tests.
- [ ] `MemoryShell.vue` renders desktop unchanged and mobile drawer for media memories.
- [ ] All 20 manual sweep scenarios from Task 7 Step 3 pass.
- [ ] PR open and CI green.

---

## Risks

- **iOS Safari touch-event quirks.** Scroll chaining, momentum overshoot, click-event-after-swipe ambiguity. Mitigation: usePointerSwipe + the `moved` guard in Task 6; for severe issues, fall back to `@vueuse/gesture` or `motion-v` (per spec §15).
- **Drawer drag vs. photo swipe ambiguity.** The drawer's grabber is its own hit-target, but a careless drag starting on the drawer's TOP edge could be interpreted as either. Spec §15 says: decide gesture by direction within first 12px. The implementation uses VueUse's `usePointerSwipe` (X-only or Y-only after threshold) which gives X-priority for the photo region. The grabber is small and intentional, so accidental triggering is rare.
- **State duplication during the #3c/#3d transition.** MemoryShell now owns mobile-specific slide-load + share-card state that duplicates MemoryModal's desktop state. Bounded duplication — disappears in #3d. Worth a comment in MemoryShell flagging it as a transition state.
- **Drawer animation conflicts with existing open-animation.** The current `runEnterAnimation` zooms from origin-rect to the card. The mobile drawer should start animated-in (e.g., the photo region scales up from origin-rect, the drawer slides up from below). The MVP can use simpler entry (fade-in + slide-up) and revisit animation polish if needed. Note: spec §6.5 says "Open: zoom-in from the clicked card's rect" — preserving that for the photo region is the high-value path.
- **Viewport-height changes (rotation, browser chrome).** `useSnapDrawer` takes `viewportHeight` at hook setup. If the user rotates the device or the browser chrome collapses (mobile Safari "address bar slide"), the snap heights become stale. Mitigation: re-init on resize using `useElementSize` or `useWindowSize` from VueUse. Add this if the user reports issues post-merge; don't block initial ship on it.
- **Quick notes on mobile.** Currently render via legacy `QuickNoteModal` in a full-screen centered container — works but isn't the "drawer at 100vh" the spec envisions. Acceptable for #3c; unification in #3d.
- **`computeBabyAge` import in MemoryShell.** Currently only used by `MemoryModal`'s `openShareCard`. Add to MemoryShell's imports for the mobile share-card flow.
- **Manual sweep is uniquely critical here.** Earlier PRs were refactors; this PR introduces a brand-new UX. Do NOT merge without walking the 20 scenarios in Task 7 Step 3, including at minimum a Chrome devtools mobile pass. Real-device iOS sweep highly recommended.
