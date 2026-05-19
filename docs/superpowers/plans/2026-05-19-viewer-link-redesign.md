# Viewer Link Redesign (Sub-Plan #7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/view/[token]` public viewer page per spec §5.4 — replace the bespoke vertical-card feed with the same `TimelineMosaic` + `MemoryShell` composition used elsewhere, fronted by a new `ViewerSpreadHeader` (italic display title hero, "For Grandma" personalization, monochrome treatment). Restyle the splash, expired, and invalid states. Add a minimal "viewer-mode" prop chain through `TimelineMosaic` → `MemoryShell` → `MemoryDetail` so the modal hides owner-only affordances (edit, comments, full reactions picker) and routes a heart-react through the existing guest endpoint.

**Scope boundary — no backend changes.** The viewer endpoint currently returns a thin memory shape (`id`, `memory_date`, `note`, `signedUrl`, `mediaType`, `media_count`, `cover_text_content`) — no reactions, no comments, no rich media array. The plan adapts this to a `Memory`-compatible shape client-side in `view.vue`, and the modal in viewer mode shows a single ❤ react button (one-shot toggle, same semantic as the current per-card heart). Showing existing reaction counts in the viewer modal would require backend work and is deferred.

**Architecture:** The viewer flow now mirrors the owner flow visually — same mosaic grid, same modal — with a viewer-tinted header and a stripped-down modal interaction surface. Sub-plan #7 is independent of sub-plan #6.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §5.4 (viewer link + ViewerSpreadHeader), §6 (modal viewer-mode mentions in §6.2 and §6.6).

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3. No new dependencies, no DB changes.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/components/ViewerSpreadHeader.vue` | Create | The hero header for `/view/[token]` per spec §5.4. Compact top strip (brand kicker + sign-in pill) + italic display title block ("A private collection" / "For Grandma" / "— Mei & Dao · 38 Memories"). Pure presentational; props for owner names / link label / memory count / mode. |
| `app/components/TimelineMosaic.vue` | Modify | Add `viewerMode?: boolean` prop. When true: hide the year-pill jump menu (no app header to host it). Pass-through to existing `MosaicCell` (which doesn't need changes; the cell already renders cleanly when the memory has minimal data). |
| `app/components/MemoryShell.vue` | Modify | Add `viewerMode?: boolean`, `viewerToken?: string`, `guestName?: string` props. Pass viewerMode/guestName through to `MemoryDetail`. In viewer mode, ignore the open-share-card / milestone-share-prompt emits and hide the share-card teleport. |
| `app/components/MemoryDetail.vue` | Modify | Add `viewerMode?: boolean`, `viewerToken?: string`, `guestName?: string` props. In viewer mode: hide tab bar (caption only), hide edit pencil, hide reactions picker + comments section, render a single "❤ React" button below the caption that POSTs to `/api/reactions/guest`. Disable canClose() prompt logic in viewer mode (no edits possible). |
| `app/pages/view.vue` | Modify | Rewrite body — adapter to convert thin `ViewerTimeline.memories[]` shape to `Memory`-compatible, then render `ViewerSpreadHeader` + `<TimelineMosaic viewer-mode>` + `<MemoryShell viewer-mode>`. Restyle splash + expired + invalid in monochrome + Instrument Serif italics. Keep guest-name capture flow as-is. |
| `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json` | Modify | Add `viewerLink.privateCollection`, `viewerLink.selectedCollection`, `viewerLink.signoff` keys. |
| `tests/viewer-link.spec.ts` (if exists) | Update | Adjust selectors after the body rewrite. If no test exists today, skip. |

---

## Design intent reference

```
┌─ Our Story · From The Zheng Family ─────── Sign in ───┐    <- compact top strip
│                                                        │
│   A PRIVATE COLLECTION                                 │    <- mono uppercase label
│                                                        │
│   For Grandma                                          │    <- italic display title
│                                                        │
│   — Mei & Dao  ·  38 Memories                          │    <- italic signoff + mono meta
│                                                        │
└────────────────────────────────────────────────────────┘
[ TimelineMosaic grid — same as owner timeline ]
```

Tap a mosaic cell → opens `<MemoryShell viewer-mode>`. Modal shows photo + caption + single heart react button. Comments and edit are absent.

---

## Task 1: i18n keys + ViewerSpreadHeader component

**Files:**
- Modify: `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json`
- Create: `app/components/ViewerSpreadHeader.vue`

### Step 1: i18n keys

Add to the `viewerLink:` block in each locale.

`en.json`:
```json
"privateCollection": "A private collection",
"selectedCollection": "A selected collection",
"signoff": "— {owners}  ·  {n} memory | — {owners}  ·  {n} memories"
```

`zh-CN.json`:
```json
"privateCollection": "私人收藏",
"selectedCollection": "精选收藏",
"signoff": "— {owners}  ·  {n} 条记忆"
```

`fr.json`:
```json
"privateCollection": "Une collection privée",
"selectedCollection": "Une sélection",
"signoff": "— {owners}  ·  {n} souvenir | — {owners}  ·  {n} souvenirs"
```

(Pluralization syntax uses Vue I18n's pipe form. Chinese has no plural distinction so a single form is used.)

### Step 2: Component

Create `app/components/ViewerSpreadHeader.vue`:

```vue
<template>
  <div class="border-b border-border bg-background">
    <!-- Top strip — sticky, compact -->
    <div
      class="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md"
    >
      <div class="min-w-0">
        <p
          class="text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground"
        >
          Our Story
        </p>
        <p
          class="mt-1 truncate font-serif text-[13px] italic text-foreground/80"
        >
          {{ t('viewerLink.fromCircle', { circle: circleName }) }}
        </p>
      </div>
      <div class="flex flex-shrink-0 items-center gap-2">
        <LocalePicker guest />
        <NuxtLink
          to="/login"
          class="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ t('viewerLink.signIn') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Hero block — italic display title -->
    <div class="px-5 py-7 sm:px-8 sm:py-10">
      <p
        class="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground/70 sm:text-[11px]"
      >
        {{
          mode === 'selection'
            ? t('viewerLink.selectedCollection')
            : t('viewerLink.privateCollection')
        }}
      </p>
      <h1
        class="font-serif text-[36px] italic leading-[1.05] text-foreground sm:text-[44px]"
      >
        {{
          linkLabel
            ? t('viewerLink.forRecipient', { recipient: linkLabel })
            : t('viewerLink.forYou')
        }}
      </h1>
      <p
        v-if="ownerLabel || memoryCount > 0"
        class="mt-4 flex items-baseline gap-2 text-[12px] text-muted-foreground sm:text-[13px]"
      >
        <span v-if="ownerLabel" class="font-serif italic">{{
          `— ${ownerLabel}`
        }}</span>
        <span v-if="ownerLabel && memoryCount > 0" class="text-border">·</span>
        <span v-if="memoryCount > 0" class="font-mono tabular-nums">
          {{ t('viewerLink.memoriesCount', memoryCount, { n: memoryCount }) }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  circleName: string
  ownerLabel: string | null
  linkLabel: string | null
  memoryCount: number
  mode: 'full' | 'selection'
}>()

