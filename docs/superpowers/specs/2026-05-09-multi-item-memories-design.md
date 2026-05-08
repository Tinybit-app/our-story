# Multi-item Memories Design Spec

## Overview

Allow a single memory to contain multiple gallery items (photos, videos, text slides) so an event with many photos consolidates into one card with one comment thread, rather than fanning out into N separate memories. The data model already supports 1-to-N media per memory; this spec extends that model to allow **text slides** alongside photos/videos and adds the upload UX, timeline rendering, and editing workflows.

## Vocabulary

- **Memory** — the user-facing noun. Unchanged. A memory may have 0, 1, or many gallery items.
- **Slide** / **gallery item** — one item inside a memory's gallery. Type is `image`, `video`, or `text`.
- **Multi-item memory** — internal/dev term only for memories with 2+ gallery items. Never surfaced to users.

We do **not** introduce "Event," "Group," "Album," or any other new noun.

## Decisions

- **Default upload behaviour unchanged.** Selecting N photos creates N memories (current behaviour). Multi-item is opt-in via a toggle.
- **Upload toggle copy:** "Post as one memory" / "Post separately." No "Event" or "Group" wording.
- **Mixed types in one memory:** image + video + text slides can coexist in a single memory.
- **`Memory.note` is preserved** as the event-level caption (always shown above the gallery). Text slides (`MemoryMedia.media_type='text'`) are *additional* in-gallery content. See "Two text fields" below.
- **Cover image:** `Memory.cover_media_id` (nullable FK). If null, defaults to first photo/video by `display_order`. User can tap any photo/video to set as cover. Text-only memories have no cover.
- **Backwards compatible.** Single-photo memories and quick notes (zero MemoryMedia) keep working unchanged. No data migration needed.
- **Visual hint for multi-item:** stacked-polaroid effect — 1-2 silhouettes peeking out behind the front card, slightly rotated, with deeper shadow. Plus a small count badge (`⊕12`) in the corner.
- **Modal:** swipe-able horizontal carousel with dot indicators for multi-item; unchanged for single-item.
- **Edit later** is in-scope: owner can add/remove/reorder slides on an existing memory.
- **Tag scope:** child tags + member tags + milestone label apply to the whole memory, not per-slide.

## Two text fields

| Field | Role | When used |
|-------|------|-----------|
| `Memory.note` | Event-level caption ("Mia's birthday party!"). Always shown above the gallery. | Optional on any memory. Required for legacy quick notes (zero MemoryMedia). |
| `MemoryMedia.text_content` (when `media_type='text'`) | Text slide interspersed in the gallery, like a quick note nested inside the carousel. | Used inside multi-item memories to add narrative beats between photos. |

These are distinct concerns. The note is the cover caption; text slides are sequential content. Two fields, two roles, no migration of legacy data.

## 1. Data Model

### Migration 029: extend MemoryMedia + add cover

```sql
-- supabase/migrations/029_multi_item_memories.sql

-- Allow text slides
ALTER TABLE memorymedia
  ADD COLUMN text_content TEXT,
  ADD COLUMN display_order INT NOT NULL DEFAULT 0;

ALTER TABLE memorymedia ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE memorymedia DROP CONSTRAINT IF EXISTS memorymedia_media_type_check;
ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_media_type_check
  CHECK (media_type IN ('photo', 'video', 'live_photo', 'text'));

-- Defensive: photo/video/live_photo must have a storage_path; text must have text_content
ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_content_check
  CHECK (
    (media_type IN ('photo', 'video', 'live_photo') AND storage_path IS NOT NULL) OR
    (media_type = 'text' AND text_content IS NOT NULL)
  );

-- Cover image FK (nullable; default to first photo/video by display_order)
ALTER TABLE memory
  ADD COLUMN cover_media_id UUID REFERENCES memorymedia(id) ON DELETE SET NULL;

CREATE INDEX idx_memorymedia_memory_order ON memorymedia(memory_id, display_order);
```

### Backfill display_order

Existing rows get `display_order = 0` by default — fine because there's only one row per memory today.

### RLS

