# MemoryShell Desktop Rewrite (Sub-Plan #3d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `MemoryShell.vue`'s desktop (≥ 768px) branch as the side-by-side **Photo + Detail** composition per spec §6.3, replacing the current centered card that wraps `<MemoryModal>`. Delete the now-unused `MemoryModal.vue` (~160 lines) and `QuickNoteModal.vue` (~1220 lines), and collapse the duplicated slide-load + share-card state that currently exists in both MemoryShell (mobile) and MemoryModal (desktop) into a single source of truth in MemoryShell. After this PR, the modal series from spec §6 is fully done.

**Architecture:** MemoryShell becomes the only host for the open modal in both viewports. It composes `<MemoryViewer>` + `<MemoryDetail>` directly — vertically stacked on mobile (already shipped in #3c), side-by-side on desktop. The desktop "card" is the two-column flex container; the existing `runEnterAnimation` (zoom from origin-rect) keeps working because `cardEl` still refs the card wrapper. For quick-note memories on desktop, the photo column is omitted — the detail column renders alone, slightly wider. Slide-load watcher + share-card state move out of MemoryModal and out of the mobile-only branch in MemoryShell into a single shared block (no more `mobile` prefix on those refs).

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §6.1 (architecture), §6.3 (desktop layout), §6.5 (animations), §6.7 (MemoryViewer contract — adds `fitMode`).

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3. No new dependencies, no DB changes. One small i18n addition for the desktop chrome aria-labels (re-use the existing `modal.swipeHintPrev` / `modal.swipeHintNext` if appropriate).

**Sub-plan position:** PR #3d of four within sub-plan #3 (modal rebuild). #3a–#3c merged. This wraps up the modal rebuild from spec §6. Independent of remaining sub-plans #6 (settings + members) and #7 (viewer link).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/components/MemoryViewer.vue` | Modify | Add `fitMode: 'cover' \| 'contain'` prop. When `'contain'` (desktop), `<img>` uses `object-contain` so portraits letterbox cleanly. Default stays `'cover'` so mobile keeps current behavior. |
| `app/components/MemoryShell.vue` | Modify | Rewrite the `v-if="isDesktop"` branch as two-column composition. Delete `<MemoryModal>` import + usage. Consolidate slide-load + share-card state (drop `mobile` prefixes; remove the `isDesktop` guard from the slide watcher). |
| `app/components/MemoryModal.vue` | Delete | All content (Viewer + Detail composition) now lives in MemoryShell directly. |
| `app/components/QuickNoteModal.vue` | Delete | Quick-note memories now render through `<MemoryDetail>` alone (no photo column on desktop, the existing mobile container on mobile). |

Files intentionally unchanged: `MemoryDetail.vue` (already handles quick-note memories — no `memorymedia` is fine; the view-mode caption renders note + reactions + comments which is exactly what's needed).

---

## Desktop layout — spec §6.3 reference

```
┌───────────────────────────────────────────────────────────────┐
│  ╳                                                            │
│                                                               │
│                                                ┌──────────┐   │
│                                                │ 12 SAT   │   │
│   ┌────────────────────────────────┐           │ 4:15 PM  │   │
│   │                                │           │ · Dao    │   │
│   │                                │           ├──────────┤   │
│   │                                │           │          │   │
│   │            PHOTO               │           │  Note    │   │
│ ←  │                                │ →         │  text…   │   │
│   │                                │           │          │   │
│   │                                │           ├──────────┤   │
│   │                                │           │ ❤️ 3      │   │
│   │                                │           │ 🥹 1      │   │
│   └────────────────────────────────┘           ├──────────┤   │
│                                                │ Comments │   │
│                                                │  Mei …   │   │
│                                                │  Lily …  │   │
│                                                ├──────────┤   │
│                                                │ Input…   │   │
│                                                └──────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Key dimensions per spec §6.3:
- Backdrop: `rgba(0,0,0,0.78)` + 6px backdrop-blur. Click to dismiss.
- Outer container: flex, items-center, justify-center, padding.
- Card: two-column flex with `gap-3`, `max-h-[85vh]`.
- Photo column: flex-1 with `min-w-0`, max ~800px width. Rounded 12px corners. 16:10 max aspect (the spec's number — we'll allow 4:3 to keep it simple and align with mobile's wrapper; a refinement to 16:10 can come later).
- Detail column: fixed width `w-[35%] min-w-[360px] max-w-[440px]`. Surface `--background`, rounded 12px, scroll-y, sticky input bar.
- Prev / Next memory buttons: 40×40px circles, floating **outside** the card on left/right edges, vertically centered. Plus `← →` keys.
- Close: top-right floating button, outside the card.
- **No pin.** The red decorative dot from the polaroid era is removed.
- Quick-note: photo column omitted; detail column rendered alone, centered, slightly wider (`w-[460px]`).

---

## Task 1: Add `fitMode` prop to MemoryViewer

**Files:**
- Modify: `app/components/MemoryViewer.vue`

### Step 1: Add the prop

```ts
const props = withDefaults(
  defineProps<{
    memory: Memory
    slides: Slide[]
    slidesLoading: boolean
    currentSlideIdx: number
    fillContainer?: boolean
    /** 'cover' (default, fills wrapper, crops to fit — mobile) vs 'contain'
     *  (letterboxes portrait photos — desktop). Spec §6.7. */
    fitMode?: 'cover' | 'contain'
  }>(),
  { fillContainer: false, fitMode: 'cover' },
)
```

### Step 2: Apply to the `<img>` and `<video>` tags

In the **single-item** photo region, the photo `<img>` currently has `object-cover`. Change to:

```vue
:class="[
  'absolute inset-0 block h-full w-full transition-opacity duration-300',
  fitMode === 'contain' ? 'object-contain' : 'object-cover',
  modalImgLoaded ? 'opacity-100' : 'opacity-0',
]"
```

Same change for the `<video>` element in the single-item region.

In the **multi-item carousel**, each slide's `<img>` and `<video>` already have `object-cover`. Same class swap.

The wrapper aspect ratio (`aspect-[4/3]` when not `fillContainer`, `h-full w-full` when `fillContainer`) stays as-is for this PR.

### Step 3: Verify the smoke tests still pass

`unit/memory-viewer.test.ts` doesn't test fitMode but should still mount without errors.

```bash
pnpm test unit/memory-viewer.test.ts
npx vue-tsc --noEmit
```

Expected: 2 tests pass, typecheck clean.

### Step 4: Commit

```bash
git add app/components/MemoryViewer.vue
git commit -m "feat(memory-viewer): add fitMode prop (cover | contain)"
```

---

## Task 2: Rewrite MemoryShell desktop branch — two-column composition

This is the largest task. We're replacing the centered-card-wrapping-MemoryModal layout with the side-by-side Photo + Detail composition.

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Survey what's in the desktop branch today

Open `app/components/MemoryShell.vue`. The desktop branch starts at `<div v-if="visible && isDesktop" ...>` (around line 4) and contains:
- Backdrop (`<div ref="backdropEl">`)
- Prev / Next arrow buttons (existing)
- Card wrapper `<div ref="cardEl">` with pin + close button + `<MemoryModal>` or `<QuickNoteModal>`

The existing `cardSizeStyle` computed in script switches card dimensions between quick-note (`max-w-[520px]`) and photo (`max-w-[750px]`). After this PR we replace that with the two-column layout's own widths.

### Step 2: Rewrite the desktop branch template

Replace the entire body of `<div v-if="visible && isDesktop" ...>` with:

```vue
<div
  v-if="visible && isDesktop"
  class="fixed inset-0 z-50 flex items-center justify-center p-6"
>
  <!-- Backdrop -->
  <div
    ref="backdropEl"
    class="absolute inset-0 cursor-pointer"
    style="
      background: rgba(0, 0, 0, 0);
      transition:
        background 300ms ease,
        backdrop-filter 300ms ease;
    "
    @click="close"
  />

  <!-- Prev arrow — outside the card, vertically centered -->
  <button
    v-if="hasPrev"
    class="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
    style="top: 50%; transform: translateY(-50%)"
    :aria-label="t('modal.swipeHintPrev')"
    @click.stop="navigate('prev')"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>

  <!-- Next arrow — outside the card, vertically centered -->
  <button
    v-if="hasNext"
    class="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
    style="top: 50%; transform: translateY(-50%)"
    :aria-label="t('modal.swipeHintNext')"
    @click.stop="navigate('next')"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </button>

  <!-- Close — top-right, outside the card -->
  <button
    class="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
    :aria-label="t('modal.closeAriaLabel')"
    @click="close"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  </button>

  <!-- Card: two-column composition (or single-column for quick-note) -->
  <div
    ref="cardEl"
    class="relative z-10 flex max-h-[85vh] gap-3 opacity-0 will-change-transform"
    @click.stop
  >
    <!-- Photo column — omitted for quick-note memories -->
    <div
      v-if="currentMemory && !isQuickNote"
      class="flex h-[80vh] w-[min(70vw,800px)] items-center justify-center overflow-hidden rounded-xl bg-card"
    >
      <Transition
        :name="navDirection === 'prev' ? 'mshell-prev' : 'mshell-next'"
        mode="out-in"
      >
        <MemoryViewer
          :key="currentMemory.id"
          :memory="currentMemory"
          :slides="slides"
          :slides-loading="slidesLoading"
          :current-slide-idx="currentSlideIdx"
          fit-mode="contain"
          fill-container
          @current-slide-idx="currentSlideIdx = $event"
          @navigate-memory="navigate($event)"
        />
      </Transition>
    </div>

    <!-- Detail column -->
    <div
      v-if="currentMemory"
      :class="[
        'flex flex-col overflow-hidden rounded-xl bg-background',
        isQuickNote
          ? 'h-[min(80vh,640px)] w-[min(90vw,460px)]'
          : 'h-[80vh] w-[min(40vw,440px)] min-w-[320px]',
      ]"
    >
      <MemoryDetail
        ref="memoryModalRef"
        :memory="currentMemory"
        :children="children ?? []"
        :members="members ?? []"
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
  </div>
