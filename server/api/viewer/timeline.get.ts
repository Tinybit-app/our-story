import { serverSupabaseServiceRole } from '#supabase/server'
import { signedThumbnailUrl } from '../../utils/storageUrls'

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event) as { token?: string }
  if (!token) throw createError({ statusCode: 400, message: 'Missing viewer token.' })

  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(token, secret)
    circleId = payload.circle_id
    viewerLinkId = payload.viewer_link_id
    nonce = payload.nonce
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('expired')) {
      throw createError({ statusCode: 401, message: 'expired' })
    }
    throw createError({ statusCode: 401, message: 'Invalid viewer token.' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Verify the viewer_link row exists and nonce matches (revocation check)
  const { data: viewerLink } = await supabase
    .from('viewer_link')
    .select('id, nonce, mode, memory_ids, label, expires_at')
    .eq('id', viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: 'revoked' })
  }

  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: 'expired' })
  }

  // Fetch circle name and owner first name
  const { data: circle } = await supabase
    .from('circle')
    .select('name, created_by')
    .eq('id', circleId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!circle) throw createError({ statusCode: 404, message: 'Circle not found.' })

  const { data: owner, error: ownerError } = await supabase
    .from('user')
    .select('first_name, locale')
    .eq('id', circle.created_by)
    .maybeSingle()

  if (ownerError) {
    console.error('[viewer/timeline] owner lookup failed:', ownerError.message)
  }

  // Build memory query based on mode
  const mode = viewerLink.mode as 'full' | 'selection'

  let memoryQuery = supabase
    .from('memory')
    .select(
      'id, memory_date, note, cover_media_id, memorymedia!memory_id(id, storage_path, thumbnail_path, media_type, text_content, display_order)',
    )
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .order('memory_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50)

  if (mode === 'selection' && viewerLink.memory_ids?.length) {
    memoryQuery = memoryQuery.in('id', viewerLink.memory_ids)
  }

  const { data: memories } = await memoryQuery

  // Generate signed URLs — cover only (full + thumbnail), matching main timeline approach
  const memoriesWithUrls = await Promise.all(
    (memories ?? []).map(async (m: any) => {
      const allMedia: any[] = (m.memorymedia ?? [])
        .slice()
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      const media_count = allMedia.length

      // Resolve cover row
      let coverRow: any | null = null
      if (m.cover_media_id) {
        coverRow = allMedia.find((r: any) => r.id === m.cover_media_id) ?? null
      }
      if (!coverRow) {
        coverRow = allMedia.find((r: any) => r.media_type !== 'text') ?? null
      }

      const cover_text_content: string | null =
        coverRow === null
          ? (allMedia.find((r: any) => r.media_type === 'text')?.text_content ?? null)
          : null

      if (!coverRow?.storage_path) {
        return {
          id: m.id,
          memory_date: m.memory_date,
          note: m.note,
          signedUrl: null,
          mediaType: null,
          media_count,
          cover_text_content,
        }
      }

      const isVideo = coverRow.media_type === 'video'
      const mediaType: 'video' | 'image' = isVideo ? 'video' : 'image'

      const [fullResult, thumbResult] = await Promise.allSettled([
        supabase.storage.from('memories-private').createSignedUrl(coverRow.storage_path, 3600),
        isVideo
          ? Promise.resolve(null)
          : signedThumbnailUrl(
              supabase,
              coverRow.storage_path,
              86400,
              { width: 800, format: 'webp', quality: 85 },
              coverRow.thumbnail_path,
            ),
      ])

      const fullUrl =
        fullResult.status === 'fulfilled' ? (fullResult.value.data?.signedUrl ?? null) : null
      const signedUrl = isVideo
        ? fullUrl
        : thumbResult.status === 'fulfilled'
          ? (thumbResult.value ?? fullUrl)
          : fullUrl

      return {
        id: m.id,
        memory_date: m.memory_date,
        note: m.note,
        signedUrl,
        mediaType,
        media_count,
        cover_text_content,
      }
    }),
  )

  // Derive selectionDateRange from returned memories (for viewer UI display)
  let selectionDateRange: { from: string; to: string } | null = null
  if (mode === 'selection' && memoriesWithUrls.length > 0) {
    const dates = memoriesWithUrls.map((m) => m.memory_date).sort()
    selectionDateRange = { from: dates[0], to: dates[dates.length - 1] }
  }

  return {
    circleName: circle.name,
    ownerFirstName: owner?.first_name ?? null,
    ownerLocale: owner?.locale ?? null,
    linkLabel: viewerLink.label,
    mode,
    selectionDateRange,
    memories: memoriesWithUrls,
  }
})
