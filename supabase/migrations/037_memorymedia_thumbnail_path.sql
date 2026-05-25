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
