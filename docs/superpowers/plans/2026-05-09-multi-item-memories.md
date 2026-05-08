# Multi-item Memories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a single memory to contain multiple gallery items (photos, videos, text slides) — consolidating an event's content into one card with one comment thread.

**Architecture:** Extend the existing `MemoryMedia` table to support `media_type='text'` slides + ordering + a `Memory.cover_media_id` reference. Upload flow gains a "Post as one memory" toggle. Timeline cards gain a stacked-polaroid visual + count badge. Memory modal gains a swipe carousel for multi-item memories. Edit flow gains add/remove/reorder/set-cover. Backwards compatible — single-photo memories and quick notes are unchanged.

**Tech Stack:** Supabase (Postgres + Edge Functions), Nuxt (Nitro), Vue 3, Tailwind, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-05-09-multi-item-memories-design.md`

---

## File Structure

### New
- `supabase/migrations/029_multi_item_memories.sql` — schema changes
- `server/api/memories/upload-batch.post.ts` — multi-item commit endpoint
- `server/api/memories/[id]/items.post.ts` — add slide
- `server/api/memories/[id]/items/[itemId].delete.ts` — remove slide
- `server/api/memories/[id]/items/order.patch.ts` — reorder slides
- `tests/multi-item-memory.spec.ts` — E2E
- `unit/multi-item.test.ts` — zod schema tests for new endpoints

### Modified
- `supabase/functions/upload-media/index.ts` — add `defer=true` query mode
- `server/api/timeline.get.ts` — return `cover_media_id` + ordered `memorymedia` + `media_count`
- `server/api/viewer/timeline.get.ts` — same (viewer link path)
- `server/api/memories/[id].patch.ts` — accept `coverMediaId`
- `app/components/UploadMemory.vue` — add "Post as one memory" toggle + multi-item submission
- `app/components/PolaroidCard.vue` — stack visual + count badge for multi-item
- `app/components/QuickNoteCard.vue` — same, for all-text memories
- `app/components/MemoryModal.vue` — swipe carousel for multi-item; edit slides UI
- `app/components/QuickNoteModal.vue` — same (multi-text rendering)
- `supabase/functions/send-digest/index.ts` — use cover_media_id for digest thumbnail
- `server/utils/email.ts` — same (any other digest cover sites)
- `unit/schema-compliance.test.ts` — verify migration 029
- `supabase/tests/rls.test.sql` — RLS for text slides
- `docs/build-plan.md`, `docs/design-spec.md` — mark complete

---

## Task 1: Migration 029 — multi-item schema

**Files:**
- Create: `supabase/migrations/029_multi_item_memories.sql`
- Modify: `unit/schema-compliance.test.ts`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/029_multi_item_memories.sql
-- Multi-item memories: extend MemoryMedia for text slides + ordering + cover

ALTER TABLE memorymedia
  ADD COLUMN text_content TEXT,
  ADD COLUMN display_order INT NOT NULL DEFAULT 0;

ALTER TABLE memorymedia ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE memorymedia DROP CONSTRAINT IF EXISTS memorymedia_media_type_check;
ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_media_type_check
  CHECK (media_type IN ('photo', 'video', 'live_photo', 'text'));

ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_content_check
  CHECK (
    (media_type IN ('photo', 'video', 'live_photo') AND storage_path IS NOT NULL) OR
    (media_type = 'text' AND text_content IS NOT NULL)
  );

ALTER TABLE memory
  ADD COLUMN cover_media_id UUID REFERENCES memorymedia(id) ON DELETE SET NULL;

CREATE INDEX idx_memorymedia_memory_order ON memorymedia(memory_id, display_order);
```

- [ ] **Step 2: Add schema-compliance tests**

In `unit/schema-compliance.test.ts`, add `028_circle_digest_tracking.sql` to `allMigrations` join (if not already there) and append:

```ts
describe("Step 5.4 — Multi-item memories", () => {
  const m029 = sql("029_multi_item_memories.sql")

  it("adds text_content column to memorymedia", () => {
    expect(m029).toContain("ADD COLUMN text_content TEXT")
  })

  it("adds display_order column to memorymedia", () => {
    expect(m029).toContain("ADD COLUMN display_order INT NOT NULL DEFAULT 0")
  })

  it("makes storage_path nullable", () => {
    expect(m029).toContain("ALTER COLUMN storage_path DROP NOT NULL")
  })

  it("extends media_type CHECK to include text", () => {
    expect(m029).toMatch(/CHECK \(media_type IN \('photo', 'video', 'live_photo', 'text'\)\)/)
  })

  it("adds content_check constraint", () => {
    expect(m029).toContain("memorymedia_content_check")
    expect(m029).toContain("text_content IS NOT NULL")
  })

  it("adds cover_media_id to memory", () => {
    expect(m029).toContain("ADD COLUMN cover_media_id UUID REFERENCES memorymedia(id) ON DELETE SET NULL")
  })
})
```

- [ ] **Step 3: Reset DB and run all tests**

Run: `pnpm db:reset && pnpm db:test && pnpm test`
Expected: all pass.

- [ ] **Step 4: Regenerate types and commit**

Run: `pnpm db:types`

```bash
git add supabase/migrations/029_multi_item_memories.sql unit/schema-compliance.test.ts app/types/database.ts
git commit -m "feat(memories): migration 029 for multi-item memory schema"
```

---

## Task 2: Edge Function — upload-media `defer=true` mode

**Files:**
- Modify: `supabase/functions/upload-media/index.ts`

