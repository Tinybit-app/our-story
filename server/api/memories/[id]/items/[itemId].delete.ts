import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  const itemId = getRouterParam(event, "itemId")
  if (!memoryId || !itemId) throw createError({ statusCode: 400, message: "Missing memory id or item id" })

  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id")
    .eq("id", memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  const { error } = await supabase
    .from("memorymedia")
    .delete()
    .eq("id", itemId)
    .eq("memory_id", memoryId)

  if (error) {
    console.error("[items.delete] delete error:", error.message)
    throw createError({ statusCode: 500, message: "Failed to delete item." })
  }

  return { ok: true }
})
