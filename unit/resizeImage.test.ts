/**
 * Unit tests for the resizeImage client utility.
 *
 * The happy path (real image → webp Blob via canvas + createImageBitmap) is
 * exercised manually + in E2E; jsdom has no working canvas implementation, so
 * we focus here on the early-return guards that decide *not* to resize.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resizeImage } from '../app/utils/resizeImage'

describe('resizeImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete (globalThis as any).createImageBitmap
  })

  it('returns null for video files', async () => {
    const file = new File([new Uint8Array(2_000_000)], 'movie.mov', {
      type: 'video/quicktime',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })

  it('returns null for tiny files already under the 200 KB threshold', async () => {
    const file = new File([new Uint8Array(50_000)], 'tiny.jpg', {
      type: 'image/jpeg',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })

  it('returns null when createImageBitmap is unavailable', async () => {
    // jsdom doesn't implement createImageBitmap. We assert that the util
    // gracefully bails out instead of throwing — caller treats null as
    // "skip thumbnail, upload original only".
    const file = new File([new Uint8Array(2_000_000)], 'big.jpg', {
      type: 'image/jpeg',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })

  it('returns null when image decode throws', async () => {
    // Simulate a corrupt or unsupported image (e.g. HEIC on Chrome).
    ;(globalThis as any).createImageBitmap = vi.fn(async () => {
      throw new Error('The source image could not be decoded.')
    })
    const file = new File([new Uint8Array(2_000_000)], 'corrupt.heic', {
      type: 'image/heic',
    })
    const result = await resizeImage(file)
    expect(result).toBeNull()
  })
})