No new RLS needed. `MemoryMedia` already inherits read/write rules from its parent `Memory` (members can read; owner can mutate). Text slides are content, same access rules.

## 2. Upload Flow

### Single-photo upload (unchanged)

User picks one photo → creates one Memory + one MemoryMedia (image). No change.

### Multi-photo upload (new toggle)

When user selects 2+ photos in the upload sheet:

1. **Toggle appears:** "Post as one memory" / "Post separately" (default: separate, current behaviour)
2. **When toggled to "one memory":**
   - Single date picker (was per-item)
   - Single milestone label input
   - Single child/member tag pickers
   - Single note field (event caption)
   - **Per-slide reorder handle** — drag to reorder
   - **"+" button to add a text slide** between photos
   - **Tap a photo to set as cover** (visual highlight on cover; default = first)
3. **On submit:** create ONE Memory + N MemoryMedia rows ordered by `display_order`. Cover defaults to first photo/video unless explicitly chosen.

### Quick note in a multi-item memory

User can tap "+ Add note" inside the upload UI when in multi-item mode. Inserts a text slide (modal with text input, max 500 chars). Slide is positioned at the end by default; can be reordered.

### Server endpoints

**`POST /api/memories/upload-batch`** *(new)* — creates ONE Memory + N MemoryMedia. Request body:

```ts
{
  circleId: string                        // uuid
  memoryDate: string                      // YYYY-MM-DD
  note: string | null                     // optional event caption
  milestoneLabel: string | null
  childIds: string[]                      // tagged children
  memberIds: string[]                     // tagged members
  coverIndex: number | null               // index into items array; null = first photo/video
  items: Array<
    | { type: 'image' | 'video', mediaId: string }   // mediaId from prior upload-media calls
    | { type: 'text',  textContent: string }
  >
}
```

The Edge Function `upload-media` (existing) continues to handle individual photo/video uploads — it returns `mediaId` and stores the file. The new `upload-batch` Nitro route then **groups** those previously-uploaded media into one Memory, plus inserts text slides.

This split is necessary because:
- Image/video upload happens via the Edge Function for streaming + size handling
- Memory creation happens in Nitro for transactional consistency