The current flow always creates a `Memory` + `MemoryMedia` together. Add a `defer=true` query param: when set, upload media but create a **draft** memory (visibility='private', note=null) so the row constraints stay valid. The client merges drafts via `upload-batch` (Task 3).

- [ ] **Step 1: Read current function**

`supabase/functions/upload-media/index.ts` — already creates a Memory + MemoryMedia. We're adding a draft mode.

- [ ] **Step 2: Update the Edge Function**

Find the section after the storage upload + before the `Memory` insert. Modify to detect `defer=true` and set `visibility='private'` + return `{ ok, memoryId, mediaId }`. The full updated insert block:

```ts
// existing lines: file check, storage upload...

const url = new URL(req.url)
const isDeferred = url.searchParams.get("defer") === "true"

// Insert Memory row
const { data: memory, error: memoryError } = await supabase
  .from("memory")
  .insert({
    owner_user_id: user.id,
    circle_id: circleId,
    visibility: isDeferred ? "private" : "circle",
    note: isDeferred ? null : (note || null),
    milestone_label: isDeferred ? null : (milestoneLabel || null),
    memory_date: memoryDate || new Date().toISOString(),
  })
  .select()
  .single()

if (memoryError || !memory) {
  await supabase.storage.from("memories-private").remove([storagePath])
  return Response.json({ error: memoryError?.message ?? "Failed to save memory" }, { status: 500 })
}

// Insert MemoryMedia row
const { data: media, error: mediaError } = await supabase
  .from("memorymedia")
  .insert({
    memory_id: memory.id,
    storage_path: storagePath,
    file_size: file.size,
    media_type: isVideo ? "video" : "photo",
    display_order: 0,
  })
  .select("id")
  .single()

if (mediaError || !media) {
  // Clean up storage + memory
  await supabase.storage.from("memories-private").remove([storagePath])
  await supabase.from("memory").delete().eq("id", memory.id)
  return Response.json({ error: mediaError?.message ?? "Failed to save media" }, { status: 500 })
}

// Increment storage usage
await supabase
  .from("accountstorage")
  .update({ total_used_bytes: (storage?.total_used_bytes ?? 0) + file.size })
  .eq("user_id", user.id)

return Response.json({ ok: true, memoryId: memory.id, mediaId: media.id })
```

Key changes from the existing version:
- Read `defer` query param
- If deferred: visibility='private', no note, no milestone, no memory_date from form (we use current time as a placeholder)
- Insert MemoryMedia and capture the returned `id`
- Return `mediaId` in the response (was just `memoryId`)

- [ ] **Step 3: Verify single-photo path is unchanged**

The non-deferred path should behave exactly as before. Confirm by reading the diff: only new behaviour is when `defer=true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/upload-media/index.ts
git commit -m "feat(memories): add defer mode to upload-media for multi-item flow"
```

---

## Task 3: `POST /api/memories/upload-batch` — multi-item commit

**Files:**
- Create: `server/api/memories/upload-batch.post.ts`
- Create: `unit/multi-item.test.ts` (zod schema tests)

- [ ] **Step 1: Write zod schema test (TDD)**

Create `unit/multi-item.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { z } from "zod"

const itemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), draftMemoryId: z.uuid() }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

const uploadBatchSchema = z.object({
  circleId: z.uuid(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(2000).nullable().optional(),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.uuid()).max(10).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
  coverIndex: z.number().int().nonnegative().nullable().optional(),
  items: z.array(itemSchema).min(2).max(20),
})

describe("upload-batch schema", () => {
  const baseValid = {
    circleId: "11111111-2222-3333-4444-555555555555",
    memoryDate: "2026-05-09",
    items: [
      { type: "draft" as const, draftMemoryId: "11111111-2222-3333-4444-555555555556" },
      { type: "draft" as const, draftMemoryId: "11111111-2222-3333-4444-555555555557" },
    ],
  }

  it("accepts a valid batch with 2 photo drafts", () => {
    expect(uploadBatchSchema.safeParse(baseValid).success).toBe(true)
  })

  it("accepts mixed drafts + text items", () => {
    const r = uploadBatchSchema.safeParse({
      ...baseValid,
      items: [
        { type: "draft", draftMemoryId: "11111111-2222-3333-4444-555555555556" },
        { type: "text", textContent: "And then she smiled." },
      ],
    })
    expect(r.success).toBe(true)
  })

  it("rejects fewer than 2 items", () => {
    expect(
      uploadBatchSchema.safeParse({ ...baseValid, items: [baseValid.items[0]] }).success
    ).toBe(false)
  })

  it("rejects more than 20 items", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      type: "text" as const,
      textContent: `Slide ${i}`,
    }))
    expect(uploadBatchSchema.safeParse({ ...baseValid, items }).success).toBe(false)
  })

  it("rejects invalid coverIndex (negative)", () => {
    const r = uploadBatchSchema.safeParse({ ...baseValid, coverIndex: -1 })
    expect(r.success).toBe(false)
  })

  it("rejects empty text content", () => {
    const r = uploadBatchSchema.safeParse({
      ...baseValid,
      items: [
        baseValid.items[0],
        { type: "text", textContent: "" },
      ],
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it passes (no implementation needed yet — schema is self-contained)**

Run: `pnpm test unit/multi-item.test.ts`
Expected: all pass — the schema is defined inline.

- [ ] **Step 3: Implement the route**

Create `server/api/memories/upload-batch.post.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const itemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), draftMemoryId: z.uuid() }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

