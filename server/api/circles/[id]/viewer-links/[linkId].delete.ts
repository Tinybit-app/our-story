import { serverSupabaseUser, serverSupabaseClient } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized." })

  const circleId = getRouterParam(event, "id")!
  const linkId = getRouterParam(event, "linkId")!

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (membership?.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can revoke viewer links." })
  }

  const { error } = await supabase
    .from("viewer_link")
    .delete()
    .eq("id", linkId)
    .eq("circle_id", circleId)

  if (error) {
    console.error("[viewer-links.delete] failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to revoke viewer link." })
  }

  return { ok: true }
})
