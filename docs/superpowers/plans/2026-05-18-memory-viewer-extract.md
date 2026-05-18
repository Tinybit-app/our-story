# MemoryViewer Extraction (Sub-Plan #3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve a new `MemoryViewer.vue` out of `MemoryModal.vue`. After this PR, `MemoryModal.vue` keeps only the shell glue (canClose forwarder, share-card teleport, child mount points) and the carousel state ref ownership; everything photo-related (single-item display, multi-item carousel, download/share buttons, dot rail) moves into `MemoryViewer.vue`. **No visible behavior change.** Second of four PRs (per spec §15) rebuilding the modal as Drawer + Hero (§6).

**Architecture:** `MemoryModal.vue` becomes a near-thin parent that owns `slides` / `slidesLoading` / `currentSlideIdx` refs (so both children — viewer and detail — can read them as props) plus the slide-load watcher and `onSlidesUpdate` bridge. It renders `<MemoryViewer>` above `<MemoryDetail>`. The viewer is presentational: it reads slides, emits a `current-slide-idx` event when the user scrolls, and contains all photo-region UI. State ownership stays at MemoryModal because MemoryDetail's edit mode also needs to read the same `slides` array.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §6.7 (component contract).

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3 + Vitest. No new dependencies, no DB changes, no i18n changes.

**Sub-plan position:** PR #3b of four within sub-plan #3 (modal rebuild). #3a (MemoryDetail) merged in PR #10. Remaining: #3c MemoryShell mobile drawer + `useSnapDrawer`, #3d MemoryShell desktop two-column + delete legacy modals (`MemoryModal.vue`, `QuickNoteModal.vue`).

**Spec §6.7 prop contract deferred details:** The spec's final MemoryViewer takes `memories: Memory[]`, `currentIndex: number`, and `fitMode: 'cover' | 'contain'`, with emits `navigate`, `dismiss`, `togglechrome`. Those concerns (cross-memory swipe, dismiss-with-parallax, chrome toggle) live in `MemoryShell.vue` today and will move to `MemoryViewer` in PR #3c when the drawer rewrite happens. For this PR we keep the existing single-memory contract and add the surface area incrementally.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/components/MemoryViewer.vue` | Create | Renders the photo region for a memory: single-item (photo/video/note-as-image) OR multi-item carousel (with slide-nav pill + adaptive dot indicator). Hosts download/share-with-watermark buttons. Reads `memory`, `slides`, `slidesLoading`, `currentSlideIdx` as props; emits `current-slide-idx` on scroll. |
| `app/components/MemoryModal.vue` | Modify | Shrinks to ~220 lines: shell glue (`canClose` forwarder), child mounts (`<MemoryViewer>`, `<MemoryDetail>`), share-card teleport + state + `openShareCard` + `<MilestoneShareModal>`, slide-load watcher, `onSlidesUpdate` bridge. |
| `unit/memory-viewer.test.ts` | Create | Smoke test: component mounts with the contract props for both single-item and multi-item shapes. |

Files that intentionally remain unchanged: `app/components/MemoryDetail.vue`, `app/components/MemoryShell.vue`, `app/components/QuickNoteModal.vue`, `app/components/QuickNoteForm.vue`, all pages, all i18n files.

---

## Component contract — `MemoryViewer.vue`

```ts
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

const props = defineProps<{
  memory: Memory
  slides: Slide[]
  slidesLoading: boolean
  currentSlideIdx: number
}>()

const emit = defineEmits<{
  // Fired when the user scrolls the multi-item carousel and a new slide
  // becomes visible. Parent owns `currentSlideIdx`; viewer just reports.
  'current-slide-idx': [number]
}>()
```

Spec §6.7's `memories` / `fitMode` / `navigate` / `dismiss` / `togglechrome` are explicitly deferred to PR #3c. Adding them now would introduce dead surface area.

---

## Task 1: Scaffold `MemoryViewer.vue` with the prop contract

**Files:**
- Create: `app/components/MemoryViewer.vue`
- Create: `unit/memory-viewer.test.ts`

