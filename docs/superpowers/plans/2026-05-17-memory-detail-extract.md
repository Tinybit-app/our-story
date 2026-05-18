# MemoryDetail Extraction (Sub-Plan #3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve a new `MemoryDetail.vue` out of the existing 2375-line `MemoryModal.vue`. After this PR, `MemoryModal.vue` keeps only the photo region (single + multi-item carousel) and the milestone-share-card teleport; everything else (tab bar, caption view + edit, reactions, comments) moves into `MemoryDetail.vue`. **No visible behavior change.** This is the first of four PRs that ultimately rebuild the modal as a Drawer + Hero (spec §6); we extract first so the rewrite that follows touches a smaller, focused component instead of a 2375-line monolith.

**Architecture:** `MemoryModal.vue` becomes a thin shell that renders the photo carousel and embeds `<MemoryDetail>` below it. `MemoryDetail` owns all caption / reactions / comments concerns. `QuickNoteModal.vue` is untouched in this PR — it gets unified into the new `MemoryDetail` contract in PR #3c (drawer rewrite) once the contract has stabilized.

**Source spec:** [docs/superpowers/specs/2026-05-16-timeline-mosaic-cards-design.md](../specs/2026-05-16-timeline-mosaic-cards-design.md) §6.6 (component contract) + §15 (PR-slicing risk).

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + Tailwind v3 + Vitest. No new dependencies, no DB changes, no i18n changes.

**Sub-plan position:** This is PR #3a of four within sub-plan #3 (modal rebuild). The other three are #3b MemoryViewer extraction, #3c MemoryShell mobile drawer, #3d MemoryShell desktop two-column + delete legacy modals.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `app/components/MemoryDetail.vue` | Create | Tab bar (caption / comments), caption view + edit modes (incl. slides editor + staged items + save flow), reactions row, comments list + input + edit/delete. Exposes `canClose()` for the unsaved-edits guard. |
| `app/components/MemoryModal.vue` | Modify | Keep only the photo region (single + multi-item carousel), milestone share card teleport, and the slim wiring that hoists `slides` / `currentSlideIdx` for both regions. Renders `<MemoryDetail>` as its sole non-photo child. |
| `unit/memory-detail.test.ts` | Create | Smoke: component mounts with a minimal memory prop, emits `update`, exposes `canClose`. Not a full behavior test — full behavior is exercised via the existing manual sweep and E2E paths. |

Files that intentionally remain unchanged: `app/components/MemoryShell.vue`, `app/components/QuickNoteModal.vue`, `app/components/QuickNoteForm.vue`, all pages, all i18n files.

---

## Component contract — `MemoryDetail.vue`

```ts
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from './MemoryModal.vue'  // re-exported below if not already

interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}
interface CircleMember {
  userId: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const props = defineProps<{
  memory: Memory
  children: ChildProfile[]
  members: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
  // Carousel state lives in MemoryModal (photo region owner); MemoryDetail
  // reads it for the slides-editor in edit mode and emits back on changes.
  slides: Slide[]
  currentSlideIdx: number
}>()

const emit = defineEmits<{
  // Memory mutation (caption save, reaction toggle, comment add/edit/delete).
  update: [Pick<Memory, 'id'> & Partial<Memory>]
  // Slides reordered, removed, or cover changed in edit mode.
  'slides-update': [
    { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null },
  ]
  // Open the milestone share card teleport hosted in MemoryModal.
  'open-share-card': []
}>()

defineExpose({
  canClose: async (): Promise<boolean> => {
    // Prompts the discard dialog if edit mode has unsaved changes;
    // resolves true to allow close, false to keep modal open.
  },
})
```

Spec §6.6 also lists a `layout: 'drawer' | 'panel'` prop. It is **deferred to PR #3c** because the drawer doesn't exist yet; adding the prop now without using it adds dead surface area. The signature above matches what `MemoryModal` needs today.

---

