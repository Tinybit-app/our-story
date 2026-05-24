# Upload-time thumbnail generation

**Status:** approved 2026-05-23
**Owner:** Dao Zheng
**Trigger:** UAT photos load slow — mosaic cells render 9 MB originals at ~200×200 px because Supabase image transformations aren't available on the free tier (see `eb910a1`).

## Problem

`signedThumbnailUrl()` requests Supabase image transformations (`transform: { width, format, quality }`). On free-tier projects the transform parameter triggers `403 FeatureNotEnabled` at fetch time, so the util silently falls back to a plain signed URL — i.e., the **full-size original**. Every photo on the timeline mosaic is downloaded at the size the user uploaded (commonly 2–10 MB), even though it displays at ~200–400 px wide.

## Goals

- New uploads get a small, web-optimized thumbnail that drops mosaic-cell bytes by ~100×.
- Works on Supabase free tier (no image transformation feature required).
- Zero impact on existing memories — they keep current behavior.

## Non-goals

- Backfill of existing memories (deferred — UAT is throwaway, prod backlog is small).
- Multiple thumbnail sizes for different surfaces.
- Server-side resize fallback (HEIC, etc.) — accept the fallback to original on rare cases.
- Replacing Supabase image transforms for Pro-tier deployments — when both exist, `thumbnail_path` wins; transforms stay as the path for the bigger originals if/when needed.
- Live-photo handling (schema exists but the upload flow doesn't currently produce them).

## Approach

Client resizes once at upload time and ships both files in a single request. The server stores both, the API serves the cheap one to list/grid surfaces, and the heavy one only to the modal/full-screen viewer.

### 1. Client-side resize utility

`app/utils/resizeImage.ts`

```ts
export async function resizeImage(file: File): Promise<Blob | null>
```

- Returns `null` (caller falls back to no-thumbnail) for:
  - Videos (`file.type.startsWith('video/')`)
  - Files already ≤ 200 KB
  - Browser cannot decode the source (HEIC on Chrome, corrupted images)
  - Any thrown error during decode/resize/encode
- Returns a webp Blob for everything else:
  - Longest edge clamped to **800 px**
  - Quality **0.80**
  - Mime `image/webp`
- Implementation: `createImageBitmap(file)` → `OffscreenCanvas` (fallback to `HTMLCanvasElement` if unavailable) → `canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })`.
- Runs on the main thread. Acceptable because typical resize is <500 ms; worst case (50 MB photo on a low-end Android) is ~2–3 s. The existing upload progress bar already accounts for visible delay.

### 2. Upload flow

`app/components/UploadMemory.vue`

Both `uploadItem` and `uploadItemDeferred` call `resizeImage()` before constructing FormData. If a Blob comes back, append:

```ts
formData.append('thumbnail', blob, 'thumb.webp')
```

No retry, no error surfacing if `resizeImage` returns `null` — silent fallback to the original-only path is fine.

### 3. Edge function

`supabase/functions/upload-media/index.ts`

After the existing original upload succeeds:

1. Read `formData.get('thumbnail')`. If present and is a `File`/`Blob`:
2. Upload to `{user_id}/{uuid}.thumb.webp` (derive `{user_id}/{uuid}` from `storagePath` by stripping the extension).
3. If upload succeeds, include `thumbnail_path` in the `memorymedia.insert(...)` call. If upload fails, log and continue — original is still saved.

Thumbnail bytes do **not** count against `accountstorage.total_used_bytes`. They're a cache, not user data, and they'll often be <50 KB.

### 4. Schema migration

`supabase/migrations/037_memorymedia_thumbnail_path.sql`

```sql
ALTER TABLE public.MemoryMedia
  ADD COLUMN thumbnail_path TEXT;

COMMENT ON COLUMN public.MemoryMedia.thumbnail_path IS
  'Storage path for the pre-generated thumbnail (~800px webp). NULL for memories uploaded before the thumbnail feature, or when client-side resize failed. NEVER expose to client — serve signed URLs only.';
```

Nullable, additive only, no data migration. RLS unchanged (the column is server-internal like `storage_path`).

### 5. Server-side URL signing

`server/utils/storageUrls.ts`

Extend `signedThumbnailUrl()` to accept an optional `thumbnailPath` argument:

```ts
export async function signedThumbnailUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds: number,
  transform: TransformOpts,
  thumbnailPath?: string | null,
): Promise<string | null>
```

Logic:

1. If `thumbnailPath` is set → sign it directly with no transform. Return.
2. Else if `transformsEnabled` → current behavior (sign `storagePath` with transform).
3. Else → current fallback (sign `storagePath` plain).

Callers — three files — pass `media.thumbnail_path`:

- `server/api/timeline.get.ts` `attachSignedUrls`
- `server/api/viewer/timeline.get.ts`
- `server/api/circles/[id]/viewer-links.get.ts`

All three already select `storage_path` from `memorymedia`; add `thumbnail_path` to the select list.

### 6. Cleanup paths (deletion)

The existing `DELETE` flow for `memorymedia` needs to also remove `{thumbnail_path}` from storage when set. Find call sites that delete a media row + its file and add the second delete.

## File summary

**New:**
- `app/utils/resizeImage.ts` — canvas resize utility (~60 lines)
- `supabase/migrations/037_memorymedia_thumbnail_path.sql`

**Modified:**
- `app/components/UploadMemory.vue` — 2 call sites in `uploadItem` / `uploadItemDeferred`
- `supabase/functions/upload-media/index.ts` — thumbnail upload + `thumbnail_path` insert
- `server/utils/storageUrls.ts` — optional `thumbnailPath` arg
- `server/api/timeline.get.ts` — select + pass `thumbnail_path`
- `server/api/viewer/timeline.get.ts` — same
- `server/api/circles/[id]/viewer-links.get.ts` — same
- Whichever route(s) delete `memorymedia` rows — also delete thumbnail blob

## Verification

- Pick a UAT photo memory, re-upload the same image, confirm the mosaic cell's network request is now ~30–80 KB webp instead of multi-MB.
- Open the same memory in the modal, confirm full-size original still loads (existing behavior).
- Upload a HEIC from an iPhone via Chrome on desktop (or simulate by sending a `.heic` file) → confirm upload succeeds without a thumbnail, mosaic cell falls back to original (current behavior).
- Existing pre-feature memories continue to render (slow on free tier, fine on Pro).

## Risks / open questions

- **Storage usage:** thumbnails add ~5% to total storage. Acceptable since the dominant cost is the originals.
- **HEIC on Chrome:** users on desktop Chrome uploading HEIC will silently get no thumbnail. Acceptable for now; revisit if it's common in analytics.
- **Resize quality on low-end devices:** worst case is a 2–3 s freeze on the main thread for a 50 MB photo. If this surfaces as a UX complaint, move to a Web Worker — small refactor.