### Step 1: Create the empty component

```vue
<template>
  <div>
    <!-- Photo region content moves in over Tasks 2-4 -->
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

defineProps<{
  memory: Memory
  slides: Slide[]
  slidesLoading: boolean
  currentSlideIdx: number
}>()

defineEmits<{
  'current-slide-idx': [number]
}>()
</script>
```

### Step 2: Write the smoke test

Create `unit/memory-viewer.test.ts` mirroring the `memory-detail.test.ts` pattern from PR #3a (same Vitest stubs for `useI18n`, `useNuxtApp`, `useSupabaseClient` — copy them verbatim from `unit/memory-detail.test.ts`):

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MemoryViewer from '~/components/MemoryViewer.vue'
import type { Memory } from '~/composables/useTimeline'

vi.stubGlobal('useI18n', () => ({ locale: ref('en'), t: (k: string) => k }))
vi.stubGlobal('useNuxtApp', () => ({ $config: { public: {} } }))
vi.stubGlobal('useSupabaseClient', () => ({
  auth: { getSession: async () => ({ data: { session: null } }) },
}))

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'm1',
    circle_id: 'c1',
    owner_user_id: 'u1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: null,
    memory_date: '2026-04-15T10:00:00Z',
    milestone_label: null,
    created_at: '2026-04-15T10:00:00Z',
    memory_children: [],
    memory_members: [],
    memorymedia: [],
    user: { first_name: 'A', last_name: 'B', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    ...overrides,
  }
}

