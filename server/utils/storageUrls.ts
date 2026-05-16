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
): Promise<string | null> {
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
