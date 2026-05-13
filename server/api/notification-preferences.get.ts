import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  circleId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request.' })
  const { circleId } = result.data

  // Verify user is a member of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403, message: 'Not a member of this circle.' })

  const { data } = await supabase
    .from('notificationpreference')
    .select('push_enabled, circle_muted, email_digest_frequency, milestone_nudges_enabled')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  return {
    push_enabled: data?.push_enabled ?? true,
    circle_muted: data?.circle_muted ?? false,
    email_digest_frequency: data?.email_digest_frequency ?? 'monthly',
    milestone_nudges_enabled: data?.milestone_nudges_enabled ?? true,
  }
})
