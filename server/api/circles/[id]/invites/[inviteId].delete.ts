import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  const inviteId = getRouterParam(event, 'inviteId')
  if (!circleId || !inviteId)
    throw createError({ statusCode: 400, message: 'Missing parameters' })

  // Must be owner or admin
  const { data: myMembership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
    throw createError({
      statusCode: 403,
      message: 'Only owners and admins can cancel invites',
    })
  }

  const { error } = await supabase
    .from('circleinvite')
    .update({ status: 'expired' })
    .eq('id', inviteId)
    .eq('circle_id', circleId)
    .eq('status', 'pending')

  if (error) {
    console.error('[cancel-invite] update failed:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to cancel invite. Please try again.',
    })
  }

  return { ok: true }
})