## Task 1: Scaffold `MemoryDetail.vue` with the prop contract

**Files:**
- Create: `app/components/MemoryDetail.vue`
- Create: `unit/memory-detail.test.ts`

### Step 1: Create the empty component

Create `app/components/MemoryDetail.vue` with just the contract — no template content yet:

```vue
<template>
  <div class="flex h-full flex-col">
    <!-- Content moves in over Tasks 2-6 -->
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from './MemoryModal.vue'

interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}
interface CircleMember {
  userId: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

defineProps<{
  memory: Memory
  children: ChildProfile[]
  members: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
  slides: Slide[]
  currentSlideIdx: number
}>()

defineEmits<{
  update: [Pick<Memory, 'id'> & Partial<Memory>]
  'slides-update': [
    { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null },
  ]
  'open-share-card': []
}>()

async function canClose(): Promise<boolean> {
  return true
}
defineExpose({ canClose })
</script>
```

### Step 2: Re-export `Slide` from `MemoryModal.vue`

If `Slide` is currently a local-only interface, lift it to be importable. Open `app/components/MemoryModal.vue`, find the `interface Slide { ... }` declaration (search the file). Replace `interface Slide` with `export interface Slide`. Verify it's stable enough to import elsewhere — if multiple consumers will use it later, consider moving it to `app/types/memory.ts`; for now an inline re-export is fine.

If `Slide` is not declared in `MemoryModal.vue` (e.g. lives in a composable), import from wherever it lives. The implementer should grep first:

```bash
grep -n "Slide\b" app/components/MemoryModal.vue | head -20
```

### Step 3: Write the smoke test

Create `unit/memory-detail.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MemoryDetail from '~/components/MemoryDetail.vue'
import type { Memory } from '~/composables/useTimeline'

vi.stubGlobal('useI18n', () => ({ locale: ref('en'), t: (k: string) => k }))

function makeMemory(): Memory {
  return {
    id: 'm1',
    circle_id: 'c1',
    owner_user_id: 'u1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'Hello',
    memory_date: '2026-04-15T10:00:00Z',
    milestone_label: null,
    created_at: '2026-04-15T10:00:00Z',
    memory_children: [],
    memory_members: [],
    memorymedia: [],
    user: { first_name: 'A', last_name: 'B', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
  }
}

describe('MemoryDetail', () => {
  it('mounts with the contract props', () => {
    const wrapper = mount(MemoryDetail, {
      props: {
        memory: makeMemory(),
        children: [],
        members: [],
        currentUserId: 'u1',
        selfAvatarUrl: null,
        selfInitials: '?',
        slides: [],
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('exposes canClose() returning true when no edit in progress', async () => {
    const wrapper = mount(MemoryDetail, {
      props: {
        memory: makeMemory(),
        children: [],
        members: [],
        currentUserId: 'u1',
        selfAvatarUrl: null,
        selfInitials: '?',
        slides: [],
        currentSlideIdx: 0,
      },
    })
    const result = await (wrapper.vm as any).canClose()
    expect(result).toBe(true)
  })
})
```

### Step 4: Run the test

Run: `pnpm test unit/memory-detail.test.ts`
Expected: 2 tests pass.

### Step 5: Commit

```bash
git add app/components/MemoryDetail.vue unit/memory-detail.test.ts app/components/MemoryModal.vue
git commit -m "feat(memory-detail): scaffold MemoryDetail component shell"
```

---

## Task 2: Move the tab bar + caption view-mode

The tab bar (caption / comments) and the caption view-mode rendering are the easiest move — they have minimal cross-talk with the photo region.

