import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  if (!circleId) throw createError({ statusCode: 400, message: 'Missing circle ID' })

  // Must be the owner who initiated the deletion
  const { data: circle } = await supabase
    .from('circle')
    .select('id, name, deleted_at, deletion_initiated_by')
    .eq('id', circleId)
    .maybeSingle()

  if (!circle) throw createError({ statusCode: 404, message: 'Circle not found.' })
  if (!circle.deleted_at)
    throw createError({ statusCode: 409, message: 'Circle is not scheduled for deletion.' })
  if (circle.deletion_initiated_by !== user.sub) {
    throw createError({
      statusCode: 403,
      message: 'Only the owner who initiated deletion can restore this circle.',
    })
  }

  // Check 30-day window
  const deletedAt = new Date(circle.deleted_at)
  const daysSinceDeletion = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceDeletion >= 30) {
    throw createError({
      statusCode: 410,
      message: 'The 30-day recovery window has passed. This circle cannot be restored.',
    })
  }

  // TODO (Phase 2): enforce circle ownership limit before restoring.
  // A Free user who deleted their circle, created a new one, and then restores
  // the old one would end up owning 2 circles. Check active owned circle count
  // against User.subscription_status here (same logic as create.post.ts).

  const { error } = await supabase
    .from('circle')
    .update({ deleted_at: null, deletion_initiated_by: null })
    .eq('id', circleId)

  if (error) {
    console.error('[circle-restore] update failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to restore circle. Please try again.' })
  }

  return { ok: true, circleName: circle.name }
})
