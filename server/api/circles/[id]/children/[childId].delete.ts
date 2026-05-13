import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  const childId = getRouterParam(event, 'childId')
  if (!circleId || !childId) throw createError({ statusCode: 400, message: 'Missing IDs' })

  // Owner-only
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'Only the circle owner can manage children.' })
  }

  const { error } = await supabase
    .from('childprofile')
    .delete()
    .eq('id', childId)
    .eq('circle_id', circleId)

  if (error) {
    console.error('[children] delete failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to remove child.' })
  }

  return { ok: true }
})