const { t } = useI18n()
</script>
```

Also add the supporting i18n keys this component uses (`viewerLink.fromCircle`, `viewerLink.signIn`, `viewerLink.forRecipient`, `viewerLink.forYou`, `viewerLink.memoriesCount`). Check the existing locales for any already present (e.g. `signIn` may exist) and only add missing keys:

`en.json`:
```json
"fromCircle": "From {circle}",
"signIn": "Sign in",
"forRecipient": "For {recipient}",
"forYou": "For you",
"memoriesCount": "{n} memory | {n} memories"
```

Add equivalent keys to `zh-CN.json` and `fr.json`.

### Step 3: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

Expected: zero errors, 598 tests pass.

### Step 4: Commit

```bash
git add app/components/ViewerSpreadHeader.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(viewer-link): ViewerSpreadHeader component + i18n keys"
```

---

## Task 2: TimelineMosaic `viewerMode` prop

**Files:**
- Modify: `app/components/TimelineMosaic.vue`

### Step 1: Add the prop

In `<script setup>`:

```ts
const props = withDefaults(
  defineProps<{
    monthGroups: MonthGroup[]
    loading?: boolean
    hasNextPage?: boolean
    circleType?: string | null
    circleId?: string | null
    /** When true, hides the year-pill jump button (no header to host it). */
    viewerMode?: boolean
  }>(),
  { ... existing defaults, viewerMode: false },
)
```

(Match the actual existing defaults block; just add `viewerMode: false` to it.)

### Step 2: Use the prop

In the template, find the year-pill jump button (around the year ribbon area). Wrap it in `v-if="!viewerMode"`:

```vue
<button
  v-if="!viewerMode"
  class="..."
  @click="..."