**Files:**
- Modify: `app/components/MemoryDetail.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Identify the source ranges in `MemoryModal.vue`

Open `app/components/MemoryModal.vue`. The relevant ranges (verify by reading the file — line numbers may shift slightly during work):

- **Tab bar template:** lines ~249-281 (`<!-- Caption section: tab bar + independent scroll panels -->` through end of tab bar `<div>`).
- **Caption view mode template:** lines ~282-427 (`<!-- View mode -->` through `<!-- Edit mode -->` boundary).
- **Script state for view mode:**
  - `activeTab` ref (~1422)
  - `formattedDate` computed (~1390)
  - `childAges` computed (~1398)
  - `isFormerMember` computed (~1408)
  - `authorName` computed (~1409)
  - `isOwner` computed (~1416)

The view mode also references `firstMedia`, `isQuickNote`, `memory` — but `memory` is now the prop, and we'll wire `firstMedia` via a computed inside `MemoryDetail` that reads from `props.memory.memorymedia[0]`.

### Step 2: Move the template into `MemoryDetail.vue`

In `MemoryDetail.vue`, replace the empty `<div>` body with:

1. The tab bar wrapper from MemoryModal.
2. The Caption tab's view-mode block, wrapped in `<div v-if="!editing">`.
3. A placeholder for edit mode and comments tab (to be filled in by later tasks):

```vue
<template>
  <div class="flex h-full flex-col">
    <!-- TASK 2 boundary: tab bar -->
    <!-- (move tab bar template here from MemoryModal.vue lines ~251-281) -->

    <!-- Caption tab -->
    <div v-if="activeTab === 'caption'" class="flex-1 overflow-y-auto">
      <!-- View mode -->
      <div v-if="!editing">
        <!-- (move view-mode template here from MemoryModal.vue lines ~287-427) -->
      </div>

      <!-- Edit mode placeholder — filled in Task 5 -->
      <div v-else>
        <p class="p-4 text-sm text-muted-foreground">Edit mode coming in Task 5.</p>
      </div>

      <!-- Reactions placeholder — filled in Task 3 -->
      <div class="px-4 pb-4">
        <!-- Reactions row -->
      </div>
    </div>

    <!-- Comments tab placeholder — filled in Task 4 -->
    <div v-else class="flex-1 overflow-y-auto">
      <p class="p-4 text-sm text-muted-foreground">Comments tab coming in Task 4.</p>
    </div>
  </div>
</template>
```

(The exact wrapper classes — `flex-1 overflow-y-auto`, etc. — should match what `MemoryModal.vue` uses today; preserve them verbatim.)

### Step 3: Move the script state into `MemoryDetail.vue`

Inside `<script setup>` of `MemoryDetail.vue`, after the prop/emit declarations, add:

```ts
const { t, locale } = useI18n()

const activeTab = ref<'caption' | 'comments'>('caption')
const editing = ref(false)

// firstMedia for the view-mode templates that show e.g. download/share buttons.
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

// Date / author derivations
const formattedDate = computed(() => /* move from MemoryModal.vue ~1390 */)
const childAges = computed(() => /* move from MemoryModal.vue ~1398 */)
const isFormerMember = computed(() => props.memory.owner_user_id === null)
const authorName = computed(() => /* move from MemoryModal.vue ~1409 */)
const isOwner = computed(
  () => /* move from MemoryModal.vue ~1416, replace `useSupabaseUser().value?.id` with `props.currentUserId` */,
)
```

**Important translation:** The current MemoryModal calls `useSupabaseUser()` internally. In MemoryDetail, the equivalent value is the `currentUserId` prop — replace any `useSupabaseUser().value?.id` reference inside `isOwner` (and elsewhere when you encounter it in later tasks) with `props.currentUserId`.

### Step 4: Render `<MemoryDetail>` from `MemoryModal.vue`

In `MemoryModal.vue`, **delete** the lines you moved (~251-427 of template) AND the script lines you moved (~1390-1422). In their place, render `<MemoryDetail>`:

```vue
<!-- Replace the deleted caption section with: -->
<MemoryDetail
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
/>
```

Add the import at the top of `<script setup>`:

```ts
import MemoryDetail from './MemoryDetail.vue'
```

Add the stub handler:

```ts
function onSlidesUpdate(payload: { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null }) {
  slides.value = payload.slides
  if (payload.currentSlideIdx !== undefined) currentSlideIdx.value = payload.currentSlideIdx
  // coverMediaId effect deferred to Task 5 (only mutated in edit mode).
}
```

(`openShareCard` already exists in MemoryModal at ~2022; it stays there.)

### Step 5: Manual sweep

Run `pnpm dev`. Open a memory with a note. Confirm:
- The view-mode caption text renders.
- The tab bar shows two tabs ("Caption" active, "Comments" inactive).
- Clicking "Comments" shows the placeholder text from Step 2.
- No console errors.

(Reactions are missing — that's expected; Task 3.)

### Step 6: Commit

```bash
git add app/components/MemoryDetail.vue app/components/MemoryModal.vue
git commit -m "feat(memory-detail): move tab bar + caption view-mode into MemoryDetail"
```

---

## Task 3: Move the reactions section

**Files:**
- Modify: `app/components/MemoryDetail.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Identify the source ranges

