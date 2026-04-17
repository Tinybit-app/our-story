import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  emoji: z.string().min(1).max(10),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400, message: "Missing memory id" })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid emoji" })
  const { emoji } = result.data

  // Verify the user is a member of the circle that owns this memory
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

  // Toggle: delete if exists, insert if not
  const { data: existing } = await supabase
    .from("memoryreaction")
    .select("id")
    .eq("memory_id", memoryId)
    .eq("user_id", user.sub)
    .eq("emoji", emoji)
    .maybeSingle()

  if (existing) {
    await supabase.from("memoryreaction").delete().eq("id", existing.id)
  } else {
    const { error } = await supabase.from("memoryreaction").insert({
      memory_id: memoryId,
      user_id: user.sub,
      emoji,
      type: "emoji",
    })
    if (error) throw createError({ statusCode: 500, message: "Failed to add reaction." })
  }

  // Return fresh reactions for this memory
  const { data: reactions } = await supabase
    .from("memoryreaction")
    .select("id, emoji, user_id")
    .eq("memory_id", memoryId)

  return { reactions: reactions ?? [] }
})
