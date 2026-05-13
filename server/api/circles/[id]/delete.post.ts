import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z.object({
  // User must type the circle name to confirm — validated client-side; we re-validate here
  confirmName: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  if (!circleId) throw createError({ statusCode: 400, message: 'Missing circle ID' })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request body.' })
  const { confirmName } = result.data

  // Requesting user must be the owner
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'Only the circle owner can delete the circle.' })
  }

  // Load circle (must exist and not already be deleted)
  const { data: circle } = await supabase
    .from('circle')
    .select('id, name, deleted_at')
    .eq('id', circleId)
    .maybeSingle()

  if (!circle) throw createError({ statusCode: 404, message: 'Circle not found.' })
  if (circle.deleted_at)
    throw createError({ statusCode: 409, message: 'Circle is already scheduled for deletion.' })

  // Validate the typed confirmation matches the circle name
  if (confirmName.trim().toLowerCase() !== circle.name.trim().toLowerCase()) {
    throw createError({
      statusCode: 422,
      message: 'Circle name does not match. Please type it exactly.',
    })
  }

  // Soft-delete
  const { error: softDeleteError } = await supabase
    .from('circle')
    .update({
      deleted_at: new Date().toISOString(),
      deletion_initiated_by: user.sub,
    })
    .eq('id', circleId)

  if (softDeleteError) {
    console.error('[circle-delete] soft delete failed:', softDeleteError.message)
    throw createError({ statusCode: 500, message: 'Failed to delete circle. Please try again.' })
  }

  // Notify all members (best-effort)
  try {
    const config = useRuntimeConfig()
    const purgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const [{ data: members }, { data: owner }] = await Promise.all([
      supabase
        .from('circlemember')
        .select('user_id, user:user_id(email, first_name, locale)')
        .eq('circle_id', circleId),
      (supabase as any)
        .from('user')
        .select('first_name, last_name')
        .eq('id', user.sub)
        .maybeSingle(),
    ])

    const ownerName = [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || 'The owner'

    for (const m of members ?? []) {
      const member = (m as any).user
      if (!member?.email || m.user_id === user.sub) continue
      const { subject, html } = buildCircleDeletedEmail({
        circleName: circle.name,
        ownerName,
        purgeDate,
        appUrl: config.appUrl as string,
        locale: member.locale ?? 'en',
      })
      await sendEmail({ to: member.email, subject, html })
    }

    // Notify the owner as well (confirmation)
    const { data: ownerUser } = await (supabase as any)
      .from('user')
      .select('email, first_name, locale')
      .eq('id', user.sub)
      .maybeSingle()

    if (ownerUser?.email) {
      const settingsUrl = `${config.appUrl}/settings`
      const { subject, html } = buildCircleDeletedOwnerEmail({
        circleName: circle.name,
        purgeDate,
        restoreUrl: settingsUrl,
        locale: ownerUser.locale ?? 'en',
      })
      await sendEmail({ to: ownerUser.email, subject, html })
    }
  } catch (err) {
    console.error('[circle-delete] notification emails failed:', err)
  }

  return { ok: true }
})