describe('MemoryViewer', () => {
  it('mounts with a single-item memory', () => {
    const wrapper = mount(MemoryViewer, {
      props: {
        memory: makeMemory(),
        slides: [],
        slidesLoading: false,
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('mounts with a multi-item memory', () => {
    const wrapper = mount(MemoryViewer, {
      props: {
        memory: makeMemory({ media_count: 3 }),
        slides: [
          { id: '1', mediaType: 'photo', url: 'a.jpg', displayOrder: 0 },
          { id: '2', mediaType: 'photo', url: 'b.jpg', displayOrder: 1 },
          { id: '3', mediaType: 'photo', url: 'c.jpg', displayOrder: 2 },
        ],
        slidesLoading: false,
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
```

### Step 3: Run the test

```bash
pnpm test unit/memory-viewer.test.ts
```

Expected: 2 tests pass.

### Step 4: Commit

```bash
git add app/components/MemoryViewer.vue unit/memory-viewer.test.ts
git commit -m "feat(memory-viewer): scaffold MemoryViewer component shell"
```

---

## Task 2: Move the single-item photo region template

The single-item region lives at `app/components/MemoryModal.vue` template lines 4-110 (`<div v-if="(memory.media_count ?? 1) <= 1">`). It handles:
- Photo with skeleton loader and fade-in via `modalImgLoaded`
- Video with controls + autoplay
- Note-as-image fallback (when there's no media but a note exists)
- Empty-image placeholder SVG
- Download / share-with-watermark action buttons in the top-right corner

**Files:**
- Modify: `app/components/MemoryViewer.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Move the template block

Replace MemoryViewer's empty `<div>` body with the full single-item block from MemoryModal lines 4-110. Preserve all classes verbatim.

### Step 2: Move script dependencies

The moved template references `firstMedia`, `modalImgLoaded`, `t`, `downloading`, `downloadMedia`, `shareMedia`. Add to MemoryViewer's `<script setup>`:

```ts
const { t } = useI18n()

const modalImgLoaded = ref(false)
const downloading = ref(false)

const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)
```

The full `downloadMedia` and `shareMedia` function bodies move verbatim from MemoryModal (lines 468-539). They read `firstMedia.value`, `props.memory.memory_date`. No translation needed beyond making `props.memory` the source.

### Step 3: Delete the moved code from MemoryModal

Remove lines 4-110 from MemoryModal's template. Remove `modalImgLoaded`, `downloading`, `downloadMedia`, `shareMedia` from MemoryModal's script. Leave `firstMedia` in MemoryModal for now — Task 3 moves it once the multi-item template is also out.

Wait — `firstMedia` is still used by both `downloadMedia` (which is in MemoryViewer now) and by the single-item template (in MemoryViewer now). So `firstMedia` should ALSO move to MemoryViewer in this task. After Task 2, MemoryModal has no `firstMedia` consumers; delete it there.

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero TS errors. All tests pass.

### Step 5: Manual sweep

Run `pnpm dev`. Open a single-photo memory:
- Photo renders with skeleton-to-loaded fade.
- Download button → file saves to disk.
- Share-with-watermark button → triggers the share sheet (or fallback download with watermark).

Open a single-video memory:
- Video plays with controls.
- Download button works (no share button — only photos can be watermark-shared).

Open a quick-note-only memory (text only, no media):
- Note-as-image rendering kicks in (the dotted-line background with the note text centered).

### Step 6: Commit

```bash
git add app/components/MemoryViewer.vue app/components/MemoryModal.vue
git commit -m "feat(memory-viewer): move single-item photo region into MemoryViewer"
```

---

## Task 3: Move the multi-item carousel template + scroll handlers

The multi-item carousel lives at MemoryModal template lines 112-247 (`<div v-if="(memory.media_count ?? 1) > 1">`). It contains:
- Loading skeleton
- The scrollable strip of slides (photo / video / text rendering)
- The bottom-center pill: prev button + adaptive dot rail + next button
- Per-slide carousel scroll detection that updates `currentSlideIdx`

**Files:**
- Modify: `app/components/MemoryViewer.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Move the template

Move lines 112-247 of MemoryModal template into MemoryViewer, placing it BELOW the single-item block already there. Both use `v-if="(memory.media_count ?? 1) <= 1"` / `> 1` so they're mutually exclusive within MemoryViewer.

### Step 2: Move state + functions

From MemoryModal to MemoryViewer:
- `carouselRef` template ref
- `DOT_SLOT_PX`, `DOT_RAIL_WIDTH_PX` constants
- `dotRailFits`, `dotRailOffset` computeds
- `dotStyle` function
- `onCarouselScroll` function
- `goToSlide`, `nextSlide`, `prevSlide` functions

**Critical translation:** all of these currently read/write `slides.value` and `currentSlideIdx.value` (refs in MemoryModal). After moving, they must read `props.slides` and `props.currentSlideIdx` (props in MemoryViewer). And `onCarouselScroll`'s write `currentSlideIdx.value = idx` becomes `emit('current-slide-idx', idx)`.

Specifically:

```ts
// In MemoryViewer.vue:
const carouselRef = ref<HTMLDivElement | null>(null)

const DOT_SLOT_PX = 14
const DOT_RAIL_WIDTH_PX = 84

const dotRailFits = computed(
  () => props.slides.length * DOT_SLOT_PX <= DOT_RAIL_WIDTH_PX,
)

const dotRailOffset = computed(() => {
  if (props.slides.length === 0) return 0
  const totalWidth = props.slides.length * DOT_SLOT_PX
  if (totalWidth <= DOT_RAIL_WIDTH_PX) {
    return (DOT_RAIL_WIDTH_PX - totalWidth) / 2
  }
  const centered =
    DOT_RAIL_WIDTH_PX / 2 -
    DOT_SLOT_PX / 2 -
    props.currentSlideIdx * DOT_SLOT_PX
  const minOffset = DOT_RAIL_WIDTH_PX - totalWidth
  return Math.min(0, Math.max(minOffset, centered))
})

function dotStyle(idx: number) {
  if (dotRailFits.value) {
    return idx === props.currentSlideIdx
      ? { transform: 'scale(1)', opacity: 1 }
      : { transform: 'scale(1)', opacity: 0.45 }
  }
  const distance = Math.abs(idx - props.currentSlideIdx)
  const scale =
    distance === 0 ? 1 : distance === 1 ? 0.75 : distance === 2 ? 0.5 : 0.3
  const opacity =
    distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.4 : 0.2
  return { transform: `scale(${scale})`, opacity }
}

function onCarouselScroll() {
  if (!carouselRef.value) return
  const idx = Math.round(
    carouselRef.value.scrollLeft / carouselRef.value.clientWidth,
  )
  if (idx !== props.currentSlideIdx) emit('current-slide-idx', idx)
}

function goToSlide(idx: number) {
  if (!carouselRef.value) return
  carouselRef.value.scrollTo({
    left: idx * carouselRef.value.clientWidth,
    behavior: 'smooth',
  })
}

function nextSlide() {
  if (props.currentSlideIdx < props.slides.length - 1)
    goToSlide(props.currentSlideIdx + 1)
}

function prevSlide() {
  if (props.currentSlideIdx > 0) goToSlide(props.currentSlideIdx - 1)
}
```

Note the small optimization on `onCarouselScroll`: only emit when the index actually changes. Without that guard, every scroll event fires the emit, even when the user is mid-snap on the same slide. Keep the emit gated.

### Step 3: Delete from MemoryModal

Remove the carousel template (lines 112-247), the `carouselRef`, dot constants, dot computeds, scroll/nav functions. Verify with grep:

```bash
grep -nE "carouselRef|DOT_SLOT_PX|DOT_RAIL_WIDTH_PX|dotRailFits|dotRailOffset|dotStyle|onCarouselScroll|goToSlide|nextSlide|prevSlide" app/components/MemoryModal.vue
```

Expected: zero hits.

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 5: Manual sweep — multi-item carousel

Open a multi-photo memory in dev:
- Carousel renders with all photos.
- Swipe / scroll horizontally → indicator dots update.
- Tap prev / next buttons → carousel snaps to the right slide.
- Dot rail adaptively handles many slides (test with a memory of 8+ photos if available).
- Loading state appears while `/api/memories/:id/slides` fetches.

### Step 6: Commit

```bash
git add app/components/MemoryViewer.vue app/components/MemoryModal.vue
git commit -m "feat(memory-viewer): move multi-item carousel into MemoryViewer"
```

---

## Task 4: Wire `<MemoryViewer>` mount in `MemoryModal.vue`

**Files:**
- Modify: `app/components/MemoryModal.vue`

### Step 1: Add the mount

In MemoryModal's template, replace the deleted photo region (the gap left by Tasks 2 + 3) with:

```vue
<template>
  <!-- Fills the shell's flex-col card. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <MemoryViewer
      :memory="memory"
      :slides="slides"
      :slides-loading="slidesLoading"
      :current-slide-idx="currentSlideIdx"
      @current-slide-idx="currentSlideIdx = $event"
    />

    <!-- Caption section delegated to MemoryDetail -->
    <MemoryDetail
      ref="memoryDetailRef"
      :memory="memory"
      :children="children"
      :members="members"
      :current-user-id="currentUserId"
      :self-avatar-url="selfAvatarUrl"
      :self-initials="selfInitials"
      :slides="slides"
      :current-slide-idx="currentSlideIdx"
      @update="emit('update', $event)"
      @slides-update="onSlidesUpdate"
      @open-share-card="openShareCard"
      @milestone-share-prompt="shareCardData = $event"
    />
  </div>

  <!-- Milestone share card — uses its own Teleport, so position is independent -->
  <MilestoneShareModal
    v-if="shareCardData"
    :photo-url="shareCardData.photoUrl"
    :milestone-label="shareCardData.milestoneLabel"
    :memory-date="shareCardData.memoryDate"
    :child-ages="shareCardData.childAges"
    :on-demand="shareCardData.onDemand"
    @close="shareCardData = null"
  />
</template>
```

### Step 2: Import MemoryViewer

At the top of `<script setup>` in MemoryModal:

```ts
import MemoryViewer from './MemoryViewer.vue'
```

### Step 3: Final state check

Verify MemoryModal's `<script setup>` now contains only:
- Imports (Memory, Slide, computeBabyAge, MemoryDetail, MemoryViewer)
- Props/emit declarations
- `memoryDetailRef` + `canClose` forwarder + `defineExpose({ canClose })`
- `memory` computed
- `slides`, `slidesLoading`, `currentSlideIdx` refs
- Slide-load watcher (the `watch(() => props.memory?.id, ...)` block)
- `onSlidesUpdate` handler
- `ShareCardData` interface + `shareCardData` ref + `openShareCard` function

Expected file size: ~220 lines (was 542 before this PR).

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: 590 tests pass + 2 new from Task 1 = **592**.

### Step 5: Full manual sweep

Open multiple memory types in dev and confirm:
- Single photo memory: image loads, download/share-with-watermark buttons work.
- Single video memory: video plays, download button works.
- Multi-photo carousel: scroll updates `currentSlideIdx` in MemoryModal (verify via Vue devtools if available), prev/next buttons work, dot rail updates.
- Quick-note memory (no media, just note): note-as-image fallback renders.
- Edit a memory with multiple photos. Reorder a slide. Save. Carousel reflects the new order (this exercises the MemoryDetail → MemoryModal `slides-update` → MemoryViewer prop chain).
- Open a memory with a milestone label. Click the share button. Share card opens. Close it.

### Step 6: Commit

```bash
git add app/components/MemoryModal.vue
git commit -m "feat(memory-viewer): wire MemoryViewer as MemoryModal child"
```

---

## Task 5: Sweep + final test pass

**Files:** None modified.

### Step 1: Orphan check

```bash
grep -nE "modalImgLoaded|firstMedia|downloading|downloadMedia|shareMedia|carouselRef|DOT_SLOT_PX|DOT_RAIL_WIDTH_PX|dotRailFits|dotRailOffset|dotStyle|onCarouselScroll|goToSlide|nextSlide|prevSlide" app/components/MemoryModal.vue
```

Expected: zero hits.

### Step 2: Confirm MemoryDetail untouched

```bash
git diff dev..HEAD -- app/components/MemoryDetail.vue
```

Expected: no changes.

### Step 3: Run full test suite + typecheck

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: typecheck clean, 592 tests pass.

### Step 4: One last manual sweep on the trickiest interaction

The state ownership boundary (slides at MemoryModal level, viewer reads via props) is the failure-prone interface. One more end-to-end test:

1. Open a multi-photo memory in dev.
2. Scroll the carousel to slide 3 of 5. Confirm the active dot updates and the slide nav pill shows "4 / 5" (if the counter is visible).
3. Click the pencil icon → enter edit mode.
4. Reorder: move slide 1 to position 5.
5. Save.
6. Carousel should reflect the new order. Active slide should be 0 (per `onSlidesUpdate`'s `currentSlideIdx: 0` reset on structural change).

If anything is off, the issue is almost certainly in the `slides` prop chain or `onSlidesUpdate` handler. Read the diff and reason from there.

---

## Task 6: Push + open PR

### Step 1: Push

```bash
git push -u origin HEAD
```

### Step 2: Open the PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...memory-viewer-extract`

Suggested title: `Extract MemoryViewer from MemoryModal (sub-plan #3b)`

Suggested body:

```markdown
## Summary

Second of four PRs (per spec §15) to rebuild the memory modal as a Drawer + Hero (§6). This PR is a **mechanical refactor — no intended behavior change.** Carves a new `MemoryViewer.vue` out of `MemoryModal.vue`.

After this PR:
- `MemoryModal.vue` shrinks from 542 → ~220 lines. Keeps only: canClose forwarder, child mounts (`<MemoryViewer>`, `<MemoryDetail>`), share-card teleport + state, slide-load watcher, `onSlidesUpdate` bridge.
- `MemoryViewer.vue` (new) owns: single-photo region (photo / video / note-as-image), download + share-with-watermark buttons, multi-item carousel with adaptive dot indicator, scroll-to-update emit.
- `MemoryDetail.vue` is untouched.
- `MemoryShell.vue` is untouched.

State ownership: `slides`, `slidesLoading`, `currentSlideIdx` stay in `MemoryModal` because `MemoryDetail`'s edit mode also reads them. The viewer reads via props and emits `current-slide-idx` on scroll for one-way data flow.

## Contract deviation from spec §6.7

The spec's final `MemoryViewer` contract names `memories: Memory[]`, `currentIndex: number`, `fitMode: 'cover' | 'contain'` and emits `navigate`, `dismiss`, `togglechrome`. Those concerns currently live in `MemoryShell.vue` and move to `MemoryViewer` in PR #3c alongside the drawer rewrite. For this PR, only the existing single-memory carousel concerns move.

## What changed

- **New:** `app/components/MemoryViewer.vue` (~270 lines).
- **Modified:** `app/components/MemoryModal.vue` reduced by ~320 lines.
- **New tests:** `unit/memory-viewer.test.ts` — single-item and multi-item mount smokes.

## Test plan
- [x] `pnpm test` (592).
- [x] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep: single photo (image + download + share), single video (autoplay + download), multi-photo carousel (scroll + dots + prev/next), quick-note memory (note-as-image fallback), edit multi-photo memory and reorder/save (verify carousel reflects new order).

## Out of scope

- PR #3c: `MemoryShell.vue` mobile drawer rewrite + `useSnapDrawer`.
- PR #3d: Desktop two-column layout + delete `MemoryModal.vue` + `QuickNoteModal.vue`.
- Monochrome restyling of the modal — happens alongside the layout rewrite in #3c/#3d.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] `MemoryViewer.vue` exists with the agreed prop contract.
- [ ] `MemoryModal.vue` no longer contains the single-item photo region, multi-item carousel, download/share handlers, dot indicator computeds, or carousel scroll/nav functions.
- [ ] `pnpm test` passes (592).
- [ ] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep passes for: single photo / single video / multi-photo / quick-note / edit-with-reorder.
- [ ] PR open and CI green.

---

## Risks

- **`currentSlideIdx` round-trip latency.** Scroll triggers `onCarouselScroll` in MemoryViewer → emits `current-slide-idx` → MemoryModal updates its ref → flows back as a prop → MemoryViewer re-renders the dot indicator. This adds one Vue tick of latency vs. the current direct mutation. Spring-snap CSS should hide it; if visible jitter appears in practice, mitigations: (a) keep `currentSlideIdx` as a local-shadow ref inside MemoryViewer for immediate UI update + still emit for the parent's record, (b) keep the ref in MemoryModal but use `defineModel` (Vue 3.4+) so updates feel synchronous.
- **`firstMedia` no longer accessible from MemoryModal.** If MemoryModal needed it for anything (e.g. `openShareCard` reads `props.memory.memorymedia` directly, not `firstMedia`, so it's fine), confirm during the orphan check. The `openShareCard` body uses `props.memory.memorymedia.find(...)` which doesn't depend on `firstMedia`.
- **The `<ConfirmDialog>` for discard prompts is in MemoryDetail, not MemoryModal.** This is pre-existing from PR #3a — confirming nothing in this PR breaks the chain. The viewer doesn't interact with the discard guard at all.
- **The single-item template's note-as-image fallback** uses inline CSS (background-color with `color-mix`, repeating-linear-gradient). Make sure the exact CSS moves over verbatim — Tailwind doesn't have shortcuts for these properties.
- **`modalImgLoaded` semantics:** the existing ref starts `false` and toggles `true` on image `@load`. With the component now mounted/unmounted per-memory (via the `:key` on MemoryModal in MemoryShell), the ref already resets. Behavior is preserved.
- **Test environment stubs:** new `unit/memory-viewer.test.ts` will need the same stubs as `unit/memory-detail.test.ts` (`useNuxtApp`, `useSupabaseClient`). If the implementer forgets, the mount will fail with `useNuxtApp is not defined`. Copy the stubs from the detail test verbatim.