>
  <!-- year pill -->
</button>
```

There may be more than one element to gate. If the year-pill is part of a larger header element, gate the right boundary so the year ribbons still render.

The mosaic body itself stays the same — viewers see the grid identically.

### Step 3: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 4: Commit

```bash
git add app/components/TimelineMosaic.vue
git commit -m "feat(timeline-mosaic): viewer-mode prop hides year-pill"
```

---

## Task 3: MemoryDetail viewer-mode

**Files:**
- Modify: `app/components/MemoryDetail.vue`

The biggest change. In viewer mode the component:
- Hides the tab bar (always shows the caption pane)
- Hides the edit pencil button
- Hides the comments tab and any comment list
- Replaces the full reactions picker with a single "❤ React" button that POSTs to `/api/reactions/guest`
- Returns true from canClose unconditionally (no edit state to discard)

### Step 1: Add the props

```ts
const props = withDefaults(
  defineProps<{
    memory: Memory
    children: ChildProfile[]
    members: CircleMember[]
    currentUserId: string | null
    selfAvatarUrl: string | null
    selfInitials: string
    slides: Slide[]
    currentSlideIdx: number
    /** When true: hide owner-only affordances; route the single
     *  heart-react through the public guest endpoint. */
    viewerMode?: boolean
    viewerToken?: string
    guestName?: string
  }>(),
  { viewerMode: false, viewerToken: undefined, guestName: undefined },
)
```

### Step 2: Hide the tab bar in viewer mode

Find the tab bar template (around the top of `<template>`). Wrap it in `v-if="!viewerMode"`. Force `activeTab` to `'caption'` programmatically when viewerMode flips to true:

```ts
watch(
  () => props.viewerMode,
  (vm) => {
    if (vm) activeTab.value = 'caption'
  },
  { immediate: true },
)
```

### Step 3: Hide the edit pencil

The pencil button next to the caption uses `v-if="isOwner"`. Tighten:

```vue
<button v-if="isOwner && !viewerMode" ...>
```

### Step 4: Hide comments section + comment input

Find the comments list block and the sticky comment input. Wrap each in `v-if="!viewerMode"`.

### Step 5: Replace reactions picker with single heart button

Find the reactions row template. Today it renders:
- Existing reaction chip pills (counts per emoji)
- An add-reaction button that opens a 12-emoji picker

In viewer mode, replace the entire reactions row with:

```vue
<!-- Reactions -->
<div v-if="!viewerMode" class="...">
  <!-- existing owner reactions row -->
</div>

<!-- Viewer mode: single heart-react button -->
<div v-else class="px-4 pb-4">
  <button
    class="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/30 px-3 py-1.5 text-[12px] font-medium transition-all hover:border-accent/40"
    :class="
      viewerReacted
        ? 'cursor-default text-rose-500'
        : 'text-muted-foreground hover:scale-[1.02] hover:text-rose-500'
    "
    :disabled="viewerReacted || viewerReactPending"
    @click.stop="onViewerReact"
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :fill="viewerReacted ? 'currentColor' : 'none'">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
    {{ viewerReacted ? t('viewerLink.viewerReactSent') : t('viewerLink.viewerReact') }}
  </button>
</div>
```

Add state + handler in `<script setup>`:

```ts
const viewerReacted = ref(false)
const viewerReactPending = ref(false)