</div>
```

Notes:
- No pin (`.rounded-full bg-[#d64040]`) — removed per spec §6.3.
- Card width comes from the two columns naturally — no more `cardSizeStyle`. Delete that computed in the script (Step 3).
- The two columns use `gap-3` between them — small visual separation, the backdrop shows through.
- Photo column: rounded 12px (`rounded-xl`), 80vh height, max ~800px wide. Centered content + overflow hidden keeps a contained photo from spilling.
- Detail column: rounded 12px, 80vh height (or 80vh capped to 640px for quick-note since there's no photo to anchor against), `min-w-[320px]` so it doesn't get cramped on narrower desktops.
- The `<Transition>` wrapping `<MemoryViewer>` preserves the existing photo-region nav animation between memories.
- For quick-note, photo column omitted entirely (the `v-if="!isQuickNote"` guard). Detail column gets a different width/height envelope.

### Step 3: Delete `cardSizeStyle` computed + pin element

In `<script setup>`, find the `cardSizeStyle` computed (was used by old MemoryModal-wrapping card to switch dimensions). Delete it.

In the template, the pin `<div class="absolute -top-3 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full bg-[#d64040] ...">` should be gone (already deleted as part of the rewrite above).

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero TS errors. 598 tests pass.

If TS flags missing imports or undeclared refs, address them — most likely `MemoryDetail` and `MemoryViewer` are already imported (Task 2 of #3c added them for the mobile branch); reuse those imports.

### Step 5: Manual sweep — desktop

Run `pnpm dev`. Resize browser to ≥ 768px width. Open a memory:
- Two-column layout renders: photo on left, detail on right.
- Click backdrop → modal closes.
- Click close button (top-right) → modal closes.
- Click prev / next arrows (outside the card) → navigates.
- Press ← / → → navigates.
- Press Esc → closes.
- Open a quick-note memory → only detail column renders, slightly wider.
- Open a multi-photo memory → carousel inside the photo column, native scroll **disabled** because of the JS-controlled carousel from #3c. Swipe with mouse (drag) inside the carousel → slide changes.

The runEnterAnimation should still play the zoom-from-rect animation since `cardEl` still refs the card.

### Step 6: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): desktop two-column composition replacing MemoryModal wrapper"
```

---

## Task 3: Consolidate state — single source of truth for slides + share-card

After Task 2, MemoryShell's desktop branch reads `slides`, `currentSlideIdx`, etc. from refs that are currently gated to mobile-only (the slide-load watcher has `if (isDesktop.value) return`). We need to remove that gate.

There's also the `mobileShareCardData` / `onMobileOpenShareCard` naming asymmetry — they should drop the `mobile` prefix now that the state serves both viewports.

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Remove `isDesktop` guard from the slide-load watcher

Find the watcher (around line 720-750 in the post-#3c MemoryShell). Currently:

```ts
watch(
  [() => visible.value, () => currentMemory.value?.id],
  async ([isVisible, id]) => {
    if (isDesktop.value || !isVisible) return  // ← drop the isDesktop check
    currentSlideIdx.value = 0
    // ...
  },
  { immediate: true },
)
```

Change the guard to just `if (!isVisible) return`. Slide-load now fires on both viewports.

### Step 2: Rename `mobile`-prefixed state to shared

Find and rename in `MemoryShell.vue`:
- `mobileShareCardData` → `shareCardData`
- `onMobileOpenShareCard` → `openShareCard`
- `onMobileSlidesUpdate` → `onSlidesUpdate`
- The `@milestone-share-prompt="mobileShareCardData = $event"` listener becomes `@milestone-share-prompt="shareCardData = $event"`

The mobile branch (already rendering MemoryViewer + MemoryDetail since #3c) updates its event bindings to the new names. The desktop branch (added in Task 2) uses the same names — both branches now share the same handlers.

### Step 3: Move `MilestoneShareModal` teleport

The teleport currently lives in the mobile-only `<div v-else-if="!isDesktop">` block. Move it OUTSIDE the desktop/mobile branches so it's rendered for both:

```vue
<Teleport to="body">
  <div v-if="visible && isDesktop"> ... </div>
  <div v-else-if="visible && !isDesktop"> ... </div>

  <!-- Shared milestone share card -->
  <MilestoneShareModal
    v-if="shareCardData"
    :photo-url="shareCardData.photoUrl"
    :milestone-label="shareCardData.milestoneLabel"
    :memory-date="shareCardData.memoryDate"
    :child-ages="shareCardData.childAges"
    :on-demand="shareCardData.onDemand"
    @close="shareCardData = null"
  />
</Teleport>
```

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero errors. 598 tests pass.

### Step 5: Manual sweep

- Open a desktop memory with a milestone label. Click the share-card button in the detail. Share card opens.
- Repeat on mobile (devtools narrow viewport). Same flow.
- Edit a desktop memory's slides (reorder, add, remove). Save. Carousel reflects changes.
- Same on mobile.

### Step 6: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "refactor(memory-shell): consolidate slide + share-card state across viewports"
```

---

## Task 4: Delete `MemoryModal.vue` and `QuickNoteModal.vue`

**Files:**
- Delete: `app/components/MemoryModal.vue`
- Delete: `app/components/QuickNoteModal.vue`
- Modify: `app/components/MemoryShell.vue` — remove imports
- Verify: no other consumers

### Step 1: Verify no other consumers

```bash
grep -rn "MemoryModal\|QuickNoteModal" --include="*.vue" --include="*.ts" 2>&1 | grep -v node_modules
```

Expected hits:
- `MemoryShell.vue` — uses `<MemoryModal>` and `<QuickNoteModal>` imports (delete those import lines)
- Any other hits in tests, pages, etc. — investigate and remove the dependency

If a page or component imports these directly (other than via MemoryShell), it'll need updating to either drop the import (if unused after MemoryShell changes) or switch to MemoryShell.

### Step 2: Remove imports from MemoryShell

In `MemoryShell.vue`'s `<script setup>`:

```ts
// DELETE:
// import MemoryModal from './MemoryModal.vue'
// (and remove QuickNoteModal if it was imported explicitly — likely via Nuxt auto-import)
```

Make sure `MemoryDetail` and `MemoryViewer` are still imported.

### Step 3: Delete the files

```bash
rm app/components/MemoryModal.vue app/components/QuickNoteModal.vue
```

### Step 4: Type-check + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero errors. 598 tests pass. If a test imported MemoryModal or QuickNoteModal, update or remove it.

### Step 5: Manual sweep

Walk both desktop and mobile flows once more:
- Open a media memory (single + multi-photo).
- Open a quick-note memory.
- Navigate prev/next.
- Edit + save.
- React + comment.
- Close via every path (backdrop, X, swipe-down, Esc).

### Step 6: Commit

```bash
git add -A
git commit -m "chore(modal): delete MemoryModal.vue and QuickNoteModal.vue"
```

---

## Task 5: Final sweep + push

### Step 1: File-size sanity check

```bash
wc -l app/components/MemoryShell.vue app/components/MemoryViewer.vue app/components/MemoryDetail.vue
```

Expected: MemoryShell grows by ~80-100 lines (desktop branch rewrite + sharing state). MemoryViewer + MemoryDetail unchanged or near-unchanged.

### Step 2: Orphan check

```bash
grep -nE "mobileShareCardData|onMobileOpenShareCard|onMobileSlidesUpdate|cardSizeStyle|MemoryModal|QuickNoteModal" app/components/MemoryShell.vue
```

Expected: zero hits.

### Step 3: Full test + typecheck

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: 598 tests pass, typecheck clean.

### Step 4: Full manual sweep

Walk every flow once more on both viewports. Especially:
- Single + multi-photo memories on both desktop and mobile.
- Quick-note memories on both.
- Open / close animations (zoom-from-rect on desktop; mobile parallax dismiss).
- Edit a multi-photo memory and reorder slides — verify carousel updates on both viewports.
- Discard-edits prompt when closing with unsaved changes.

### Step 5: Push

```bash
git push -u origin HEAD
```

### Step 6: Open the PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...memory-shell-desktop-rewrite`

Suggested title: `MemoryShell desktop rewrite + delete legacy modals (sub-plan #3d)`

Suggested body:

```markdown
## Summary

Fourth and final PR of sub-plan #3 — the modal rebuild from spec §6 is now complete.

- **Desktop (≥ 768px):** centered card wrapping `<MemoryModal>` becomes a side-by-side **Photo + Detail** composition per spec §6.3. Photo column on the left (rounded 12px, `object-contain` for letterboxed portraits), Detail column on the right (320–440px wide). For quick-note memories, only the detail column renders, slightly wider. Prev/next/close buttons float outside the card. Pin (red dot) removed.
- **Mobile (< 768px):** unchanged from #3c (drawer + photo).
- **`MemoryModal.vue` deleted** (was a ~160-line thin wrapper after #3a/#3b).
- **`QuickNoteModal.vue` deleted** (~1220 lines) — quick-note rendering now goes through `<MemoryDetail>` with no photo column. The previous notebook-paper aesthetic was tied to the legacy modal design and is intentionally replaced by the spec's monochrome design system.
- **State consolidated:** `slides`, `slidesLoading`, `currentSlideIdx`, `shareCardData`, `openShareCard`, `onSlidesUpdate` are now declared ONCE in MemoryShell and serve both desktop and mobile. The slide-load watcher's `isDesktop` guard is gone.
- **`MemoryViewer`** gets a new `fitMode: 'cover' | 'contain'` prop. Desktop uses `'contain'`; mobile keeps `'cover'`.

## What changed

- **Modified:** `app/components/MemoryShell.vue` — desktop branch rewritten; state consolidated.
- **Modified:** `app/components/MemoryViewer.vue` — `fitMode` prop.
- **Deleted:** `app/components/MemoryModal.vue`.
- **Deleted:** `app/components/QuickNoteModal.vue`.

## Test plan
- [x] `pnpm test` (598).
- [x] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep on **desktop** (≥ 768px): open media + quick-note memories, navigate prev/next via arrows + keyboard, edit + save, share milestone card, close via backdrop/X/Esc.
- [ ] Manual sweep on **mobile**: open + drag-snap + swipe + tap-toggle-chrome + parallax dismiss + multi-photo carousel + memory navigation past carousel edges. All flows from #3c should still work.
- [ ] Cross-viewport: open the modal at desktop width, resize browser to < 768px, verify the modal cleanly switches to mobile layout (`useMediaQuery` reactive). Same in reverse.

## Out of scope

- Settings + members pages (sub-plan #6) — independent surface, separate PR.
- Viewer link (sub-plan #7) — independent surface, separate PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] Desktop renders the new two-column composition (or single-column for quick-note).
- [ ] `MemoryModal.vue` and `QuickNoteModal.vue` are deleted.
- [ ] `mobileShareCardData` etc. renamed to drop the `mobile` prefix; state is single-source in MemoryShell.
- [ ] `MemoryViewer` has the `fitMode` prop; desktop uses `'contain'`, mobile uses default `'cover'`.
- [ ] `pnpm test` passes (598).
- [ ] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep passes on both desktop and mobile.
- [ ] PR open and CI green.

---

## Risks

- **runEnterAnimation on the new card.** The desktop open animation reads `cardEl.getBoundingClientRect()` to compute the zoom-from-rect transform. After the rewrite, `cardEl` is the two-column wrapper. The animation should still work because it manipulates the wrapper's transform/opacity/box-shadow regardless of inner structure. Verify the zoom-from-mosaic-cell-rect animation still feels right after the rewrite.
- **Quick-note design.** The legacy `QuickNoteModal.vue` had a notebook-paper aesthetic (lined background, the open-quote glyph). The new design replaces it with the standard MemoryDetail rendering on a plain monochrome card. If you want the notebook-paper aesthetic to survive on quick-notes, that's a separate polish — apply the styling inside MemoryDetail's view-mode template conditionally on `!memory.memorymedia.length`. Out of scope for the structural rewrite but easy to layer on later.
- **Photo column dimensions.** The plan uses `h-[80vh] w-[min(70vw,800px)]` for the photo column. Spec §6.3 said "16:10 max aspect" but we keep the existing `aspect-[4/3]` wrapper (via MemoryViewer's default). Visually 4:3 is more square than 16:10 — on a 1280×800 screen the photo will be a bit taller than the spec intended. Acceptable for this PR; a refinement to 16:10 is a one-line CSS change in MemoryViewer if it bothers you.
- **`<Teleport>` and multiple children.** Vue 3 `<Teleport>` supports multiple top-level children, but the `v-if` / `v-else-if` / shared `<MilestoneShareModal>` structure has to be careful — verify the share card renders when expected.
- **Cross-viewport resize during open.** If the user opens the modal on desktop and resizes to mobile (or vice versa), `useMediaQuery` flips `isDesktop` and the branch swaps. Vue tears down one and mounts the other. The shared state (slides, currentSlideIdx, shareCardData) survives because it's on MemoryShell. The `cardEl` / `backdropEl` refs become stale during the swap — verify this doesn't cause errors. If it does, gating `cardEl` mutations on `isDesktop.value` inside `runEnterAnimation` / `close` is the fix.
- **Removal of the polaroid aesthetic.** The pin and the polaroid-card look are now fully gone on desktop. If you want to keep some of that personality (e.g., a subtle paper-grain texture on the detail column), it's a future polish layered on top of the structural change.
- **i18n: re-using `swipeHintPrev` / `swipeHintNext` for desktop tap buttons.** The labels say "Previous memory" / "Next memory" which read OK as button aria-labels too. If you want desktop-specific copy (e.g. "Previous" / "Next"), add new keys.
- **Manual sweep is critical.** This rewrite touches the desktop visual identity. Test in both light and dark modes, at multiple viewport widths (768px, 1024px, 1280px, 1440px+), and with portrait + landscape photos.
