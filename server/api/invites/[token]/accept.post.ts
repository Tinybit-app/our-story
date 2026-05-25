import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const token = getRouterParam(event, 'token')

  console.log('[accept] received POST /api/invites/:token/accept')

  if (!user?.sub) {
    console.warn('[accept] 401 — no authenticated user')
    throw createError({ statusCode: 401 })
  }
  if (!token) {
    console.warn('[accept] 400 — missing token in route params')
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  const { data: invite } = await supabase
    .from('circleinvite')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    console.warn(
      `[accept] 410 — no pending invite for token ${token.slice(0, 8)}… (user ${user.sub})`,
    )
    throw createError({ statusCode: 410, message: 'invite_expired' })
  }
  console.log(
    `[accept] user ${user.sub} accepting invite for circle ${invite.circle_id} (role ${invite.role})`,
  )

  if (new Date(invite.expires_at) < new Date()) {
    console.warn(
      `[accept] 410 — invite ${invite.id} expired at ${invite.expires_at}`,
    )
    await supabase
      .from('circleinvite')
      .update({ status: 'expired' })
      .eq('id', invite.id)
    throw createError({ statusCode: 410, message: 'invite_expired' })
  }

  // Check that the circle hasn't been soft-deleted since the invite was sent
  const { data: circle } = await supabase
    .from('circle')
    .select('deleted_at')
    .eq('id', invite.circle_id)
    .maybeSingle()

  if (!circle || circle.deleted_at) {
    console.warn(
      `[accept] 410 — circle ${invite.circle_id} not found or soft-deleted (deleted_at=${circle?.deleted_at ?? 'missing'})`,
    )
    throw createError({ statusCode: 410, message: 'invite_circle_deleted' })
  }

  // Add member (upsert in case they're already a member). Without an explicit
  // onConflict the upsert uses the primary key, which won't match the existing
  // row's (user_id, circle_id) unique constraint — so a re-accept could 500
  // with a unique-violation. Targeting the unique key makes it idempotent.
  const { error: memberError, data: memberRows } = await supabase
    .from('circlemember')
    .upsert(
      {
        user_id: user.sub,
        circle_id: invite.circle_id,
        role: invite.role,
      },
      { onConflict: 'user_id,circle_id' },
    )
    .select('id')

  if (memberError) {
    console.error(
      `[accept] 500 — circlemember upsert failed for user ${user.sub} → circle ${invite.circle_id}:`,
      memberError,
    )
    throw createError({
      statusCode: 500,
      message: 'Failed to join circle.',
    })
  }
  console.log(
    `[accept] circlemember row OK (${memberRows?.length ?? 0} row(s) affected)`,
  )

  const { error: inviteUpdateError } = await supabase
    .from('circleinvite')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  if (inviteUpdateError) {
    // Non-fatal — membership is already created. Log for visibility.
    console.error(
      `[accept] post-success: failed to mark invite ${invite.id} accepted:`,
      inviteUpdateError,
    )
  }

  // Re-attach any memories this user previously owned in this circle that were
  // detached when they were removed (owner_user_id was NULLed but former_owner_user_id
  // preserves the reference so we can restore ownership on rejoin).
  const { error: reattachError, count: reattachCount } = await supabase
    .from('memory')
    .update(
      {
        owner_user_id: user.sub,
        former_owner_user_id: null,
        former_owner_name: null,
      },
      { count: 'exact' },
    )
    .eq('former_owner_user_id', user.sub)
    .eq('circle_id', invite.circle_id)

  if (reattachError) {
    console.error(
      `[accept] post-success: re-attach of prior memories failed for user ${user.sub} in circle ${invite.circle_id}:`,
      reattachError,
    )
  } else if (reattachCount && reattachCount > 0) {
    console.log(
      `[accept] re-attached ${reattachCount} prior memories to user ${user.sub}`,
    )
  }

  return { ok: true, circleId: invite.circle_id }
})
