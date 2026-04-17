import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, "id")
  const targetUserId = getRouterParam(event, "userId")
  if (!circleId || !targetUserId) throw createError({ statusCode: 400, message: "Missing parameters" })

  // Requesting user must be owner or admin
  const { data: myMembership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
    throw createError({ statusCode: 403, message: "Only owners and admins can remove members" })
  }

  // Cannot remove the circle owner
  const { data: target } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!target) throw createError({ statusCode: 404, message: "Member not found" })
  if (target.role === "owner") throw createError({ statusCode: 403, message: "Cannot remove the circle owner" })

  // Admin cannot remove another admin — only owner can
  if (target.role === "admin" && myMembership.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the owner can remove an admin" })
  }

  const { error } = await supabase
    .from("circlemember")
    .delete()
    .eq("user_id", targetUserId)
    .eq("circle_id", circleId)

  if (error) {
    console.error("[remove-member] delete failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to remove member. Please try again." })
  }

  return { ok: true }
})
