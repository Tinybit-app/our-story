# Upload-time thumbnail generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a small webp thumbnail at upload time and serve it to grid/list surfaces so mosaic cells stop downloading multi-MB originals on Supabase free tier.

**Architecture:** Client canvas-resizes the source image to ~800px webp and ships it as a second FormData field. The edge function uploads both blobs; the new `memorymedia.thumbnail_path` column points at the thumbnail. Three API routes pass that path through `signedThumbnailUrl()` so list surfaces sign the small file directly, bypassing image transforms entirely. Old memories with `NULL thumbnail_path` keep current behavior.

**Tech Stack:** Nuxt 3 (Vue, server routes), Supabase (Postgres + Storage + Edge Functions Deno), browser canvas APIs.

---

### Task 1: Migration 037 — `thumbnail_path` column

**Files:**
- Create: `supabase/migrations/037_memorymedia_thumbnail_path.sql`
- Test: `supabase/tests/037_memorymedia_thumbnail_path.test.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/037_memorymedia_thumbnail_path.sql`:

```sql
-- Pre-generated thumbnail path for memorymedia. Populated at upload time by
-- the upload-media edge function when the client successfully resizes the
-- source image. NULL for memories uploaded before this feature, or when
-- client-side resize was skipped (videos, HEIC on Chrome, files <200KB).
--
-- NEVER expose to the client — like storage_path, it gets signed server-side
-- only. Lives in the same `memories-private` bucket as the original.

ALTER TABLE public.MemoryMedia
  ADD COLUMN thumbnail_path TEXT;

COMMENT ON COLUMN public.MemoryMedia.thumbnail_path IS
  'Pre-generated ~800px webp thumbnail in memories-private bucket. NULL when no thumbnail exists. NEVER expose to client — sign server-side only.';
```

- [ ] **Step 2: Write the failing pgTAP test**

`supabase/tests/037_memorymedia_thumbnail_path.test.sql`:

```sql
BEGIN;
SELECT plan(3);

SELECT has_column('memorymedia', 'thumbnail_path',
  'memorymedia.thumbnail_path column exists');

SELECT col_type_is('memorymedia', 'thumbnail_path', 'text',
  'thumbnail_path is TEXT');

SELECT col_is_null('memorymedia', 'thumbnail_path',
  'thumbnail_path is nullable');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Reset DB and run tests**

Run: `pnpm db:reset && pnpm db:test`
Expected: all pgTAP tests pass including the 3 new assertions.

- [ ] **Step 4: Regenerate TypeScript types**

Run: `pnpm db:types`

Expected: `app/types/database.ts` updates so the `MemoryMedia` row type now includes `thumbnail_path: string | null`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/037_memorymedia_thumbnail_path.sql \
        supabase/tests/037_memorymedia_thumbnail_path.test.sql \
        app/types/database.ts
git commit -m "feat(db): add memorymedia.thumbnail_path column (migration 037)"
```

---

### Task 2: Extend `signedThumbnailUrl()` with `thumbnailPath` arg

**Files:**
- Modify: `server/utils/storageUrls.ts`
- Test: `unit/storageUrls.test.ts` (create if missing)

- [ ] **Step 1: Check whether the unit test file exists**

Run: `ls unit/storageUrls.test.ts`
If missing, this task creates it. If it exists, append cases.

- [ ] **Step 2: Write the failing unit tests**