In `MemoryModal.vue`:
- **Template:** lines ~919-1011 (`<!-- Reactions -->` block).
- **Script state:**
  - `PRESET_EMOJIS` constant (~1269)
  - `pickerOpen` ref (~1284)
  - `supabaseClient` (~2130) — already exists in MemoryDetail's scope after Task 2 if we add `useSupabaseClient()` there; otherwise add it.
  - `localReactions` ref (~2133)
  - `reactionGroups` computed (~2137)
  - `hasAnyReaction` computed (~2156)
  - `reactionTooltip` function (~2160)
  - `toggleReaction` async function (~2165)

### Step 2: Move into `MemoryDetail.vue`

Replace the Reactions placeholder from Task 2 with the actual template block. Move all the script state listed above into MemoryDetail's `<script setup>`.

Translate references:
- `useSupabaseUser().value?.id` → `props.currentUserId` (inside `toggleReaction`).
- The `Reaction` interface that `localReactions` uses — check if it's declared in MemoryModal. If yes, lift it as `export interface Reaction` (same pattern as `Slide` in Task 1) and import in MemoryDetail. If declared elsewhere, import from there.
- Any `emit('update', ...)` calls already match the contract — leave them.

`toggleReaction` writes directly to Supabase via `supabaseClient`. That logic moves as-is; the function calls `emit('update', ...)` after a successful insert/delete. Verify the emit signature in the moved code matches MemoryDetail's emit declaration.

### Step 3: Delete the moved code from `MemoryModal.vue`

After the template + script blocks move, remove them from `MemoryModal.vue`. Search for any remaining references in MemoryModal — anything still using `localReactions` or `toggleReaction` should be gone.

### Step 4: Manual sweep

Reload the dev server. Open a memory:
- Reaction pills render with current counts.
- Tap a reaction → it toggles. The mosaic cell updates via the `update` event.
- The add-reaction picker opens and closes.
- Emoji selection adds a reaction.

### Step 5: Commit

```bash
git add app/components/MemoryDetail.vue app/components/MemoryModal.vue
git commit -m "feat(memory-detail): move reactions into MemoryDetail"
```

---

## Task 4: Move the comments tab

