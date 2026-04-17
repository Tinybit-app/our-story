import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400, message: "Missing memory id" })

  // Verify the user belongs to the circle that owns this memory
  const { data: memory } = await supabase
    .from("memory")
    .select("id, circle_id")
    .eq("id", memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })

  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("circle_id", memory.circle_id)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  const { data: comments, error } = await supabase
    .from("memorycomment")
    .select("id, body, created_at, user_id, user!user_id(first_name, last_name, avatar_url)")
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[comments] fetch error:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load comments." })
  }

  return { comments: comments ?? [] }
})