`unit/storageUrls.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signedThumbnailUrl } from '../server/utils/storageUrls'

function makeMockSupabase(signedUrl = 'https://signed.example/foo') {
  const createSignedUrl = vi.fn(async () => ({
    data: { signedUrl },
    error: null,
  }))
  const supabase = {
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as never
  return { supabase, createSignedUrl }
}

describe('signedThumbnailUrl', () => {
  beforeEach(() => {
    delete process.env.SUPABASE_IMAGE_TRANSFORMS
    delete process.env.NUXT_SUPABASE_IMAGE_TRANSFORMS
  })

  it('signs thumbnailPath directly when set (no transform)', async () => {
    const { supabase, createSignedUrl } = makeMockSupabase()
    const url = await signedThumbnailUrl(
      supabase,
      'user/abc.jpg',
      3600,
      { width: 800 },
      'user/abc.thumb.webp',
    )
    expect(url).toBe('https://signed.example/foo')
    expect(createSignedUrl).toHaveBeenCalledWith('user/abc.thumb.webp', 3600)
  })

  it('falls back to plain signed URL when no thumbnailPath and transforms disabled', async () => {
    const { supabase, createSignedUrl } = makeMockSupabase()
    await signedThumbnailUrl(supabase, 'user/abc.jpg', 3600, { width: 800 })
    expect(createSignedUrl).toHaveBeenCalledWith('user/abc.jpg', 3600)
  })

  // Note: SUPABASE_IMAGE_TRANSFORMS is read at module load time (`const
  // transformsEnabled = ...`), so we cannot toggle it from inside a test
  // after import. The "transforms enabled" branch is exercised manually on
  // the Pro-tier environment.
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test unit/storageUrls.test.ts`
Expected: 2 failures — `signedThumbnailUrl` doesn't accept a 5th arg yet.

- [ ] **Step 4: Update `signedThumbnailUrl`**

`server/utils/storageUrls.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

// Free-tier Supabase projects don't have image transformations; signed URLs
// generated with `transform: { ... }` return 403 FeatureNotEnabled at fetch
// time. Set SUPABASE_IMAGE_TRANSFORMS=true on Pro+ projects to opt in.
const transformsEnabled =
  process.env.SUPABASE_IMAGE_TRANSFORMS === 'true' ||
  process.env.NUXT_SUPABASE_IMAGE_TRANSFORMS === 'true'

type TransformOpts = {
  width: number
  format?: 'origin' | 'webp'
  quality?: number
}

