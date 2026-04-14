import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const token = getRouterParam(event, "token")

  if (!user?.sub) throw createError({ statusCode: 401 })
  if (!token) throw createError({ statusCode: 400, message: "Missing token" })

  const { data: invite } = await supabase
    .from("familyinvite")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (!invite) throw createError({ statusCode: 410, message: "invite_expired" })

  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from("familyinvite").update({ status: "expired" }).eq("id", invite.id)
    throw createError({ statusCode: 410, message: "invite_expired" })
  }

  // Add member (upsert in case they're already a member)
  await supabase.from("familymember").upsert({
    user_id: user.sub,
    family_id: invite.family_id,
    role: invite.role,
  })

  await supabase.from("familyinvite").update({ status: "accepted" }).eq("id", invite.id)

  return { ok: true, familyId: invite.family_id }
})
