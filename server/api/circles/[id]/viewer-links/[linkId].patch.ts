import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  memoryIds: z.array(z.uuid()).min(1).optional(),
  label: z.string().min(1).max(100).optional(),
}).refine(data => data.memoryIds || data.label, {
  message: "At least one field (memoryIds or label) must be provided",
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized." })

  const circleId = getRouterParam(event, "id")!
  const linkId = getRouterParam(event, "linkId")!

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: "Invalid request body." })

  const { memoryIds, label } = parsed.data

  const supabase = serverSupabaseServiceRole(event)

  // Verify requester is owner
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.sub)
    .maybeSingle()

  if (membership?.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can edit viewer links." })
  }

  // Verify the link exists, belongs to this circle, and is a selection link
  const { data: existing } = await supabase
    .from("viewer_link")
    .select("id, mode")
    .eq("id", linkId)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!existing) {
    throw createError({ statusCode: 404, message: "Viewer link not found." })
  }

  if (memoryIds && existing.mode !== "selection") {
    throw createError({ statusCode: 400, message: "Only selection links can update memories." })
  }

  // Build update payload
  const patch: Record<string, string | string[]> = {}
  if (memoryIds) patch.memory_ids = memoryIds
  if (label) patch.label = label

  const { error } = await supabase
    .from("viewer_link")
    .update(patch as any)
    .eq("id", linkId)
    .eq("circle_id", circleId)

  if (error) {
    console.error("[viewer-links.patch] update failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to update viewer link." })
  }

  return { ok: true }
})