**Files:**
- Modify: `app/components/MemoryDetail.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Identify the source ranges

In `MemoryModal.vue`:
- **Template:** lines ~1012-1215 (`<!-- Comments tab -->` block, including list, input, edit/delete confirmation UI).
- **Script state:**
  - `comments` ref (~2224)
  - `commentDraft` ref (~2225)
  - `allCommentsVisible` ref (~2226)
  - `COMMENT_LIMIT` constant (~2227)
  - `sortedComments` computed (~2228)
  - `visibleComments` computed (~2229)
  - `hiddenCommentCount` computed (~2234)
  - `submitting` ref (~2237)
  - `textareaEl` ref (~2238)
  - `loadComments` async function (~2240)
  - `submitComment` async function (~2251)
  - `autoResize` function (~2274)
  - `commentDisplayName` function (~2280)
  - `commentInitials` function (~2286)
  - Comment editing/delete block (~2294-2370): `editingCommentId`, `commentEditDraft`, `savingComment`, `commentEditEl`, `confirmDeleteId`, `startEditingComment`, `cancelCommentEdit`, `saveCommentEdit`, `requestDeleteComment`, `cancelDeleteComment`, `deleteComment`, `timeAgo`.

### Step 2: Move into `MemoryDetail.vue`

Replace the Task 2 comments placeholder with the actual template. Move all the script state.

Translate references:
- `useSupabaseUser().value?.id` → `props.currentUserId`.
- Any `Comment` interface declared in MemoryModal — lift as `export interface Comment` and import.
- `loadComments` is called on mount in current MemoryModal. Replicate by calling it from `onMounted` inside MemoryDetail.
- `useNuxtApp().$emit('comment-saved')` or similar bus events — if present, preserve them verbatim.

### Step 3: Delete moved code from `MemoryModal.vue`

Same pattern as Task 3.

### Step 4: Manual sweep

- Open a memory with comments. They load.
- Click "View all" if hidden. They expand.
- Type a comment and submit. It appears.
- Edit a comment. It saves.
- Delete a comment. Confirm dialog → delete works.

### Step 5: Commit

```bash
git add app/components/MemoryDetail.vue app/components/MemoryModal.vue
git commit -m "feat(memory-detail): move comments tab into MemoryDetail"
```

---

## Task 5: Move the caption edit mode (incl. slides editor + staged items + save)

This is the largest single task in the plan. The edit mode is ~500 lines of template + ~600 lines of script.

**Files:**
- Modify: `app/components/MemoryDetail.vue`
- Modify: `app/components/MemoryModal.vue`

### Step 1: Identify the source ranges

In `MemoryModal.vue`:
- **Template:** lines ~428-918 (`<!-- Edit mode -->` block, including slides editor list, staged items, add buttons, save bar).
- **Script state — edit form:**
  - `editing` (already moved in Task 2) and `saving` (~1424)
  - `editNote`, `editMilestone`, `editDate` (~1425-1427)
  - `editChildIds`, `editMemberIds` (~1428-1429)
  - `editTextareaEl` (~1430)
- **Script state — slides edit:**
  - `slidesEdit` (~1433)
  - `addMediaInputEl` (~1434)
  - `editCoverMediaId` (~1439)
  - `originalSlideOrder` (~1440)
  - `removedSlideIds` (~1441)
  - `stagedItems` (~1460)
- **Functions — staged uploads:**
  - `pickAddMediaFile` (~1488)
  - `uploadFileToDraft` (~1494)
  - `newStagedTempId` (~1530)
  - `onAddMediaSelected` (~1537)
  - `addStagedTextSlide` (~1557)
  - `removeStagedItem` (~1567)
  - `clearStagedItems` (~1578)
  - `flushStagedItems` (~1590)
- **Functions — slide ops:**
  - `removeSlide` (~1657)
  - `moveSlide` (~1668)
  - `setCover` (~1676)
- **Functions — edit lifecycle:**
  - `hasUnsavedChanges` (~1683)
  - `startEditing` (~1730)
  - `discardConfirmOpen` (~1747)
  - `askDiscardConfirm` (~1750)
  - `settleDiscardConfirm` (~1756)
  - `cancelEditing` (~1762)
  - `canClose` (~1771) — this is the function we expose to MemoryShell
  - `beforeUnloadHandler` (~1780)
  - `toggleEditChild` (~1795)
  - `toggleEditMember` (~1801)
  - `memberInitials` (~1807)
  - `saveEdit` (~1815)

### Step 2: Move the template

Replace the Task 2 edit-mode placeholder in `MemoryDetail.vue` with the actual edit-mode template from `MemoryModal.vue` lines ~428-918.

### Step 3: Move the script state and functions

Move every item in the list above into `MemoryDetail.vue`'s `<script setup>`. Place them after the view-mode state from Task 2.

Translate references:
- `slides.value` (the carousel state) is no longer a local ref — it's the `slides` prop. Replace local reads of `slides.value` with `props.slides`.
- `currentSlideIdx.value` → `props.currentSlideIdx`.
- When `removeSlide` / `moveSlide` / `setCover` would have mutated `slides.value` or `currentSlideIdx.value`, instead build the new array/index and emit `slides-update` with the payload. MemoryModal's `onSlidesUpdate` handler (added in Task 2) writes back to its local `slides` / `currentSlideIdx`.
- `editCoverMediaId` stays local; on save (in `saveEdit`) the new cover is communicated via `slides-update`'s `coverMediaId` field.
- `useSupabaseUser().value?.id` → `props.currentUserId`.
- `useSupabaseClient()` — call once at top of script if not already.

### Step 4: Wire the canClose() expose contract

Replace the stub `canClose` in `MemoryDetail.vue` (added in Task 1) with the real implementation moved from `MemoryModal.vue`:

```ts
async function canClose(): Promise<boolean> {
  if (!editing.value) return true
  if (!hasUnsavedChanges.value) return true
  return askDiscardConfirm()
}
defineExpose({ canClose })
```

Then update `MemoryModal.vue` to forward the call from its own `canClose` exposure (which `MemoryShell.vue` already consumes):

```ts
// In MemoryModal.vue:
const memoryDetailRef = ref<{ canClose: () => Promise<boolean> } | null>(null)