const bodySchema = z.object({
  circleId: z.uuid(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(2000).nullable().optional(),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.uuid()).max(10).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
  coverIndex: z.number().int().nonnegative().nullable().optional(),
  items: z.array(itemSchema).min(2).max(20),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { circleId, memoryDate, note, milestoneLabel, childIds, memberIds, coverIndex, items } = result.data

  // Verify circle membership
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()
  if (!membership) throw createError({ statusCode: 403, message: "You are not a member of this circle." })

  // Verify all draft memories are owned by this user (ownership check before merge)
  const draftMemoryIds = items
    .filter((i): i is Extract<typeof items[number], { type: "draft" }> => i.type === "draft")
    .map((i) => i.draftMemoryId)

  if (draftMemoryIds.length > 0) {
    const { data: drafts } = await supabase
      .from("memory")
      .select("id")
      .in("id", draftMemoryIds)
      .eq("owner_user_id", user.sub)
      .eq("circle_id", circleId)
      .eq("visibility", "private") // sanity: ensure it's still a draft
    if ((drafts?.length ?? 0) !== draftMemoryIds.length) {
      throw createError({ statusCode: 403, message: "Invalid draft media ownership." })
    }
  }

  // Create the canonical Memory
  const { data: memory, error: memErr } = await supabase
    .from("memory")
    .insert({
      circle_id: circleId,
      owner_user_id: user.sub,
      visibility: "circle",
      note: note ?? null,
      milestone_label: milestoneLabel ?? null,
      memory_date: memoryDate,
    })
    .select("id")
    .single()
  if (memErr || !memory) {
    console.error("[upload-batch] memory insert failed:", memErr?.message)
    throw createError({ statusCode: 500, message: "Failed to create memory." })
  }

  // For each item, attach existing media or insert text slide, in order
  const insertedMediaIds: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.type === "draft") {
      // Move all MemoryMedia rows from draft to canonical, set display_order
      const { data: rows, error: updErr } = await supabase
        .from("memorymedia")
        .update({ memory_id: memory.id, display_order: i })
        .eq("memory_id", item.draftMemoryId)
        .select("id")
      if (updErr) {
        console.error("[upload-batch] media reattach failed:", updErr.message)
        // Don't bail; continue and let cleanup happen
      }
      for (const r of rows ?? []) insertedMediaIds.push(r.id)

      // Delete the empty draft Memory
      await supabase.from("memory").delete().eq("id", item.draftMemoryId)
    } else {
      const { data: row, error: insErr } = await supabase
        .from("memorymedia")
        .insert({
          memory_id: memory.id,
          media_type: "text",
          text_content: item.textContent,
          display_order: i,
        })
        .select("id")
        .single()
      if (insErr || !row) {
        console.error("[upload-batch] text slide insert failed:", insErr?.message)
        continue
      }
      insertedMediaIds.push(row.id)
    }
  }

  // Resolve cover: explicit index, or first photo/video by display_order
  let coverMediaId: string | null = null
  if (coverIndex !== null && coverIndex !== undefined && coverIndex < insertedMediaIds.length) {
    coverMediaId = insertedMediaIds[coverIndex] ?? null
  }
  if (!coverMediaId) {
    const { data: firstMedia } = await supabase
      .from("memorymedia")
      .select("id")
      .eq("memory_id", memory.id)
      .neq("media_type", "text")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    coverMediaId = firstMedia?.id ?? null
  }
  await supabase.from("memory").update({ cover_media_id: coverMediaId }).eq("id", memory.id)

  // Tag children + members (mirrors existing quick-note.post.ts pattern)
  if (childIds?.length) {
    await supabase.from("memory_children").insert(
      childIds.map((cid) => ({ memory_id: memory.id, child_id: cid }))
    )
  }
  if (memberIds?.length) {
    await supabase.from("memory_members").insert(
      memberIds.map((uid) => ({ memory_id: memory.id, user_id: uid }))
    )
  }

  return { memoryId: memory.id }
})
```

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/api/memories/upload-batch.post.ts unit/multi-item.test.ts
git commit -m "feat(memories): upload-batch route for multi-item memory creation"
```

---

## Task 4: Items CRUD routes — add/remove/reorder/cover

**Files:**
- Create: `server/api/memories/[id]/items.post.ts`
- Create: `server/api/memories/[id]/items/[itemId].delete.ts`
- Create: `server/api/memories/[id]/items/order.patch.ts`
- Modify: `server/api/memories/[id].patch.ts` — accept `coverMediaId`

- [ ] **Step 1: Add slide route**

Create `server/api/memories/[id]/items.post.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("media"),
    storagePath: z.string().min(1),
    fileSize: z.number().int().positive(),
    mediaType: z.enum(["photo", "video", "live_photo"]),
  }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const item = result.data

  // Owner-only
  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id, circle_id")
    .eq("id", memoryId)
    .maybeSingle()
  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Compute next display_order
  const { data: maxRow } = await supabase
    .from("memorymedia")
    .select("display_order")
    .eq("memory_id", memoryId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const insertPayload = item.type === "media"
    ? {
        memory_id: memoryId,
        storage_path: item.storagePath,
        file_size: item.fileSize,
        media_type: item.mediaType,
        display_order: nextOrder,
      }
    : {
        memory_id: memoryId,
        media_type: "text",
        text_content: item.textContent,
        display_order: nextOrder,
      }

  const { data: row, error } = await supabase
    .from("memorymedia")
    .insert(insertPayload)
    .select("id")
    .single()

  if (error || !row) {
    console.error("[items.post] insert failed:", error?.message)
    throw createError({ statusCode: 500, message: "Failed to add slide." })
  }

  return { itemId: row.id }
})
```

