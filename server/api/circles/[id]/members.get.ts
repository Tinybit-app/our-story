import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, "id")
  if (!circleId) throw createError({ statusCode: 400, message: "Missing circle id" })

  // Verify requesting user is a member and get their role
  const { data: myMembership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!myMembership) throw createError({ statusCode: 403 })

  const isCaregiver = myMembership.role === "caregiver"
  const canManage = ["owner", "admin"].includes(myMembership.role)

  // Fetch all active members with user data
  const { data: members, error } = await supabase
    .from("circlemember")
    .select("id, role, created_at, user:user_id(id, first_name, last_name, avatar_url)")
    .eq("circle_id", circleId)
    .order("created_at")

  if (error) {
    console.error("[members] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load members." })
  }

  // Fetch pending invites — visible to owner/admin only
  let invites: any[] = []
  if (canManage) {
    const { data } = await supabase
      .from("circleinvite")
      .select("id, email, role, expires_at, created_at")
      .eq("circle_id", circleId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    invites = data ?? []
  }

  // Caregiver restriction: return first name only, no avatar (design spec §Caregiver Mode)
  const formattedMembers = (members ?? []).map((m: any) => ({
    id: m.id,
    userId: m.user?.id ?? null,
    role: m.role,
    firstName: m.user?.first_name ?? "",
    lastName: isCaregiver ? null : (m.user?.last_name ?? null),
    avatarUrl: isCaregiver ? null : (m.user?.avatar_url ?? null),
    joinedAt: m.created_at,
  }))

  return { members: formattedMembers, invites, myRole: myMembership.role }
})