async function canClose(): Promise<boolean> {
  return (await memoryDetailRef.value?.canClose()) ?? true
}
defineExpose({ canClose })
```

And add `ref="memoryDetailRef"` to the `<MemoryDetail>` element in MemoryModal's template.

`MemoryShell.vue` doesn't need to change — it already calls `memoryModalRef.value?.canClose()` (see line 189).

### Step 5: Move `beforeUnloadHandler` registration

In current MemoryModal, the beforeUnload listener is registered on mount and removed on unmount. Move both the function and the lifecycle hooks (`onMounted` + `onUnmounted`) into MemoryDetail.

### Step 6: Delete moved code from `MemoryModal.vue`

Remove everything moved in Steps 2-5. After this, `MemoryModal.vue` should be substantially shorter — roughly: template = photo region + carousel + share card teleport + `<MemoryDetail>` element; script = props/emits, carousel state and handlers, `openShareCard`, `slides` loading, `onSlidesUpdate`, the thin `canClose` forwarder.

### Step 7: Manual sweep — the big one

Reload dev. Walk through:
- Open a memory. Click "Edit".
- Change the note. Save. Note updates in the timeline mosaic.
- Open another memory. Edit. Add a milestone label. Save.
- Open a multi-photo memory. Enter edit mode. Reorder slides. Save. Carousel reflects the new order.
- Open a multi-photo memory. Edit. Remove a slide. Save.
- Open any memory. Edit. Stage a new photo via the add button. Save. New photo appears in the carousel.
- Open any memory. Edit. Stage a new text slide. Save.
- Open any memory. Edit. Try to close the modal (backdrop click). Discard prompt appears.
- Open any memory. Edit. Click Cancel. Discard prompt appears.
- Open any memory. Edit. Change cover photo. Save. Cover updates in the mosaic.
- Open any memory. Edit. Toggle child/member tags. Save. Tags persist.

Every one of these paths must work identically to before. This is the highest-risk task in the plan — the slide editor + staged-items + save flow is intricate and the prop-/event-bridging is where bugs hide.

### Step 8: Commit

```bash
git add app/components/MemoryDetail.vue app/components/MemoryModal.vue
git commit -m "feat(memory-detail): move caption edit mode + slides editor into MemoryDetail"
```

---

## Task 6: Wire the milestone-share-card emit and download/share buttons

After Tasks 2-5, the only remaining MemoryDetail-resident references to MemoryModal-level state are:
- The "Share milestone card" button in the caption view mode (which currently calls `openShareCard()` directly).
- The download / share-media buttons (lines ~61-110 of original template) — but these are inside the *photo region*, so they stayed in MemoryModal. **No work in MemoryDetail for those.**

**Files:**
- Modify: `app/components/MemoryDetail.vue`

### Step 1: Replace the direct call

Search MemoryDetail's template for any reference to `openShareCard`. Currently it would still be a direct call from when you moved the template in Task 2. Replace it with the emit:

```vue
<!-- Before -->
<button @click="openShareCard">…</button>

