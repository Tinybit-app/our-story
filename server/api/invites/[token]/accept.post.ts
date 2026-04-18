import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const token = getRouterParam(event, "token")

  if (!user?.sub) throw createError({ statusCode: 401 })
  if (!token) throw createError({ statusCode: 400, message: "Missing token" })

  const { data: invite } = await supabase
    .from("circleinvite")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (!invite) throw createError({ statusCode: 410, message: "invite_expired" })

  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from("circleinvite").update({ status: "expired" }).eq("id", invite.id)
    throw createError({ statusCode: 410, message: "invite_expired" })
  }

  // Check that the circle hasn't been soft-deleted since the invite was sent
  const { data: circle } = await supabase
    .from("circle")
    .select("deleted_at")
    .eq("id", invite.circle_id)
    .maybeSingle()

  if (!circle || circle.deleted_at) {
    throw createError({ statusCode: 410, message: "invite_circle_deleted" })
  }

  // Add member (upsert in case they're already a member)
  await supabase.from("circlemember").upsert({
    user_id: user.sub,
    circle_id: invite.circle_id,
    role: invite.role,
  })

  await supabase.from("circleinvite").update({ status: "accepted" }).eq("id", invite.id)

  // Re-attach any memories this user previously owned in this circle that were
  // detached when they were removed (owner_user_id was NULLed but former_owner_user_id
  // preserves the reference so we can restore ownership on rejoin).
  await supabase
    .from("memory")
    .update({ owner_user_id: user.sub, former_owner_user_id: null, former_owner_name: null })
    .eq("former_owner_user_id", user.sub)
    .eq("circle_id", invite.circle_id)

  return { ok: true, circleId: invite.circle_id }
})
