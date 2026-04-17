import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data, error } = await supabase
    .from("circlemember")
    .select("role, circle:circle_id(id, name, circle_type, members:circlemember(count))")
    .eq("user_id", user.sub)
    .order("created_at")

  if (error) {
    console.error("[circles] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load circles." })
  }

  const circles = (data ?? []).map((m) => {
    const c = m.circle as any
    const memberCount = c?.members?.[0]?.count ?? 0
    const { members: _, ...circleFields } = c ?? {}
    return { ...circleFields, memberCount, role: m.role }
  })

  return { circles }
})