<!-- After -->
<button @click="emit('open-share-card')">…</button>
```

Verify there are no other dangling references to `openShareCard`, `shareCardData`, or anything from the share-card script block (those stayed in MemoryModal).

### Step 2: Manual verify

Open a memory with a milestone label. Click the "Share milestone card" button. The share-card teleport opens (it's hosted in MemoryModal, so the emit reaches it).

### Step 3: Commit

```bash
git add app/components/MemoryDetail.vue
git commit -m "feat(memory-detail): emit open-share-card instead of direct call"
```

---

## Task 7: Sweep, type-check, full test suite

**Files:** None modified.

### Step 1: Sweep for dead code in `MemoryModal.vue`

Search the file for any orphaned imports, variables, or types that were only used by the moved code:

```bash
# Quick checks
grep -n "localReactions\|reactionGroups\|toggleReaction\|loadComments\|submitComment" app/components/MemoryModal.vue
# Each should return zero hits.

grep -n "editing\|saving\|editNote\|editMilestone\|slidesEdit\|stagedItems\|saveEdit\|flushStagedItems" app/components/MemoryModal.vue
# Each should return zero hits.

grep -n "useI18n\|t(" app/components/MemoryModal.vue
# t() should only be used in places that stayed (carousel labels, share card).
# If MemoryModal no longer uses t() at all, remove the destructure.
```

Delete anything orphaned.

### Step 2: Type-check

Run: `npx vue-tsc --noEmit`
Expected: zero new errors.

### Step 3: Run the full unit test suite

Run: `pnpm test`
Expected: 588 + 2 new (from Task 1) = **590** tests pass. No regressions.

### Step 4: Run E2E tests (if quick)

Run: `pnpm test:e2e -- --grep memory` (or similar to filter)
If a broader run is feasible: `pnpm test:e2e`
Expected: no regressions.

### Step 5: Final manual sweep

A condensed version of Task 5's sweep:
- Open a photo memory. View tabs. React. Comment. Edit caption. Save.
- Open a multi-photo memory. Reorder slides in edit mode. Save.
- Open a memory with a milestone. Open the share card.
- Open a quick-note-only memory — should hit `QuickNoteModal` (untouched in this PR) and render as before.

### Step 6: No commit needed for the sweep itself.

---

## Task 8: Push + open PR

### Step 1: Push

```bash
git push -u origin HEAD
```

### Step 2: Open the PR

Compare URL: `https://github.com/Tinybit-app/our-story/compare/dev...memory-detail-extract`

Suggested title: `Extract MemoryDetail from MemoryModal (sub-plan #3a)`

Suggested body:

