import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z.object({
  keepContent: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')
  if (!circleId || !targetUserId)
    throw createError({ statusCode: 400, message: 'Missing parameters' })

  const result = schema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid request body.' })
  const { keepContent } = result.data

  // Requesting user must be owner or admin
  const { data: myMembership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
    throw createError({
      statusCode: 403,
      message: 'Only owners and admins can remove members',
    })
  }

  // Cannot remove the circle owner
  const { data: target } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!target)
    throw createError({ statusCode: 404, message: 'Member not found' })
  if (target.role === 'owner')
    throw createError({
      statusCode: 403,
      message: 'Cannot remove the circle owner',
    })

  // Admin cannot remove another admin — only owner can
  if (target.role === 'admin' && myMembership.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the owner can remove an admin',
    })
  }

  // Fetch this member's memory IDs in the circle (needed for reaction + content deletion)
  const { data: userMemories } = await supabase
    .from('memory')
    .select('id')
    .eq('owner_user_id', targetUserId)
    .eq('circle_id', circleId)

  const memoryIds = (userMemories ?? []).map((m) => m.id)

  // Always delete the member's reactions in this circle (tied to identity, low-stakes)
  if (memoryIds.length > 0) {
    await supabase
      .from('memoryreaction')
      .delete()
      .eq('user_id', targetUserId)
      .in('memory_id', memoryIds)
  }

  if (keepContent && memoryIds.length > 0) {
    // Detach memories from the departing user's account so they survive if
    // the user later deletes their account. Snapshot the display name so
    // cards can still show a greyed-out attribution after they leave.
    const { data: memberProfile } = await (supabase as any)
      .from('user')
      .select('first_name, last_name')
      .eq('id', targetUserId)
      .maybeSingle()

    const formerName =
      [memberProfile?.first_name, memberProfile?.last_name]
        .filter(Boolean)
        .join(' ') || null

    await supabase
      .from('memory')
      .update({
        owner_user_id: null,
        former_owner_name: formerName,
        former_owner_user_id: targetUserId,
      })
      .eq('owner_user_id', targetUserId)
      .eq('circle_id', circleId)
  } else if (!keepContent && memoryIds.length > 0) {
    // Fetch storage paths before cascade-deleting memory rows
    const { data: media } = await supabase
      .from('memorymedia')
      .select('storage_path, thumbnail_path')
      .in('memory_id', memoryIds)

    // Delete storage objects (original + thumbnail when present)
    for (const m of media ?? []) {
      const paths = m.thumbnail_path
        ? [m.storage_path, m.thumbnail_path]
        : [m.storage_path]
      await supabase.storage.from('memories-private').remove(paths)
    }

    // Delete memory rows (cascades to memorymedia, memorycomment, memoryreaction)
    await supabase
      .from('memory')
      .delete()
      .eq('owner_user_id', targetUserId)
      .eq('circle_id', circleId)
  }

  // Remove from circle
  const { error } = await supabase
    .from('circlemember')
    .delete()
    .eq('user_id', targetUserId)
    .eq('circle_id', circleId)

  if (error) {
    console.error('[remove-member] delete failed:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to remove member. Please try again.',
    })
  }

  // Notify removed member by email (best-effort — don't fail the request if it errors)
  try {
    const [{ data: removedUser }, { data: circle }, { data: remover }] =
      await Promise.all([
        (supabase as any)
          .from('user')
          .select('email, first_name, locale')
          .eq('id', targetUserId)
          .maybeSingle(),
        (supabase as any)
          .from('circle')
          .select('name')
          .eq('id', circleId)
          .maybeSingle(),
        (supabase as any)
          .from('user')
          .select('first_name, last_name')
          .eq('id', user.sub)
          .maybeSingle(),
      ])

    if (removedUser?.email) {
      const removerName =
        [remover?.first_name, remover?.last_name].filter(Boolean).join(' ') ||
        'Someone'
      const config = useRuntimeConfig()
      const { subject, html } = buildMemberRemovedEmail({
        circleName: circle?.name ?? 'your circle',
        removerName,
        keepContent,
        appUrl: config.appUrl as string,
        locale: removedUser.locale ?? 'en',
      })
      await sendEmail({ to: removedUser.email, subject, html })
    }
  } catch (err) {
    console.error('[remove-member] notification email failed:', err)
  }

  return { ok: true }
})