async function onViewerReact() {
  if (viewerReacted.value || viewerReactPending.value) return
  if (!props.viewerToken) return
  viewerReactPending.value = true
  try {
    await $fetch('/api/reactions/guest', {
      method: 'POST',
      body: {
        viewerToken: props.viewerToken,
        memoryId: props.memory.id,
        emoji: '❤️',
        guestName: props.guestName ?? undefined,
      },
    })
    viewerReacted.value = true
  } catch (err) {
    console.error('[MemoryDetail] viewer react failed:', err)
  } finally {
    viewerReactPending.value = false
  }
}

// Reset on memory change (the parent doesn't remount per memory)
watch(
  () => props.memory.id,
  () => {
    viewerReacted.value = false
  },
)
```

### Step 6: canClose is a no-op in viewer mode

Find the existing `canClose` function. Add:

```ts
async function canClose(): Promise<boolean> {
  if (props.viewerMode) return true
  if (!editing.value) return true
  if (!hasUnsavedChanges.value) return true
  return askDiscardConfirm()
}
```

### Step 7: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 8: Commit

```bash
git add app/components/MemoryDetail.vue
git commit -m "feat(memory-detail): viewer-mode (read-only + single heart react)"
```

---

## Task 4: MemoryShell viewer-mode pass-through

**Files:**
- Modify: `app/components/MemoryShell.vue`

### Step 1: Add the props

```ts
const props = withDefaults(
  defineProps<{
    memories: Memory[]
    startIndex: number | null
    originRect: DOMRect | null
    tilt: number
    children?: ChildProfile[]
    members?: CircleMember[]
    viewerMode?: boolean
    viewerToken?: string
    guestName?: string
  }>(),
  { viewerMode: false, viewerToken: undefined, guestName: undefined, ... existing defaults },
)
```

### Step 2: Pass through to MemoryDetail (both branches)

Both the desktop and mobile branches render `<MemoryDetail>`. Add the new props to each binding:

```vue
<MemoryDetail
  ref="memoryModalRef"
  :memory="currentMemory"
  ...existing props...
  :viewer-mode="viewerMode"
  :viewer-token="viewerToken"
  :guest-name="guestName"
  ...
/>
```

### Step 3: Hide share-card teleport in viewer mode

Wrap the `<MilestoneShareModal>` teleport in `v-if="!viewerMode"`:

```vue
<MilestoneShareModal
  v-if="!viewerMode && shareCardData"
  ...
/>
```

(The MemoryDetail in viewer-mode won't emit share-card events anyway since the edit flow is gone, but belt-and-suspenders.)

### Step 4: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 5: Commit

```bash
git add app/components/MemoryShell.vue
git commit -m "feat(memory-shell): viewer-mode pass-through"
```

---

## Task 5: Rewrite view.vue body — adapter + mosaic + shell

The biggest task. Replace the current vertical-card body + per-card heart button with the new ViewerSpreadHeader + TimelineMosaic + MemoryShell composition. Add a client-side adapter that converts `ViewerTimeline.memories[]` (thin shape) to `Memory[]`-compatible (rich shape) so TimelineMosaic + MemoryShell can render without backend changes.

**Files:**
- Modify: `app/pages/view.vue`

### Step 1: Build the adapter

In `<script setup>` of `view.vue`, after the existing `ViewerTimeline` interface, add:

```ts
import type { Memory } from '~/composables/useTimeline'

// Adapter: convert the thin viewer memory shape to the Memory shape used
// by TimelineMosaic + MemoryShell. Many fields are stubbed since the
// viewer endpoint doesn't return them; the modal's viewer-mode hides
// the consumers of those fields.
const adaptedMemories = computed<Memory[]>(() => {
  if (!timeline.value) return []
  return timeline.value.memories.map((m) => ({
    id: m.id,
    circle_id: '',
    owner_user_id: null,
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: m.note,
    memory_date: m.memory_date,
    milestone_label: null,
    created_at: m.memory_date,
    memory_children: [],
    memory_members: [],
    memorymedia: m.signedUrl
      ? [
          {
            id: `view-${m.id}`,
            media_type: m.mediaType === 'video' ? 'video' : 'photo',
            url: m.signedUrl,
            thumbnailUrl: m.signedUrl,
            file_size: 0,
          },
        ]
      : [],
    user: null,
    memoryreaction: [],
    memorycomment: [],
    media_count: m.media_count ?? 1,
    cover_text_content: m.cover_text_content ?? null,
  }))
})
```

This shape feeds into `useTimeline` to produce `monthGroups` for the mosaic. `MosaicCell` reads only `memory.memorymedia` and `memory.note` — both are real values from the adapter. The modal's viewer-mode hides everything else.

Use `useTimeline` to group the adapted memories:

```ts
const adaptedMemoriesRef = ref<Memory[]>([])
watchEffect(() => {
  adaptedMemoriesRef.value = adaptedMemories.value
})

