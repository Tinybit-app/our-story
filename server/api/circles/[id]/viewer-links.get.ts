import {
  serverSupabaseUser,
  serverSupabaseClient,
  serverSupabaseServiceRole,
} from '#supabase/server'
import { signedThumbnailUrl } from '../../../utils/storageUrls'

const PREVIEW_LIMIT = 5

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized.' })

  const circleId = getRouterParam(event, 'id')!
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.sub)
    .maybeSingle()

  if (membership?.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can manage viewer links.',
    })
  }

  const { data: links, error } = await supabase
    .from('viewer_link')
    .select('id, nonce, mode, memory_ids, label, expires_at, created_at')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[viewer-links.get] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load viewer links.' })
  }

  // Service role client for signed URL generation (needs storage access)
  const serviceSupabase = serverSupabaseServiceRole(event)

  // Build preview thumbnails for selection links
  const results = await Promise.all(
    (links ?? []).map(async (link) => {
      const token = signViewerToken(circleId, secret, undefined, link.id, link.nonce)
      const isExpired = new Date(link.expires_at).getTime() < Date.now()
      const memoryCount = link.mode === 'selection' ? (link.memory_ids?.length ?? 0) : null

      // Fetch previews for selection links (first N memories)
      let previews: {
        type: 'image' | 'video' | 'note'
        url: string | null
        note: string | null
      }[] = []
      if (link.mode === 'selection' && link.memory_ids?.length) {
        const previewIds = link.memory_ids.slice(0, PREVIEW_LIMIT)
        const { data: memories } = await serviceSupabase
          .from('memory')
          .select(
            'id, note, memorymedia!memory_id(storage_path, thumbnail_path, media_type)',
          )
          .in('id', previewIds)
          .limit(PREVIEW_LIMIT)

        if (memories?.length) {
          previews = await Promise.all(
            memories.map(async (m: any) => {
              const media = m.memorymedia?.[0]
              if (!media?.storage_path) {
                // Quick note (no media)
                return { type: 'note' as const, url: null, note: m.note ?? null }
              }
              const isVideo = media.media_type === 'video'
              const [fullResult, thumbResult] = await Promise.allSettled([
                serviceSupabase.storage
                  .from('memories-private')
                  .createSignedUrl(media.storage_path, 3600),
                isVideo
                  ? Promise.resolve(null)
                  : signedThumbnailUrl(
                      serviceSupabase,
                      media.storage_path,
                      3600,
                      { width: 100, format: 'webp', quality: 60 },
                      media.thumbnail_path,
                    ),
              ])
              const fullUrl =
                fullResult.status === 'fulfilled'
                  ? (fullResult.value.data?.signedUrl ?? null)
                  : null
              const thumbUrl =
                thumbResult.status === 'fulfilled' ? (thumbResult.value ?? null) : null
              return {
                type: isVideo ? ('video' as const) : ('image' as const),
                url: thumbUrl ?? fullUrl,
                note: null,
              }
            }),
          )
        }
      }

      return {
        id: link.id,
        mode: link.mode as 'full' | 'selection',
        label: link.label,
        expiresAt: link.expires_at,
        isExpired,
        memoryCount,
        memoryIds: link.mode === 'selection' ? link.memory_ids : null,
        previews,
        token,
        createdAt: link.created_at,
      }
    }),
  )

  return results
})