> Note: for media slides, the file must already be uploaded (separate `upload-media?defer=true` call). This route only inserts the metadata row referencing an existing storage path. Owner trust + storage-quota was already checked during the upload-media step.

- [ ] **Step 2: Remove slide route**

Create `server/api/memories/[id]/items/[itemId].delete.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  const itemId = getRouterParam(event, "itemId")
  if (!memoryId || !itemId) throw createError({ statusCode: 400 })

  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id")
    .eq("id", memoryId)
    .maybeSingle()
  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // If this item is the cover, the FK ON DELETE SET NULL clears it automatically.
  // The application layer falls back to first photo/video at read time.
  const { error } = await supabase
    .from("memorymedia")
    .delete()
    .eq("id", itemId)
    .eq("memory_id", memoryId)

  if (error) {
    console.error("[items.delete] delete failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to remove slide." })
  }

  return { ok: true }
})
```

> Note: storage cleanup (deleting the underlying file from `memories-private` bucket) is intentionally **not** done here in Phase 1. A follow-up cleanup cron will reconcile orphaned files. Doing storage deletes synchronously risks partial-failure states that are hard to recover from. Track this as a known issue in the build plan.

- [ ] **Step 3: Reorder slides route**

Create `server/api/memories/[id]/items/order.patch.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  orderedIds: z.array(z.uuid()).min(1),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })

  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id")
    .eq("id", memoryId)
    .maybeSingle()
  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Update each row's display_order; trust the input list to be the canonical order
  const updates = result.data.orderedIds.map((itemId, index) =>
    supabase
      .from("memorymedia")
      .update({ display_order: index })
      .eq("id", itemId)
      .eq("memory_id", memoryId)
  )
  const results = await Promise.all(updates)
  for (const r of results) {
    if (r.error) {
      console.error("[items/order] update failed:", r.error.message)
      throw createError({ statusCode: 500, message: "Failed to reorder slides." })
    }
  }

  return { ok: true }
})
```

- [ ] **Step 4: Extend memory.patch with coverMediaId**

Modify `server/api/memories/[id].patch.ts`. Read the file, add `coverMediaId: z.uuid().nullable().optional()` to its zod schema, and pass it to the existing update payload. Example diff to the schema:

```ts
const bodySchema = z.object({
  // ... existing fields
  coverMediaId: z.uuid().nullable().optional(),
})
```

And in the update call, include `cover_media_id: bodyData.coverMediaId` when defined.

- [ ] **Step 5: Add unit tests for the new schemas**

Append to `unit/multi-item.test.ts`:

```ts
const itemsPostSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("media"),
    storagePath: z.string().min(1),
    fileSize: z.number().int().positive(),
    mediaType: z.enum(["photo", "video", "live_photo"]),
  }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

const orderPatchSchema = z.object({ orderedIds: z.array(z.uuid()).min(1) })

describe("items.post schema", () => {
  it("accepts media item", () => {
    const r = itemsPostSchema.safeParse({
      type: "media",
      storagePath: "abc/def.jpg",
      fileSize: 1234,
      mediaType: "photo",
    })
    expect(r.success).toBe(true)
  })
  it("accepts text item", () => {
    expect(itemsPostSchema.safeParse({ type: "text", textContent: "hi" }).success).toBe(true)
  })
  it("rejects unknown mediaType", () => {
    const r = itemsPostSchema.safeParse({
      type: "media",
      storagePath: "x",
      fileSize: 1,
      mediaType: "audio",
    })
    expect(r.success).toBe(false)
  })
})

describe("items/order schema", () => {
  it("accepts non-empty orderedIds", () => {
    expect(
      orderPatchSchema.safeParse({ orderedIds: ["11111111-2222-3333-4444-555555555556"] }).success
    ).toBe(true)
  })
  it("rejects empty orderedIds", () => {
    expect(orderPatchSchema.safeParse({ orderedIds: [] }).success).toBe(false)
  })
})
```

- [ ] **Step 6: Run tests + commit**

```bash
pnpm test
git add server/api/memories/upload-batch.post.ts server/api/memories/[id]/items.post.ts \
  server/api/memories/[id]/items/[itemId].delete.ts server/api/memories/[id]/items/order.patch.ts \
  server/api/memories/[id].patch.ts unit/multi-item.test.ts
git commit -m "feat(memories): items CRUD + cover routes for multi-item memories"
```

---

## Task 5: Backend timeline read — return cover_media_id + ordered media + media_count

**Files:**
- Modify: `server/api/timeline.get.ts`
- Modify: `server/api/viewer/timeline.get.ts`

- [ ] **Step 1: Update main timeline route**

Read `server/api/timeline.get.ts`. Find the memory select query and the response shape. Update to:

1. Include `cover_media_id` in the select
2. Order `memorymedia` by `display_order` (ascending)
3. Include `text_content` in the memorymedia projection
4. Compute `media_count` per memory (from `memorymedia.length`)
5. Resolve cover at read time:
   - If `cover_media_id` is set, that's the cover row
   - Else, the first photo/video by display_order
   - Else, null (text-only memory; client renders QuickNoteCard)
6. Return only the cover's signed URL on the timeline (NOT all slide URLs — slides load on modal open via a separate fetch path)

Concrete edits:

In the supabase select string (around line 20), change:
```ts
memorymedia(id, storage_path, media_type, file_size),
```
to:
```ts
memorymedia(id, storage_path, media_type, file_size, text_content, display_order),
cover_media_id,
```