const monthCountsRef = ref<Record<string, number>>({})
const { monthGroups } = useTimeline(adaptedMemoriesRef, monthCountsRef)
```

(monthCounts is empty; useTimeline falls back to bucket length per spec — matches viewer's all-memories-in-one-page behavior.)

### Step 2: Build owner label

Spec calls for "— Mei & Dao" comma-joined owner first names. The endpoint returns only `ownerFirstName` (single). Use whatever comes back as the owner label; multi-owner display is a backend follow-up.

```ts
const ownerLabel = computed(() => timeline.value?.ownerFirstName ?? null)
```

### Step 3: Replace the body

Replace the current `<main>` content (lines ~148-300ish — the mode banner, empty-state, vertical card list, referral nudge, guest-name prompt) with:

```vue
<template v-else-if="timeline">
  <ViewerSpreadHeader
    :circle-name="timeline.circleName"
    :owner-label="ownerLabel"
    :link-label="timeline.linkLabel || null"
    :memory-count="timeline.memories.length"
    :mode="timeline.mode === 'full' ? 'full' : 'selection'"
  />

  <main class="mx-auto max-w-[1280px] px-4 py-6 sm:px-5">
    <!-- Guest-name affordance (existing logic, smaller styling) -->
    <div v-if="guestName" class="mb-4 flex justify-end">
      <button
        type="button"
        @click="editGuestName"
        class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        :title="t('viewerLink.viewerChangeNameTooltip')"
      >
        <span class="max-w-[120px] truncate">{{ guestName }}</span>
        <svg ...>...</svg>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="timeline.memories.length === 0" class="py-20 text-center">
      <p class="mb-1 text-sm font-semibold text-foreground">
        {{ t('viewerLink.emptyState') }}
      </p>
      <p class="text-xs text-muted-foreground">
        {{ t('viewerLink.emptyStateBody') }}
      </p>
    </div>

    <!-- Mosaic body -->
    <TimelineMosaic
      v-else
      :month-groups="monthGroups"
      :loading="loading"
      :has-next-page="false"
      :circle-type="null"
      :circle-id="null"
      viewer-mode
      @open-memory="onOpenMemory"
    />

    <!-- Referral nudge — keep existing logic if present -->
    ...
  </main>

  <!-- Modal — viewer-mode -->
  <MemoryShell
    :memories="adaptedMemories"
    :start-index="selectedIndex"
    :origin-rect="selectedRect"
    :tilt="selectedTilt"
    viewer-mode
    :viewer-token="token"
    :guest-name="guestName || undefined"
    @close="selectedIndex = null"
  />
