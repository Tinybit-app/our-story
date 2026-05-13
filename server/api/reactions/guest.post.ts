import { serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

// --- Rate limiting: max 20 reactions per viewer link per 60s window ---
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(viewerLinkId: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(viewerLinkId)
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(viewerLinkId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

// Clean up stale buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) rateBuckets.delete(key)
  }
}, 5 * 60_000).unref?.()

const VALID_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'] as const

const schema = z.object({
  viewerToken: z.string().min(1),
  memoryId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  emoji: z.enum(VALID_EMOJIS),
  guestName: z.string().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request body.' })

  const { viewerToken, memoryId, emoji, guestName } = result.data
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: 'Server misconfiguration.' })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(viewerToken, secret)
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

  if (!checkRateLimit(viewerLinkId)) {
    throw createError({ statusCode: 429, message: 'Too many reactions. Please try again later.' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Revocation check — same as viewer/timeline.get.ts
  const { data: viewerLink } = await supabase
    .from('viewer_link')
    .select('nonce, expires_at')
    .eq('id', viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: 'revoked' })
  }
  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: 'expired' })
  }

  // Verify the memory belongs to this circle
  const { data: memory } = await supabase
    .from('memory')
    .select('id')
    .eq('id', memoryId)
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404, message: 'Memory not found.' })

  const resolvedName = guestName ?? 'Viewer'

  // Dedup: skip if this guest already reacted with the same emoji on this memory
  const { data: existing } = await (supabase.from('memoryreaction') as any)
    .select('id')
    .eq('memory_id', memoryId)
    .is('user_id', null)
    .eq('emoji', emoji)
    .eq('guest_name', resolvedName)
    .maybeSingle()

  if (existing) {
    return { ok: true }
  }

  const { error } = await (supabase.from('memoryreaction') as any).insert({
    memory_id: memoryId,
    user_id: null,
    emoji,
    guest_name: resolvedName,
  })

  if (error) {
    console.error('[reactions/guest] insert failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to save reaction.' })
  }

  return { ok: true }
})