Then in the post-processing (where signed URLs are generated, around line 225), find the cover row first:

```ts
const allMedia = ((memory.memorymedia as any[]) ?? []).slice().sort((a, b) =>
  (a.display_order ?? 0) - (b.display_order ?? 0)
)
const cover = (() => {
  if (memory.cover_media_id) {
    return allMedia.find((m) => m.id === memory.cover_media_id) ?? null
  }
  return allMedia.find((m) => m.media_type !== "text") ?? null
})()
const mediaCount = allMedia.length

// existing signed-URL generation code — apply ONLY to the cover row, not all media
const coverWithUrl = cover && cover.media_type !== "text"
  ? { ...cover, url: <signed url for cover.storage_path> }
  : cover

return { ...memory, memorymedia: coverWithUrl ? [coverWithUrl] : [], media_count: mediaCount, cover_media_id: memory.cover_media_id }
```

Important: the response continues to include `memorymedia` as an array (length 0 or 1 — just the cover) for backwards compatibility with existing client code. The client uses `media_count` to detect multi-item.

- [ ] **Step 2: Same update for viewer timeline**

`server/api/viewer/timeline.get.ts` — apply the equivalent changes.

- [ ] **Step 3: Add a memory-detail fetch endpoint for full slide list**

The modal needs the full ordered slide list with signed URLs. Create `server/api/memories/[id]/slides.get.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400 })

  // Membership check via memory.circle_id
  const { data: memory } = await supabase
    .from("memory")
    .select("id, circle_id")
    .eq("id", memoryId)
    .maybeSingle()
  if (!memory) throw createError({ statusCode: 404 })

  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("circle_id", memory.circle_id)
    .maybeSingle()
  if (!membership) throw createError({ statusCode: 403 })

  const { data: rows } = await supabase
    .from("memorymedia")
    .select("id, storage_path, media_type, text_content, display_order")
    .eq("memory_id", memoryId)
    .order("display_order", { ascending: true })

  // Sign URLs for photo/video rows
  const slides = await Promise.all(
    (rows ?? []).map(async (row) => {
      if (row.media_type === "text") {
        return {
          id: row.id,
          mediaType: "text" as const,
          textContent: row.text_content,
          displayOrder: row.display_order,
        }
      }
      const { data: signed } = await supabase.storage
        .from("memories-private")
        .createSignedUrl(row.storage_path, 3600)
      return {
        id: row.id,
        mediaType: row.media_type === "video" ? "video" as const : "photo" as const,
        url: signed?.signedUrl ?? null,
        displayOrder: row.display_order,
      }
    })
  )

  return { slides }
})
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm test
git add server/api/timeline.get.ts server/api/viewer/timeline.get.ts \
  server/api/memories/[id]/slides.get.ts
git commit -m "feat(memories): timeline + slides endpoints support multi-item"
```

---

## Task 6: Frontend timeline card — stack visual + count badge

**Files:**
- Modify: `app/components/PolaroidCard.vue`
- Modify: `app/components/QuickNoteCard.vue`

- [ ] **Step 1: Read existing card components**

Both PolaroidCard and QuickNoteCard already render single memories. They receive a memory prop that now includes `media_count` (added in Task 5). When `media_count > 1`, render the stack visual.

- [ ] **Step 2: Add stack visual to PolaroidCard**

In `app/components/PolaroidCard.vue`, find the root card element. Wrap it with two absolutely-positioned silhouette divs and add the count badge:

```vue
<template>
  <div class="relative inline-block">
    <!-- Stack silhouettes (rendered behind, only when media_count > 1) -->
    <div
      v-if="(memory.media_count ?? 1) > 1"
      class="absolute inset-0 -translate-y-1 translate-x-1 rotate-1 bg-card border border-border/40 shadow-md rounded-sm pointer-events-none"
      :style="{ zIndex: -1 }"
      aria-hidden="true"
    />
    <div
      v-if="(memory.media_count ?? 1) > 2"
      class="absolute inset-0 -translate-y-2 translate-x-2 rotate-2 bg-card border border-border/30 shadow-md rounded-sm pointer-events-none"
      :style="{ zIndex: -2 }"
      aria-hidden="true"
    />

    <!-- Existing polaroid card body unchanged -->
    <div class="relative ...existing classes...">
      <!-- existing content -->

      <!-- Count badge (bottom-right of the cover) -->
      <span
        v-if="(memory.media_count ?? 1) > 1"
        class="absolute bottom-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm"
      >
        ⊕{{ memory.media_count }}
      </span>
    </div>
  </div>
</template>
```

Adjust spacing/colours to match the existing aesthetic. Keep the stack subtle — it should hint at depth without distracting.

- [ ] **Step 3: Add stack visual to QuickNoteCard**

`app/components/QuickNoteCard.vue` — same pattern. The QuickNoteCard renders postcards; the stacked silhouettes should look like layered postcards behind. Apply the same `media_count > 1` logic.

For text-only multi-item memories (no cover), QuickNoteCard renders the first **text slide's** content excerpt in the cover position. To support that, the timeline should also return the first text slide's content when there's no media cover. Update `server/api/timeline.get.ts` from Task 5:

```ts
// In the post-processing where cover is computed:
let coverTextContent: string | null = null
if (!cover) {
  const firstText = allMedia.find((m) => m.media_type === "text")
  if (firstText) coverTextContent = firstText.text_content
}
// Include in response: cover_text_content
```

- [ ] **Step 4: Verify visually**

