import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { buildPushPayload, sendPushToCircle } from '../../utils/pushNotify'

const bodySchema = z.object({
  memoryId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request.' })
  const { memoryId } = result.data

  // Verify the memory exists and the caller is the owner
  const { data: memory } = await supabase
    .from('memory')
    .select('id, circle_id, owner_user_id, note, created_at')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Get actor name
  const { data: actor } = await supabase
    .from('user')
    .select('first_name')
    .eq('id', user.sub)
    .single()

  const actorName = actor?.first_name ?? 'Someone'

  // Count recent uploads by this user in this circle (last 30 minutes) for coalescing
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('memory')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', memory.circle_id)
    .eq('owner_user_id', user.sub)
    .gte('created_at', thirtyMinAgo)

  const payload = buildPushPayload({
    type: 'upload',
    actorName,
    circleId: memory.circle_id,
    actorUserId: user.sub,
    memoryId,
    bodyText: memory.note,
    recentUploadCount: count ?? 1,
  })

  // Fire-and-forget — don't block the response
  sendPushToCircle(supabase, memory.circle_id, user.sub, payload).catch((err) =>
    console.error('[push/notify] dispatch error:', err),
  )

  return { ok: true }
})