```markdown
## Summary

First of four PRs (per spec §15) to rebuild the memory modal as a Drawer + Hero (§6). This PR is purely **mechanical refactor — no visible behavior change.** It carves a new `MemoryDetail.vue` out of `MemoryModal.vue`'s 2375 lines.

After this PR:
- `MemoryModal.vue` keeps only the photo region (single + multi-item carousel) and the milestone share card teleport.
- `MemoryDetail.vue` (new) owns: tab bar, caption view + edit modes (incl. slides editor), reactions, comments.
- `QuickNoteModal.vue` is untouched here — it gets unified into the new contract in PR #3c (drawer rewrite) once the MemoryDetail contract has been exercised.
- `MemoryShell.vue` is untouched — `canClose()` is forwarded through MemoryModal from MemoryDetail's `defineExpose`.

The new component matches spec §6.6's contract except for the `layout` prop, which is deferred to PR #3c when the drawer/panel split exists. Adding it now would be dead surface area.

## What changed

- **New:** `app/components/MemoryDetail.vue` with the §6.6 prop/emit contract.
- **Modified:** `app/components/MemoryModal.vue` shrinks by ~1500 lines.
- **New tests:** `unit/memory-detail.test.ts` — mount smoke + canClose expose smoke.

## Test plan
- [x] `pnpm test` (590).
- [x] `npx vue-tsc --noEmit` clean.
- [x] Manual sweep — view, react, comment, edit caption, slide editor (reorder, remove, add staged photo, add staged text, change cover), milestone share card, unsaved-edits discard prompt.
- [x] Quick-note memories still render via the unchanged `QuickNoteModal`.

## Out of scope

- The other 3 PRs of sub-plan #3 (#3b MemoryViewer extraction, #3c MemoryShell mobile drawer, #3d desktop two-column + delete legacy modals).
- `QuickNoteModal.vue` consolidation — happens in #3c.
- Theming / monochrome restyling of the modal — happens in #3c/#3d alongside layout rewrite.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of done

- [ ] `MemoryDetail.vue` exists with the spec §6.6 contract (minus the deferred `layout` prop).
- [ ] `MemoryModal.vue` no longer contains the tab bar, caption view/edit, reactions, or comments — only the photo region + share card teleport + the `<MemoryDetail>` element.
- [ ] `pnpm test` passes (590).
- [ ] `npx vue-tsc --noEmit` clean.
- [ ] Manual sweep passes for every path in Task 5 Step 7.
- [ ] PR open and CI green.

---

## Risks

- **Slides editor coupling is the highest risk.** The slides ref (carousel state) lives in MemoryModal, but the slides editor that mutates it lives in MemoryDetail. The prop-down + event-up bridge has many paths (move, remove, add staged item, set cover). Bugs here will show up as "the carousel doesn't reflect the save" or "save persisted a stale order." Mitigation: walk Task 5 Step 7's sweep paths carefully and consider adding two extra Vitest assertions in `memory-detail.test.ts` for the `slides-update` event payload shape.
- **`canClose` forwarding from MemoryShell → MemoryModal → MemoryDetail.** The unsaved-edits guard already works via `memoryModalRef.value?.canClose()` (MemoryShell.vue:189). After this PR, MemoryModal's `canClose` is a thin forwarder to MemoryDetail's `defineExpose`. If the forwarder is missing or returns `undefined`, the discard prompt won't appear and users will lose edits silently. Mitigation: explicit manual test of "edit, then backdrop-click" path.
- **Locale + i18n.** Most `t('…')` keys move with the templates. If any locale lookup uses a local helper (e.g. `formattedDate` reads `locale.value`), make sure `useI18n()` is re-imported in MemoryDetail.
- **PostHog `track` calls.** `useAnalytics()` may be referenced inside `toggleReaction`, `submitComment`, `saveEdit`. Re-import in MemoryDetail.
- **`beforeUnloadHandler` registration.** It must be re-registered in MemoryDetail's `onMounted` AND torn down in `onUnmounted`, otherwise it stays attached after the modal closes (a leak), or it never attaches (no unsaved-edits browser-warning).
- **`MemoryShell.vue` is untouched.** This is intentional. If the implementer feels tempted to touch MemoryShell (e.g. "while we're in there"), don't — it stays sacrosanct until PR #3c.
- **QuickNoteModal is untouched.** Quick-note memories still take the old code path. The new contract will absorb them in PR #3c.