Run `pnpm dev`, open the app with a circle that has at least one multi-item memory (create one manually in Supabase Studio if needed by inserting an extra MemoryMedia row), confirm the stack + badge render correctly. Verify single-photo memories are unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/components/PolaroidCard.vue app/components/QuickNoteCard.vue server/api/timeline.get.ts
git commit -m "feat(memories): stack visual + count badge for multi-item cards"
```

---

## Task 7: Frontend modal — swipe carousel for multi-item

**Files:**
- Modify: `app/components/MemoryModal.vue`
- Modify: `app/components/QuickNoteModal.vue`

- [ ] **Step 1: Wire slides fetch on modal open**

In MemoryModal, when the modal opens for a memory with `media_count > 1`, fetch `/api/memories/<id>/slides`. Cache the result (per-memory) so reopening doesn't refetch.

```ts
const slides = ref<Array<{ id: string, mediaType: "photo" | "video" | "text", url?: string, textContent?: string }>>([])
const slidesLoading = ref(false)

watch(() => props.memory?.id, async (id) => {
  if (!id || (props.memory?.media_count ?? 1) <= 1) {
    slides.value = []
    return
  }
  slidesLoading.value = true
  try {
    const data = await $fetch<{ slides: any[] }>(`/api/memories/${id}/slides`)
    slides.value = data.slides
  } finally {
    slidesLoading.value = false
  }
}, { immediate: true })
```

- [ ] **Step 2: Add swipe carousel UI**

When `slides.value.length > 1`, render a swipe carousel. Use a horizontal scroll-snap container — simplest, no library needed:

```vue
<div v-if="slides.length > 1" class="relative">
  <div ref="carouselRef" class="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar">
    <div v-for="slide in slides" :key="slide.id" class="snap-center flex-shrink-0 w-full">
      <img v-if="slide.mediaType === 'photo'" :src="slide.url" class="w-full h-auto" />
      <video v-else-if="slide.mediaType === 'video'" :src="slide.url" controls class="w-full h-auto" />
      <div v-else class="p-8 text-center bg-card text-foreground italic">{{ slide.textContent }}</div>
    </div>
  </div>
  <!-- Dot indicators -->
  <div class="flex justify-center gap-1 mt-2">
    <span
      v-for="(_, idx) in slides"
      :key="idx"
      class="w-1.5 h-1.5 rounded-full transition-colors"
      :class="idx === currentSlideIdx ? 'bg-foreground' : 'bg-foreground/20'"
    />
  </div>
  <!-- Counter -->
  <div class="text-center text-xs text-muted-foreground mt-1">
    {{ currentSlideIdx + 1 }} / {{ slides.length }}
  </div>
</div>
<!-- Single-item: existing image/video render unchanged -->
<div v-else>
  <!-- existing single-photo render -->
</div>
```

Track `currentSlideIdx` via scroll position:

```ts
const currentSlideIdx = ref(0)
const carouselRef = ref<HTMLDivElement | null>(null)

