import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400 })

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

  const { data: rows } = await supabase
    .from("memorymedia")
    .select("id, storage_path, media_type, text_content, display_order")
    .eq("memory_id", memoryId)
    .order("display_order", { ascending: true })

  const slides = await Promise.all(
    (rows ?? []).map(async (row) => {
      if (row.media_type === "text") {
        return {
          id: row.id,
          mediaType: "text" as const,
          textContent: row.text_content,
          displayOrder: row.display_order,
        }
      }
      const { data: signed } = await supabase.storage
        .from("memories-private")
        .createSignedUrl(row.storage_path!, 3600)
      return {
        id: row.id,
        mediaType: (row.media_type === "video" ? "video" : "photo") as "photo" | "video",
        url: signed?.signedUrl ?? null,
        displayOrder: row.display_order,
      }
    })
  )

  return { slides }
})