</template>
```

Add the modal state + handlers:

```ts
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({ memory, tilt, rect }: { memory: Memory; tilt: number; rect: DOMRect | null }) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = adaptedMemories.value.findIndex((m) => m.id === memory.id)
}
```

### Step 4: Remove dead code

The current view.vue has:
- `observeMemory(el, index)` + IntersectionObserver for the showReferral nudge
- Per-card heart react logic (`reactToMemory`, `reactedIds`, `justReactedId`, etc.)
- The pendingReactionMemoryId / guest-name modal capture flow

The per-card reactions are GONE — viewers now react via the modal. Delete the per-card reaction state and handlers. KEEP the guest-name modal capture flow (used by the new modal's first-time react too — the modal's onViewerReact will need a guest name, so the guest-name prompt before any reaction stays useful).

Actually, simpler: keep the guest-name capture invariant. The MemoryDetail's onViewerReact checks `props.guestName`. If undefined, the request still works (the endpoint accepts optional guestName). For a richer UX, we could route ALL reactions through the page-level guest-name prompt first. For initial scope: route directly through the modal. If guestName is empty, the API receives no guestName and the reaction is anonymous. The user can still set a guest name via the existing button.

### Step 5: Typecheck + tests

```bash
npx vue-tsc --noEmit
pnpm test
```

### Step 6: Manual sweep

Run `pnpm dev`. Navigate to a `/view/<token>` URL (use an existing viewer link or create one). Verify:
- Splash → tap CTA → main view.
- Header renders: brand kicker + "From [Circle]" italic, "Sign in" pill, "A private collection" / italic "For [Recipient]" / "— [Owner] · N memories".
- Mosaic body renders. Year-pill jump is hidden.
- Tap a cell → modal opens with photo, caption, single heart button. No edit, no tabs, no comments.
- Tap heart → reaction posts; button becomes "Reacted".
- Tap another cell → new memory loads; heart button resets.
- Close modal (swipe down on mobile, ✕ on desktop) → returns to mosaic.

### Step 7: Commit

```bash
git add app/pages/view.vue
git commit -m "feat(view): rewrite body — ViewerSpreadHeader + TimelineMosaic + MemoryShell"
```

---

## Task 6: Restyle splash + expired + invalid states

**Files:**
- Modify: `app/pages/view.vue`

### Step 1: Splash

The existing splash (lines ~60-110) has a dark backdrop with the latest memory photo at low opacity, "Our Story" kicker, owner name + title, CTA button. Per spec: italic display title ("Mei has shared with you"), CTA "Open the collection", monochrome treatment, Instrument Serif typography.

Restyle the existing splash:
- Background photo opacity → `0.45` for stronger feel (current `0.5` is close).
- Title: `<h1 class="font-serif text-[36px] italic ... text-white">` (Instrument Serif italic).
- Kicker: `text-[10px] tracking-[.18em] text-white/70`.
- CTA button: `bg-white text-foreground rounded-full px-6 py-3 text-sm font-semibold` (less rectangular, more refined).

### Step 2: Expired + Invalid

The existing expired/invalid blocks (lines ~30-80ish) use plain emoji + small body text. Restyle:
- Replace the emoji with a small monochrome SVG icon (clock for expired, alert for invalid).
- Title in Instrument Serif italic.
- Body in regular mono/sans.
- CTA "Ask for a fresh link" / similar in the same rounded-full pill style.

Match the design system: use `--background`, `--foreground`, `--muted-foreground` tokens (no hard-coded grays).

### Step 3: Manual sweep

- Open a valid viewer link → splash → mosaic flow (covered in Task 5).
- Visit an expired token URL → expired state renders with new styling.
- Visit an invalid token URL → invalid state renders with new styling.

### Step 4: Commit

```bash
git add app/pages/view.vue
git commit -m "style(view): restyle splash + expired + invalid in monochrome"
```

---

## Task 7: Sweep + push

### Step 1: Orphan check

```bash
grep -nE "submitReaction|reactedIds|justReactedId|observeMemory|showReferral" app/pages/view.vue
```

Some of these may legitimately remain (e.g. `submitReaction` if still used by the guest-name modal capture). Anything orphan should be deleted.

### Step 2: Typecheck + tests + manual

```bash
npx vue-tsc --noEmit
pnpm test
```

Full manual sweep across both desktop and mobile viewports for the viewer flow.

### Step 3: Push

```bash
git push -u origin HEAD
```

### Step 4: Open PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...viewer-link-redesign`

Suggested title: `Viewer link redesign — mosaic body + ViewerSpreadHeader (sub-plan #7)`

Suggested body:

