import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  circleId: z.uuid(),
  note: z.string().min(1).max(500),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.uuid()).max(10).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { circleId, note, memoryDate, milestoneLabel, childIds, memberIds } = result.data

  // Verify user is a member of the circle
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403, message: "You are not a member of this circle." })

  // Create the memory row (no MemoryMedia — text-only)
  const { data: memory, error } = await supabase
    .from("memory")
    .insert({
      circle_id: circleId,
      owner_user_id: user.sub,
      visibility: "circle",
      note,
      memory_date: memoryDate,
      milestone_label: milestoneLabel ?? null,
    })
    .select("id")
    .single()

  if (error || !memory) {
    console.error("[quick-note] insert error:", error?.message)
    throw createError({ statusCode: 500, message: "Failed to save note. Please try again." })
  }

  // Tag children
  if (childIds?.length) {
    await supabase.from("memory_children").insert(
      childIds.map((child_id) => ({ memory_id: memory.id, child_id }))
    )
  }

  // Tag members
  if (memberIds?.length) {
    await supabase.from("memory_members").insert(
      memberIds.map((user_id) => ({ memory_id: memory.id, user_id }))
    )
  }

  // Push notification (fire-and-forget)
  const { data: actor } = await supabase
    .from("user")
    .select("first_name")
    .eq("id", user.sub)
    .single()

  // Count recent uploads for coalescing
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from("memory")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId)
    .eq("owner_user_id", user.sub)
    .gte("created_at", thirtyMinAgo)

  const payload = buildPushPayload({
    type: "upload",
    actorName: actor?.first_name ?? "Someone",
    circleId,
    actorUserId: user.sub,
    memoryId: memory.id,
    bodyText: note,
    recentUploadCount: recentCount ?? 1,
  })

  sendPushToCircle(supabase, circleId, user.sub, payload).catch((err) =>
    console.error("[push] quick-note notify error:", err)
  )

  return { memoryId: memory.id }
})
