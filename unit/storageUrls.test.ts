/**
 * Unit tests for signedThumbnailUrl — the three signing paths:
 *   1. thumbnail_path set → sign that directly (no transform)
 *   2. no thumbnail_path, transforms disabled → fall back to plain signed URL
 *   3. no thumbnail_path, transforms enabled → sign with transform options
 *
 * Branch 3 reads SUPABASE_IMAGE_TRANSFORMS at module load time, so we can't
 * toggle it from inside a test after import. That branch is exercised on the
 * Pro-tier deployment.
 */

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
    expect(createSignedUrl).toHaveBeenCalledTimes(1)
    expect(createSignedUrl).toHaveBeenCalledWith('user/abc.thumb.webp', 3600)
  })

  it('falls back to plain signed URL when no thumbnailPath and transforms disabled', async () => {
    const { supabase, createSignedUrl } = makeMockSupabase()
    const url = await signedThumbnailUrl(supabase, 'user/abc.jpg', 3600, {
      width: 800,
    })
    expect(url).toBe('https://signed.example/foo')
    expect(createSignedUrl).toHaveBeenCalledWith('user/abc.jpg', 3600)
  })

  it('returns null when sign fails', async () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({ data: null, error: null })),
        })),
      },
    } as never
    const url = await signedThumbnailUrl(
      supabase,
      'user/abc.jpg',
      3600,
      { width: 800 },
      'user/abc.thumb.webp',
    )
    expect(url).toBeNull()
  })
})