export async function signedThumbnailUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds: number,
  transform: TransformOpts,
  thumbnailPath?: string | null,
): Promise<string | null> {
  // If we have a pre-generated thumbnail (uploaded at memory-create time),
  // serve it directly. No transform call needed — works on every tier and
  // is the cheapest path even on Pro.
  if (thumbnailPath) {
    const { data } = await supabase.storage
      .from('memories-private')
      .createSignedUrl(thumbnailPath, ttlSeconds)
    return data?.signedUrl ?? null
  }

  if (!transformsEnabled) {
    const { data } = await supabase.storage
      .from('memories-private')
      .createSignedUrl(storagePath, ttlSeconds)
    return data?.signedUrl ?? null
  }
  const { data } = await supabase.storage
    .from('memories-private')
    .createSignedUrl(storagePath, ttlSeconds, {
      transform: { format: 'origin', quality: 85, ...transform } as never,
    })
  return data?.signedUrl ?? null
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test unit/storageUrls.test.ts`
Expected: all 2 pass.

- [ ] **Step 6: Commit**

```bash
git add server/utils/storageUrls.ts unit/storageUrls.test.ts
git commit -m "feat(storage): signedThumbnailUrl accepts thumbnailPath shortcut"
```

---

### Task 3: Wire 3 API routes to pass `thumbnail_path`

**Files:**
- Modify: `server/api/timeline.get.ts`
- Modify: `server/api/viewer/timeline.get.ts`
- Modify: `server/api/circles/[id]/viewer-links.get.ts`

For each route: (a) add `thumbnail_path` to the `memorymedia` select, (b) pass `media.thumbnail_path` as the 5th arg to `signedThumbnailUrl()`.

- [ ] **Step 1: Locate the memorymedia selects**

Run: `grep -n "memorymedia\b.*storage_path\|storage_path.*memorymedia\|select.*storage_path" server/api/timeline.get.ts server/api/viewer/timeline.get.ts server/api/circles/[id]/viewer-links.get.ts`

For each file, find the line that selects `storage_path` from `memorymedia`. The PostgREST embeds typically look like `memorymedia!memory_id(id, url, ..., storage_path, ...)` — append `, thumbnail_path`.

- [ ] **Step 2: Update `server/api/timeline.get.ts`**

In the `memorymedia!memory_id(...)` embed select string, add `thumbnail_path` next to `storage_path`.

In `attachSignedUrls` (around line 408), change the `signedThumbnailUrl(...)` call to pass `storage_path`'s sibling `thumbnail_path`:

```ts
signedThumbnailUrl(supabase, storage_path, 86400, {
  width: 800,
  format: 'webp',
  quality: 85,
}, media.thumbnail_path),
```

The shape of `media` inside the loop needs to expose `thumbnail_path`. If `attachSignedUrls` destructures only `storage_path` from media, also destructure `thumbnail_path` and pass it.

- [ ] **Step 3: Update `server/api/viewer/timeline.get.ts`**

Same two changes: add `thumbnail_path` to the select, pass it to `signedThumbnailUrl`.

- [ ] **Step 4: Update `server/api/circles/[id]/viewer-links.get.ts`**

Same two changes. (Width here is 100, not 800, but the path-passing logic is identical.)

- [ ] **Step 5: Verify existing E2E tests still pass**

Run: `pnpm exec playwright test tests/comments.spec.ts tests/multi-item-memory.spec.ts tests/viewer-link.spec.ts tests/timeline-year.spec.ts --reporter=line`
Expected: all pass. We changed only what gets signed when `thumbnail_path` is non-null; all current test fixtures leave it null, so behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add server/api/timeline.get.ts \
        server/api/viewer/timeline.get.ts \
        server/api/circles/[id]/viewer-links.get.ts
git commit -m "feat(api): pass memorymedia.thumbnail_path to signedThumbnailUrl"
```

---

### Task 4: Edge function — accept + upload `thumbnail` FormData field

**Files:**
- Modify: `supabase/functions/upload-media/index.ts`

- [ ] **Step 1: Add thumbnail-handling block after the original upload succeeds**

After the existing original upload (around line 109) and before the `memory.insert` (line 112), add:

```ts
// Optional client-generated thumbnail. Failure here is non-fatal — original
// is already saved and the read path falls back to signing the original.
const thumbnail = formData.get('thumbnail')
let thumbnailPath: string | null = null
if (thumbnail instanceof File || thumbnail instanceof Blob) {
  // Derive thumb path from the original's path: strip the extension and
  // append .thumb.webp. The original is `{user}/{uuid}.{ext}`.
  const dot = storagePath.lastIndexOf('.')
  const base = dot > 0 ? storagePath.slice(0, dot) : storagePath
  const thumbPath = `${base}.thumb.webp`
  const thumbBuffer = await thumbnail.arrayBuffer()
  const { error: thumbErr } = await supabase.storage
    .from('memories-private')
    .upload(thumbPath, thumbBuffer, { contentType: 'image/webp' })
  if (thumbErr) {
    console.error(`[upload-media] thumb upload failed (${thumbPath}):`, thumbErr.message)
  } else {
    thumbnailPath = thumbPath
  }
}
```

- [ ] **Step 2: Persist `thumbnail_path` on the insert**

In the `memorymedia.insert(...)` call (around line 137), add the field:

```ts
.insert({
  memory_id: memory.id,
  storage_path: storagePath,
  thumbnail_path: thumbnailPath,
  file_size: file.size,
  media_type: isVideo ? 'video' : 'photo',
  display_order: 0,
})
```

- [ ] **Step 3: Add thumbnail cleanup on insert failures**

The two existing `supabase.storage.from('memories-private').remove([storagePath])` calls (cleanup paths on memory insert failure and on memorymedia insert failure) need to also remove the thumbnail when present. Wrap each in a helper or change to:

```ts
const toRemove = thumbnailPath ? [storagePath, thumbnailPath] : [storagePath]
await supabase.storage.from('memories-private').remove(toRemove)
```

- [ ] **Step 4: Deploy and verify**

Run: `pnpm supabase:deploy functions`

Upload a photo manually via the UI in UAT. In the Supabase dashboard:
- Confirm two blobs exist under `memories-private/{user}/{uuid}.*` — the original and `.thumb.webp`.
- Confirm the `memorymedia` row has both `storage_path` and `thumbnail_path` populated.

(The client doesn't send `thumbnail` yet — but you can fake it via DevTools or wait for Task 6. Easier: defer this manual check to after Task 6.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/upload-media/index.ts
git commit -m "feat(upload-media): accept + persist optional thumbnail blob"
```

---

### Task 5: `resizeImage()` client utility

**Files:**
- Create: `app/utils/resizeImage.ts`
- Test: `unit/resizeImage.test.ts`

- [ ] **Step 1: Write the failing unit tests**

`unit/resizeImage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resizeImage } from '../app/utils/resizeImage'

describe('resizeImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for video files', async () => {
    const file = new File([new Uint8Array(2_000_000)], 'movie.mov', {
      type: 'video/quicktime',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })

  it('returns null for tiny files already under the threshold', async () => {
    const file = new File([new Uint8Array(50_000)], 'tiny.jpg', {
      type: 'image/jpeg',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })

  it('returns null when createImageBitmap is unavailable', async () => {
    // jsdom doesn't implement createImageBitmap by default.
    const file = new File([new Uint8Array(2_000_000)], 'big.jpg', {
      type: 'image/jpeg',
    })
    const result = await resizeImage(file)
    // Without a real canvas/createImageBitmap, we expect a graceful null.
    expect(result).toBeNull()
  })

  it('returns null when decode throws', async () => {
    const file = new File([new Uint8Array(2_000_000)], 'corrupt.jpg', {
      type: 'image/jpeg',
    })
    // Stub createImageBitmap to throw, simulating a corrupt image.
    ;(globalThis as any).createImageBitmap = vi.fn(async () => {
      throw new Error('Invalid image')
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })
})
```

(The "happy path" — a real image resize producing a webp Blob — is best verified via E2E or manual smoke; canvas + webp encoding is hard to mock meaningfully.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test unit/resizeImage.test.ts`
Expected: all 4 fail with "Cannot find module".

- [ ] **Step 3: Implement `resizeImage`**

`app/utils/resizeImage.ts`:

```ts
const TARGET_LONGEST_EDGE = 800
const QUALITY = 0.8
const MIN_BYTES_TO_BOTHER = 200 * 1024 // 200 KB

export async function resizeImage(file: File): Promise<Blob | null> {
  if (file.type.startsWith('video/')) return null
  if (file.size <= MIN_BYTES_TO_BOTHER) return null
  if (typeof createImageBitmap !== 'function') return null

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, TARGET_LONGEST_EDGE / Math.max(width, height))
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)

    let blob: Blob | null = null
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(bitmap, 0, 0, w, h)
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY })
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(bitmap, 0, 0, w, h)
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', QUALITY),
      )
    }
    bitmap.close?.()
    return blob
  } catch (err) {
    console.warn('[resizeImage] failed:', err)
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test unit/resizeImage.test.ts`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add app/utils/resizeImage.ts unit/resizeImage.test.ts
git commit -m "feat(client): resizeImage utility (800px webp, q80)"
```

---

### Task 6: Wire `resizeImage` into `UploadMemory.vue`

**Files:**
- Modify: `app/components/UploadMemory.vue`

- [ ] **Step 1: Add the import**

Near the top of `<script setup>` (alongside other imports):

```ts
import { resizeImage } from '~/utils/resizeImage'
```

- [ ] **Step 2: Add the thumbnail to `uploadItem` FormData**

`uploadItem` (around line 1200): after creating `formData` and before appending fields, generate and append the thumbnail. Insert right after `const formData = new FormData()`:

```ts
const formData = new FormData()
const thumb = await resizeImage(item.file)
if (thumb) formData.append('thumbnail', thumb, 'thumb.webp')
formData.append('file', item.file)
// ...rest unchanged
```

- [ ] **Step 3: Add the thumbnail to `uploadItemDeferred` FormData**

`uploadItemDeferred` (around line 1305): same change inside that function's `new FormData()` block:

```ts
const formData = new FormData()
const thumb = await resizeImage(item.file)
if (thumb) formData.append('thumbnail', thumb, 'thumb.webp')
formData.append('file', item.file)
// ...rest unchanged
```

- [ ] **Step 4: Verify existing E2E tests still pass**

Run: `pnpm exec playwright test tests/quick-note.spec.ts tests/multi-item-memory.spec.ts tests/member-tagging.spec.ts tests/baby-age.spec.ts --reporter=line`
Expected: all pass. Upload tests use stubbed `/functions/v1/upload-media`, so adding the thumbnail field doesn't affect their assertions.

- [ ] **Step 5: Manual smoke test in UAT**

Upload a >200 KB photo via the timeline UI. In DevTools Network tab:
- Confirm the POST to `/functions/v1/upload-media` includes a `thumbnail` part in the multipart body.
- After the upload completes, navigate to `/timeline` and inspect the newly created memory's mosaic cell — the network request should now be a ~30–80 KB webp instead of multi-MB.
- Open the memory in the modal — full-size original should still load.

- [ ] **Step 6: Commit**

```bash
git add app/components/UploadMemory.vue
git commit -m "feat(upload): client-side resize to webp thumbnail before upload"
```

---

### Task 7: Delete-path cleanup

**Files:**
- Modify: `server/api/circles/[id]/members/[userId].delete.ts`

The only existing server route that removes storage blobs alongside `memorymedia` rows is the member-removal cleanup (lines 105–123). It now also needs to remove thumbnails.

- [ ] **Step 1: Select `thumbnail_path` alongside `storage_path`**

Change line ~108:

```ts
const { data: media } = await supabase
  .from('memorymedia')
  .select('storage_path, thumbnail_path')
  .in('memory_id', memoryIds)
```

- [ ] **Step 2: Remove both paths from storage**

Change lines ~113–115:

```ts
for (const m of media ?? []) {
  const paths = m.thumbnail_path
    ? [m.storage_path, m.thumbnail_path]
    : [m.storage_path]
  await supabase.storage.from('memories-private').remove(paths)
}
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test && pnpm exec playwright test tests/multi-circle.spec.ts --reporter=line`
Expected: all pass. (No existing test covers thumbnail cleanup specifically; this is a defense-in-depth change against orphaned blobs.)

- [ ] **Step 4: Commit**

```bash
git add server/api/circles/[id]/members/[userId].delete.ts
git commit -m "fix(cleanup): remove thumbnail_path blob alongside original on member purge"
```

---

### Task 8: Final verification + ship

- [ ] **Step 1: Run the full unit + E2E suites**

Run: `pnpm test && pnpm exec playwright test --reporter=line`
Expected: all unit tests green, 158 passed / 1 skipped on E2E (no regressions from baseline).

- [ ] **Step 2: Deploy migration + edge function to UAT**

Run: `pnpm supabase:deploy` (or `pnpm supabase:deploy migrations` then `pnpm supabase:deploy functions` to stage them separately).

- [ ] **Step 3: UAT smoke test**

Upload a new photo via the UAT timeline. Capture before/after Network panel screenshots:
- Old behavior: ~9 MB per mosaic cell
- New behavior: ~30–80 KB per mosaic cell on the freshly uploaded memory
- Pre-feature memories continue rendering originals (~MB-sized) — expected, no backfill scheduled.

- [ ] **Step 4: Done.**

No follow-up commit needed — the per-task commits already cover everything.
