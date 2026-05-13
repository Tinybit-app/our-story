import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z.object({
  circleId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request.' })
  }
  const { circleId } = parsed.data

  // Verify the user is an active member of this circle
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role, circle:circle_id(deleted_at)')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || (membership.circle as any)?.deleted_at) {
    throw createError({
      statusCode: 403,
      message: 'You are not a member of this circle.',
    })
  }

  // One active job per user per circle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('exportjob')
    .select('id, status')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'An export is already in progress.',
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('exportjob')
    .insert({ user_id: user.sub, circle_id: circleId })

  if (error) {
    console.error('[account/export] insert failed:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to start export. Please try again.',
    })
  }

  return {
    ok: true,
    message:
      "Export started — you'll receive a download link by email within a few minutes.",
  }
})
