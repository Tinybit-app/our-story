import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data, error } = await supabase
    .from("familymember")
    .select("role, family:family_id(id, name, circle_type)")
    .eq("user_id", user.sub)
    .order("created_at")

  if (error) {
    console.error("[families] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load families." })
  }

  const families = (data ?? []).map((m) => ({
    ...(m.family as any),
    role: m.role,
  }))

  return { families }
})