```markdown
## Summary

Rebuilds the `/view/[token]` public viewer page per spec §5.4 with the same `TimelineMosaic` + `MemoryShell` composition used elsewhere, fronted by a new `ViewerSpreadHeader` with italic display title personalization.

- **New `ViewerSpreadHeader.vue`** — compact top strip + italic display title hero ("For Grandma" / "— Mei & Dao · 38 Memories").
- **`TimelineMosaic` `viewer-mode` prop** — hides year-pill jump button (no app header).
- **`MemoryShell` + `MemoryDetail` `viewer-mode` props** — hide tab bar, edit pencil, comments, full reactions picker. Show single ❤ react button that POSTs to `/api/reactions/guest`. `canClose` returns true unconditionally (no edits possible).
- **`view.vue` body rewrite** — adapter converts thin viewer memory shape to `Memory`-compatible; the mosaic + modal handle the rest.
- **Splash + expired + invalid states restyled** — Instrument Serif italic titles, monochrome treatment, rounded-pill CTAs.

## Scope boundary — no backend changes

The viewer endpoint still returns the same thin shape. The adapter in `view.vue` synthesizes a `Memory`-compatible shape client-side. The modal in viewer-mode shows a single heart react (one-shot toggle, matches current viewer functionality) — showing existing reaction counts in the modal would require backend changes and is deferred.

## What changed

- **New:** `app/components/ViewerSpreadHeader.vue`.
- **Modified:** `TimelineMosaic.vue`, `MemoryShell.vue`, `MemoryDetail.vue`, `view.vue`.
- **i18n:** new viewer keys in en/zh-CN/fr.

## Test plan

- [x] `pnpm test` (598).
- [x] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep: open a valid viewer link in incognito (mobile + desktop). Verify header, mosaic, modal (heart react, swipe between memories, close). Verify expired + invalid states with bogus tokens.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] `ViewerSpreadHeader.vue` exists and renders per spec §5.4.
- [ ] `view.vue` body uses `TimelineMosaic` + `MemoryShell` with viewer-mode.
- [ ] Splash + expired + invalid states restyled in monochrome.
- [ ] `pnpm test` passes (598).
- [ ] `npx vue-tsc --noEmit` clean.
- [ ] Manual viewer-link sweep passes on desktop + mobile.
- [ ] PR open and CI green.

---

## Risks

- **Adapter shape mismatch.** The viewer endpoint's thin memory shape is converted to `Memory` via stubs. `MosaicCell` and `MemoryDetail` only read `memorymedia` and `note` from this — verified. If a future refactor adds new field reads in those components, the viewer page may break silently. Mitigation: TypeScript at the adapter level catches type mismatches; manual sweep catches runtime visual issues.
- **Reactions UX divergence.** In owner mode the modal has a 12-emoji picker with existing reaction counts. In viewer mode it's just one ❤ button. This is functional regression vs the spec's "full picker stays" suggestion — accepted intentionally to avoid backend changes. If desired later, expand the viewer endpoint to return reaction counts and accept the full emoji palette; expand the viewer picker accordingly.
- **TimelineMosaic year ribbons on viewer.** TimelineMosaic shows year ribbons separators between months. For viewers seeing only ~30-50 memories, the year ribbon may feel heavy. Spec doesn't call this out as different for viewers — leave it as-is.
- **Guest-name modal flow.** Existing view.vue prompts for guest name before the first reaction. After the rewrite, the modal's onViewerReact fires the API regardless of guest name presence (anonymous if empty). User can set name via the existing button in the header area. Acceptable simplification.
- **Splash + state restyling subjectivity.** "Monochrome treatment" is broad. The plan suggests Instrument Serif italic titles + rounded pill CTAs but doesn't pin every spacing/size choice. Treat the spec as direction, design choices in PR are review-able.
- **Owner viewer-name display ("Mei & Dao").** Endpoint returns single `ownerFirstName`. Spec wants comma-joined first names of all circle owners. Plan punts to the single name for now. Future: backend addition.
- **`useTimeline` composable on viewer page.** It's normally used inside the owner timeline. Verify it works with `monthCountsRef` as an empty map and no auth context (it shouldn't require auth — it's a pure transform composable).
- **No tests added.** The current viewer test suite (if any) will likely have stale selectors after the body rewrite. Identifying which spec to update and adapting is out of scope unless tests fail in CI. If `tests/viewer-link.spec.ts` (or similar) exists, the implementer should update it in Task 7's sweep.
