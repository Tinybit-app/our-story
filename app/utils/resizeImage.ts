// Client-side thumbnail generator. Runs in the browser before upload so the
// upload-media edge function can persist a small webp alongside the original.
// The read path serves this thumbnail to mosaic/list surfaces; the full image
// is reserved for the modal/full-screen viewer.
//
// Returns null whenever resize is impossible or not worthwhile:
//   - video files (handled separately by the upload flow)
//   - files already under MIN_BYTES_TO_BOTHER (already small enough)
//   - browser cannot decode the source (HEIC on Chrome, corrupt images)
//   - canvas APIs are missing (unsupported environment)
//   - any thrown error during decode / draw / encode
// In every "null" case the upload-media edge function falls back to serving
// the original — no thumbnail, no breakage.

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
      blob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: QUALITY,
      })
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