For the multi-item flow:
1. Client uploads each photo/video individually via `upload-media` Edge Function — gets back a list of `mediaId`s. **Key change:** `upload-media` accepts a new `defer=true` query parameter. With `defer=true`, the Edge Function uploads the file to storage and creates a `MemoryMedia` row but does not create a parent `Memory` (the row's `memory_id` is set to a temporary "orphan holder" memory owned by the user, OR — better — `memory_id` is left nullable in a follow-up migration). For Phase 1, the simplest concrete approach is: `upload-media?defer=true` creates a draft Memory owned by the caller (private, `visibility = 'private'`, `note = null`) and returns `{ memoryId, mediaId }`. The draft Memory is consumed and merged when `upload-batch` is called. If the draft is abandoned (user closes the upload sheet), it lingers as a private memory and is purged by a future cleanup cron (out of scope here, but tracked).
2. After all media uploads complete, client posts to `POST /api/memories/upload-batch` with `{ draftMemoryIds: [...], textItems: [...], coverIndex, ...metadata }`. Server merges all draft memories' MemoryMedia into one canonical Memory (deletes the now-empty draft memories), inserts text-slide rows, sets `cover_media_id`, and returns the new memory id.
3. **Cleaner alternative for Phase 2:** make `MemoryMedia.memory_id` nullable so deferred uploads create truly orphan rows. Avoids the draft-Memory dance. This requires another migration and audit of all existing code paths, so deferred for now.

> Why not change `upload-media` to always defer? Would break the single-photo upload contract used today. The opt-in `defer=true` is a clean addition.

### Single-photo path is unchanged

The existing `upload-media` Edge Function and single-photo path do exactly what they do today: create a Memory + 1 MemoryMedia in one shot, with `display_order = 0`. No regression.

## 3. Timeline Rendering

### PolaroidCard (photo/video memories)

| State | Visual |
|-------|--------|
| Single-item memory | Existing polaroid: white border, slight rotation, single image |
| Multi-item with image cover | Same polaroid + **2 stacked silhouettes** behind it (offset, deeper shadow, +/- rotation), **count badge** `⊕N` in bottom-right corner |

The stack silhouettes are pure CSS — no extra DOM per peripheral card. Use absolutely-positioned siblings before the main card with `transform: translate + rotate`.

### QuickNoteCard (zero MemoryMedia or all-text)

| State | Visual |
|-------|--------|
| Legacy quick note (0 media, `note` is the content) | Existing postcard, red pin |
| Multi-text memory (2+ text slides) | Postcard + **2 stacked postcards** behind it. Cover excerpt is from the first text slide (or `note` if `cover_media_id` is null and no media). Count badge in corner. |

### Edge case: 1 photo + 1 text slide

That's a multi-item memory. Renders as PolaroidCard (cover is the photo) with stack hint and `⊕2` badge. The text slide appears in the gallery, not on the timeline card.

### Count badge format

- `⊕2` for 2-9 items
- `⊕10` (no special handling) for 10-99
- 100+ unlikely; if needed, render `99+`

Position: bottom-right corner of the cover, with subtle backdrop-blur disc behind it for legibility against varied photo content.

## 4. Memory Modal (open detail view)

### Single-item: unchanged

One photo/video, no swipe affordance, no dots.

### Multi-item: carousel

- Horizontal swipe (touch) + arrow keys (desktop) to navigate slides
- Dot indicators at the bottom (`● ○ ○ ○`)
- Current slide index shown subtly (e.g. `3 / 12`)
- Each slide rendered by type:
  - **image** — same `<img>` treatment as today
  - **video** — same `<video>` controls
  - **text** — centred postcard-style card with the text content (matches QuickNoteCard's text styling)
- The memory's `note` (event caption) sits above the carousel, always visible
- Comments tab and reactions tab unchanged — they apply to the whole memory

## 5. Edit Flow (owner only)

Reuse the existing edit affordance on `MemoryModal`. New abilities:

- **Add photo/video:** opens upload picker, runs through `upload-media`, attaches to this memory
- **Add text slide:** opens text input, inserts at end
- **Remove slide:** trash icon per slide; with confirmation if it's the last photo/video (would change cover)
- **Reorder:** drag handle on each slide
- **Set cover:** tap a photo/video slide → "Set as cover" action

### Server endpoints (new)

- **`POST /api/memories/[id]/items`** — add a slide. Body: `{ type: 'image'|'video'|'text', mediaId?: string, textContent?: string }`. Inserts at end (`max(display_order) + 1`).
- **`DELETE /api/memories/[id]/items/[itemId]`** — remove a slide. If it was the cover, clears `cover_media_id` (timeline falls back to first photo/video).
- **`PATCH /api/memories/[id]/items/order`** — body: `{ orderedIds: string[] }`. Sets `display_order` per row.
- **`PATCH /api/memories/[id]`** *(extend existing)* — accept `coverMediaId` to set the cover.

All routes: owner-only, RLS-validated, zod-typed input.

## 6. Server-side Memory Fetch

### Timeline query (extend `GET /api/timeline`)

Each memory now returns:
- `memorymedia[]` ordered by `display_order` (was: usually 1 row, no ordering concern)
- `cover_media_id`
- `media_count` (computed: `memorymedia.length`)
- For timeline rendering, only the **cover** is needed — server returns the cover thumbnail signed URL. The other slides load lazily when the modal opens.

### Memory detail query (extend modal data)

Returns full ordered slide list with signed URLs (7-day TTL for thumbnails, fresh per request for originals).

### Backwards compat

- Existing memories with 1 row return `media_count = 1`, no stack visual.
- Quick notes with 0 rows: `media_count = 0`, no stack visual, render as QuickNoteCard.

## 7. Email Digest (12.1) — minor adjustment

The weekly/monthly digest currently shows `memorymedia[0]` thumbnail per memory. With multi-item memories:
- Use the cover (`cover_media_id` or first photo/video by `display_order`)
- Add a small count overlay `⊕N` in the corner of the digest thumbnail to hint multi-item
- All existing digest tests should still pass — the cover thumbnail concept is unchanged

This is a small follow-up touch in `supabase/functions/send-digest/index.ts` and `server/utils/email.ts` — call it out in the build plan but not a blocker.

## 8. Viewer Links (3.7)

Viewer links render the same `MemoryModal` carousel behaviour. No special viewer-link work needed — inherited automatically.

## 9. Testing

### RLS (pgTAP, `supabase/tests/rls.test.sql`)
- Member can SELECT all slides of memories in their circle (already covered by Memory + MemoryMedia policies — verify text slides too)
- Owner can INSERT/UPDATE/DELETE slides on own circle's memories
- Non-owner cannot mutate slides

### Unit (Vitest)
- `unit/api-validation.test.ts` — zod schemas for `upload-batch`, `items.post`, `items.delete`, `items.order`, extended `memory.patch`
- `unit/schema-compliance.test.ts` — migration 029 columns and constraints exist

### E2E (Playwright)
- New file `tests/multi-item-memory.spec.ts`
  - Toggle upload to "one memory" → verify single Memory + N MemoryMedia
  - Toggle upload to "separately" → verify N Memories (existing behaviour preserved)
  - Add a text slide during upload → verify it appears in modal carousel
  - Edit existing single-photo memory → add a slide → verify timeline card now shows stack
  - Remove cover image → verify cover falls back to next image
  - Reorder slides → verify display_order persisted

## 10. Out of Scope

- **Per-slide comments/reactions** — comments and reactions stay at memory level. Adding per-slide would be a much larger feature.
- **Live collaborative editing** — only the owner edits.
- **Bulk attach: convert N existing memories into 1 multi-item memory** — interesting but adds DB-rewriting complexity; defer.
- **Auto-grouping by EXIF time** — explicit toggle only for Phase 1; no magic.
- **Slide-level metadata** (per-slide caption, per-slide tags) — not needed for the use case; keep tags at memory level.
- **Reorder during upload by drag** — text MVP can be reorder-after-create only if drag is too much UI for upload; both work, but the spec assumes drag in the upload sheet too. Drop drag-during-upload to a follow-up if implementation effort balloons.

## 11. Open Risks / Tradeoffs

- **Schema-level constraint enforcement** is more complex with the new CHECK on `memorymedia_content_check`. A bug that lets an `image` row land with `storage_path = NULL` would now be a constraint violation rather than a soft fault. We accept this — it's the right invariant.
- **`storage_path` becoming nullable** could surprise older code paths that assume it's always set. Audit all reads of `MemoryMedia.storage_path` and ensure they handle `media_type = 'text'` (where `storage_path` is null and `text_content` is set).
- **`upload-media` defer=true contract** is a new flag on an existing endpoint. We should add a unit test asserting the old behaviour (no `defer` query param) is unchanged.
- **`cover_media_id` ON DELETE SET NULL** is correct — if the cover slide is removed, the memory falls back to next-image-by-display-order at read time. We do not auto-update `cover_media_id` to next slide; the application layer falls back instead. Simpler.

## 12. Build Plan Entry

Add to `docs/build-plan.md` Milestone 5 (after 5.3 batch upload):

```
- [ ] 5.4 Multi-item memories — multiple photos/videos/text slides per memory
  - Toggle in upload UI: "Post as one memory" / "Post separately" (default: separate)
  - Text slides via `MemoryMedia.media_type = 'text'` + `text_content` (migration 029)
  - Cover image: `Memory.cover_media_id`, defaults to first photo/video by display_order
  - Edit later: add/remove/reorder slides, change cover (owner only)
  - Timeline visual: stacked-polaroid effect + count badge (⊕N)
  - Modal: horizontal swipe carousel + dot indicators
  - Comments/reactions stay at memory level (unchanged)
  - Email digest cover updated to use cover_media_id
  - Backwards compatible: single-photo memories and quick notes unchanged
  - See spec: `docs/superpowers/specs/2026-05-09-multi-item-memories-design.md`
```

This belongs in Phase 1 alongside batch upload (5.3) — it's the natural next step. Mark as planned but not blocking 11.x or 12.x work.
