import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  circleId: z.uuid(),
  push_enabled: z.boolean().optional(),
  circle_muted: z.boolean().optional(),
  email_digest_frequency: z.enum(['weekly', 'monthly', 'off']).optional(),
  milestone_nudges_enabled: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid request.' })

  const { circleId, ...fields } = result.data

  // Verify user is a member of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership)
    throw createError({
      statusCode: 403,
      message: 'Not a member of this circle.',
    })

  // Build the upsert payload with only the provided fields
  const upsertData: Record<string, any> = {
    user_id: user.sub,
    circle_id: circleId,
  }
  if (fields.push_enabled !== undefined)
    upsertData.push_enabled = fields.push_enabled
  if (fields.circle_muted !== undefined)
    upsertData.circle_muted = fields.circle_muted
  if (fields.email_digest_frequency !== undefined)
    upsertData.email_digest_frequency = fields.email_digest_frequency
  if (fields.milestone_nudges_enabled !== undefined)
    upsertData.milestone_nudges_enabled = fields.milestone_nudges_enabled

  const { error } = await supabase
    .from('notificationpreference')
    .upsert(upsertData as any, { onConflict: 'user_id,circle_id' })

  if (error) {
    console.error('[notification-preferences] upsert error:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to save preference.',
    })
  }

  return { ok: true }
})
