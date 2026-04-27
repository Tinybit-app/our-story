import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  childIds: z.array(z.uuid()).max(10),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400, message: "Missing memory id" })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { childIds } = result.data

  // Verify the caller owns this memory
  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id, circle_id")
    .eq("id", memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Validate every childId belongs to the same circle as the memory
  if (childIds.length > 0) {
    const { data: validChildren } = await (supabase as any)
      .from("childprofile")
      .select("id")
      .eq("circle_id", memory.circle_id)
      .in("id", childIds)

    const validSet = new Set((validChildren ?? []).map((c: any) => c.id))
    if (!childIds.every((id) => validSet.has(id))) {
      throw createError({ statusCode: 400, message: "One or more child IDs are invalid." })
    }
  }

  // Replace: delete all existing tags then insert new ones
  const { error: deleteError } = await (supabase as any)
    .from("memory_children")
    .delete()
    .eq("memory_id", memoryId)

  if (deleteError) {
    console.error("[memory children] delete failed:", deleteError.message)
    throw createError({ statusCode: 500, message: "Failed to update child tags." })
  }

  if (childIds.length > 0) {
    const { error: insertError } = await (supabase as any)
      .from("memory_children")
      .insert(childIds.map((childId) => ({ memory_id: memoryId, child_id: childId })))

    if (insertError) {
      console.error("[memory children] insert failed:", insertError.message)
      throw createError({ statusCode: 500, message: "Failed to tag children." })
    }
  }

  return { ok: true }
})