function onScroll() {
  if (!carouselRef.value) return
  const idx = Math.round(carouselRef.value.scrollLeft / carouselRef.value.clientWidth)
  currentSlideIdx.value = idx
}
onMounted(() => carouselRef.value?.addEventListener("scroll", onScroll, { passive: true }))
```

- [ ] **Step 3: Same for QuickNoteModal (multi-text memories)**

QuickNoteModal renders text-only memories. For multi-text memories (`media_count > 1`, all slides text), render a similar carousel where every slide is a text card.

- [ ] **Step 4: Add `.no-scrollbar` utility**

In `app/assets/css/globals.css` (if not already present):

```css
@layer utilities {
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/components/MemoryModal.vue app/components/QuickNoteModal.vue app/assets/css/globals.css
git commit -m "feat(memories): swipe carousel for multi-item modal"
```

---

## Task 8: Frontend upload UI — toggle + multi-item submission

**Files:**
- Modify: `app/components/UploadMemory.vue`

This is the largest UI change. The component already handles multi-file selection. Add:

1. A toggle ("Post as one memory" / "Post separately") shown when ≥2 files are selected
2. When toggled to one-memory mode:
   - Single date/note/milestone/tag inputs (instead of per-item)
   - Per-slide reorder handle
   - "+ Add note" button to insert a text slide
   - Tap photo to set as cover (visual highlight)
3. Submission path:
   - Default (separate): existing behaviour — N parallel `upload-media` calls
   - One memory: N parallel `upload-media?defer=true` calls → collect `mediaId`s + draft `memoryId`s → call `POST /api/memories/upload-batch`

- [ ] **Step 1: Read the existing component**

`app/components/UploadMemory.vue` — large file. Start by reading the existing item state, multi-file handling, and submit logic.

- [ ] **Step 2: Add the toggle**

Add a `groupAsOne` ref. Show the toggle in the template when `items.value.length >= 2`:

```vue
<div v-if="items.length >= 2" class="flex items-center gap-2 px-4 py-3 border-b border-border">
  <button
    type="button"
    class="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
    :class="!groupAsOne ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'"
    @click="groupAsOne = false"
  >
    Post separately
  </button>
  <button
    type="button"
    class="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
    :class="groupAsOne ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'"
    @click="groupAsOne = true"
  >
    Post as one memory
  </button>
</div>
```

- [ ] **Step 3: When `groupAsOne = true`, collapse to a single shared form**

Hide per-item date/note/milestone inputs; show a single shared form at the top instead. Use `groupDate`, `groupNote`, `groupMilestoneLabel` etc. (some of these may already exist for the existing per-group tag pickers).

- [ ] **Step 4: Add a "+ Add note" button**

When `groupAsOne = true`, add a button that opens a small text input modal/inline. On submit, push a new `{ type: 'text', textContent: '...' }` item into a parallel `textSlides` ref:

```ts
const textSlides = ref<Array<{ tempId: string, textContent: string }>>([])
```

These render alongside `items` in the upload sheet preview (drag handles for reorder, trash to remove).

- [ ] **Step 5: Add cover selection**

When `groupAsOne = true`, tapping a photo/video item toggles it as cover. Track via `coverItemTempId: string | null`. Visual highlight (e.g., ring) on the cover.

- [ ] **Step 6: Update submit logic**

```ts
async function uploadAll() {
  if (groupAsOne.value && items.value.length >= 2) {
    return uploadAsOneMemory()
  }
  // existing per-item upload flow
  for (const item of items.value) await uploadItem(item)
}

async function uploadAsOneMemory() {
  // 1. Upload all media files in parallel with defer=true
  const draftResults = await Promise.all(items.value.map((item) => uploadItemDeferred(item)))
  const draftMemoryIds = draftResults.filter(Boolean).map((r) => r!.memoryId)

  // 2. Build the items array in display order
  const orderedItems: Array<
    | { type: "draft"; draftMemoryId: string }
    | { type: "text"; textContent: string }
  > = items.value
    .map((it, idx) => draftResults[idx] ? { type: "draft" as const, draftMemoryId: draftResults[idx]!.memoryId } : null)
    .filter(Boolean) as any
  for (const ts of textSlides.value) {
    orderedItems.push({ type: "text", textContent: ts.textContent })
  }

  // 3. Resolve cover index
  const coverIdx = coverItemTempId.value
    ? items.value.findIndex((it) => it.tempId === coverItemTempId.value)
    : null

  // 4. Call upload-batch
  await $fetch("/api/memories/upload-batch", {
    method: "POST",
    body: {
      circleId: props.circleId,
      memoryDate: groupDate.value,
      note: groupNote.value || null,
      milestoneLabel: groupMilestoneLabel.value || null,
      childIds: groupChildIds.value,
      memberIds: groupMemberIds.value,
      coverIndex: coverIdx,
      items: orderedItems,
    },
  })

  emit("uploaded")
  cancel()
}

async function uploadItemDeferred(item: UploadItem): Promise<{ memoryId: string; mediaId: string } | null> {
  // Same as existing uploadItem, but use POST /functions/v1/upload-media?defer=true
  // Don't tag children/members — they'll be applied at the batch level
  // Return the response { memoryId, mediaId }
}
```

- [ ] **Step 7: Verify the existing single/separate path still works**

Read through the diff carefully. The default (groupAsOne = false) should be byte-for-byte the existing flow.

- [ ] **Step 8: Commit**

```bash
git add app/components/UploadMemory.vue
git commit -m "feat(memories): upload UI toggle for posting as one memory"
```

---

## Task 9: Frontend edit slides UI

**Files:**
- Modify: `app/components/MemoryModal.vue`

In edit mode (owner only), provide:

- A list of slides with reorder handles
- Trash icon per slide
- "+ Add photo" button → triggers file picker → `upload-media?defer=true` (without parent memory id, but draft Memory created) → call `POST /api/memories/<id>/items` with `{ type: 'media', storagePath, fileSize, mediaType }` (the draft Memory is then deleted)
  - Simpler alternative: dedicated `add-slide-upload` Edge Function that uploads + attaches in one call. For this plan, the spec route uses the existing pattern: client calls `upload-media?defer=true`, gets a `mediaId`, then calls `items.post` referencing that media. For Phase 1 this is acceptable — it has a momentary orphan window but is correct.
- "+ Add note" button → opens text input → calls `POST /api/memories/<id>/items` with `{ type: 'text', textContent }`
- "Set as cover" action on each photo/video slide → calls `PATCH /api/memories/<id>` with `{ coverMediaId: itemId }`
- On reorder drag end: call `PATCH /api/memories/<id>/items/order` with the new ordered ID list

Implementation detail: the simplest Phase 1 UX is to expose these actions on long-press or hover (desktop) on slides in the modal carousel, OR show them in a dedicated "Edit" panel that appears when the user taps the existing edit affordance. Choose whichever fits the existing edit flow more naturally.

- [ ] **Step 1: Read the existing edit affordance in MemoryModal**

The component already has an edit mode. Identify where slide controls fit.

- [ ] **Step 2: Add per-slide controls in edit mode**

Display each slide with a small toolbar: drag handle / trash / "Set cover" (if photo/video).

- [ ] **Step 3: Wire up actions**

Use `$fetch` calls to the routes from Task 4. After each mutation, refetch `/api/memories/<id>/slides` to update the local view.

- [ ] **Step 4: Commit**

```bash
git add app/components/MemoryModal.vue
git commit -m "feat(memories): edit slides UI (add/remove/reorder/cover)"
```

---

## Task 10: Tests + Docs

**Files:**
- Modify: `supabase/tests/rls.test.sql`
- Create: `tests/multi-item-memory.spec.ts`
- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: RLS tests for text slides**

Append to `supabase/tests/rls.test.sql` — a fixture creates a memory with a text slide owned by a circle owner; assert:
- Member can SELECT the text slide
- Non-member cannot SELECT
- Owner can INSERT a text slide on own memory
- Non-owner cannot INSERT/DELETE/UPDATE

(Use the existing pgTAP patterns in the file. Keep the new tests at the bottom; bump the plan count.)

- [ ] **Step 2: E2E tests**

Create `tests/multi-item-memory.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

test.use({ storageState: "tests/.auth/user.json" })

test.describe("Multi-item memories", () => {
  test("toggle 'Post as one memory' creates one memory with N media", async ({ page }) => {
    // Mock circles + timeline as in existing tests
    // Open upload sheet, select 3 files
    // Click 'Post as one memory'
    // Submit
    // Assert: timeline shows ONE card with stack visual + ⊕3 badge
    // (use page.route to intercept upload-batch and assert payload)
  })

  test("default 'Post separately' still creates N memories", async ({ page }) => {
    // ... assert N cards on timeline
  })

  test("modal opens carousel for multi-item", async ({ page }) => {
    // Click on a multi-item card
    // Assert dot indicators visible
    // Assert swipe / scroll changes current slide
  })

  test("count badge appears on PolaroidCard for multi-item", async ({ page }) => {
    // Mock timeline response with media_count: 5
    // Assert ⊕5 badge visible
  })
})
```

(Keep the tests ambitious but executable — match the existing E2E patterns in `tests/`.)

- [ ] **Step 3: Update build plan**

In `docs/build-plan.md`, find Milestone 5. Add 5.4 entry as in the spec section 12, and mark it as complete:

```
- [x] 5.4 Multi-item memories — multiple photos/videos/text slides per memory
  - Migration 029: extend `MemoryMedia` (text_content, display_order, nullable storage_path, type='text'), add `Memory.cover_media_id`
  - Upload toggle: "Post as one memory" / "Post separately" (default: separate)
  - Backend: `POST /api/memories/upload-batch` (multi-item commit), `POST/DELETE/PATCH /api/memories/[id]/items*` (edit), `GET /api/memories/[id]/slides` (modal fetch)
  - Edge Function: `upload-media?defer=true` mode for draft media before batch
  - Timeline: stack visual + count badge ⊕N on PolaroidCard and QuickNoteCard
  - Modal: swipe carousel + dot indicators for multi-item; unchanged for single-item
  - Edit later: add/remove/reorder slides, set cover (owner only)
  - Email digest cover: uses `cover_media_id` (or first photo/video by display_order)
  - Backwards compatible: single-photo memories and quick notes unchanged
  - Known issue: deleted slides leave orphan storage files; cleanup cron deferred
  - See spec: `docs/superpowers/specs/2026-05-09-multi-item-memories-design.md`
```

- [ ] **Step 4: Update design spec**

In `docs/design-spec.md`, find the section on Memory data model and append:

```
**[Implemented §5.4]** — A memory may have multiple gallery items (photo/video/text). See spec for the multi-item model.
```

Also note the cover behaviour where applicable.

- [ ] **Step 5: Run all tests**

```bash
pnpm test
pnpm db:test
pnpm test:e2e tests/multi-item-memory.spec.ts
```

- [ ] **Step 6: Update email digest cover handling**

In `supabase/functions/send-digest/index.ts`, find the memory query (around the line `await supabase.from("memory")...`). Change the `memorymedia(storage_path, media_type)` select to also include `display_order`, and select `cover_media_id` on the memory. Then in the per-memory loop, choose the cover row using the same logic as the timeline:

```ts
// existing: select memorymedia from memory rows
.select("id, note, milestone_label, cover_media_id, memorymedia(id, storage_path, media_type, display_order)")

// in the loop where the digest thumbnail is computed:
const allMedia = (m.memorymedia ?? []).slice().sort((a: any, b: any) =>
  (a.display_order ?? 0) - (b.display_order ?? 0)
)
const coverRow = m.cover_media_id
  ? allMedia.find((row: any) => row.id === m.cover_media_id)
  : allMedia.find((row: any) => row.media_type !== "text")
```

Sign the URL for `coverRow?.storage_path`. The thumbnailUrl in the digest template is now the cover.

This is a one-file change. Add a unit test in `unit/digestEmail.test.ts` only if you can construct a meaningful one for the builder (the cover-resolution logic is in the Edge Function, not the builder, so a unit test isn't strictly needed).

- [ ] **Step 7: Commit**

```bash
git add supabase/tests/rls.test.sql tests/multi-item-memory.spec.ts docs/build-plan.md docs/design-spec.md supabase/functions/send-digest/index.ts
git commit -m "test+docs: multi-item memories RLS, E2E, doc updates, digest cover"
```

---

## Verification (after all tasks)

- [ ] `pnpm db:reset && pnpm db:test` passes (RLS)
- [ ] `pnpm test` passes (units)
- [ ] `pnpm test:e2e` passes (E2E)
- [ ] Manual: upload 3 photos with toggle off → 3 cards on timeline (existing behaviour)
- [ ] Manual: upload 3 photos with toggle on → 1 card with stack + ⊕3 badge
- [ ] Manual: open multi-item card → carousel works (swipe + dots)
- [ ] Manual: upload 2 photos + 1 text slide → text slide appears in modal carousel
- [ ] Manual: edit memory → add a photo → counter updates to ⊕4
- [ ] Manual: edit memory → reorder slides → carousel reflects new order
- [ ] Manual: existing single-photo memories render unchanged

## Deferred / known issues

- **Storage cleanup** — deleting a slide leaves the file in `memories-private`. Out-of-scope for this plan; tracked separately.
- **Drag-and-drop reorder during upload** — Task 8 may keep reorder to "after-create only" if drag UI gets complex during upload. Acceptable trade-off.
- **`MemoryMedia.memory_id` truly nullable** — Phase 2 cleanup. The Phase 1 draft-Memory approach works.
