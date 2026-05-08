import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const itemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), draftMemoryId: z.uuid() }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

const bodySchema = z.object({
  circleId: z.uuid(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(2000).nullable().optional(),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.uuid()).max(10).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
  coverIndex: z.number().int().nonnegative().nullable().optional(),
  items: z.array(itemSchema).min(2).max(20),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { circleId, memoryDate, note, milestoneLabel, childIds, memberIds, coverIndex, items } = result.data

  // Verify circle membership
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()
  if (!membership) throw createError({ statusCode: 403, message: "You are not a member of this circle." })

  // Verify all draft memories are owned by this user
  const draftMemoryIds = items
    .filter((i): i is Extract<(typeof items)[number], { type: "draft" }> => i.type === "draft")
    .map((i) => i.draftMemoryId)

  if (draftMemoryIds.length > 0) {
    const { data: drafts } = await supabase
      .from("memory")
      .select("id")
      .in("id", draftMemoryIds)
      .eq("owner_user_id", user.sub)
      .eq("circle_id", circleId)
      .eq("visibility", "draft")
    if ((drafts?.length ?? 0) !== draftMemoryIds.length) {
      throw createError({ statusCode: 403, message: "Invalid draft media ownership." })
    }
  }

  // Create the canonical Memory
  const { data: memory, error: memErr } = await supabase
    .from("memory")
    .insert({
      circle_id: circleId,
      owner_user_id: user.sub,
      visibility: "circle",
      note: note ?? null,
      milestone_label: milestoneLabel ?? null,
      memory_date: memoryDate,
    })
    .select("id")
    .single()
  if (memErr || !memory) {
    console.error("[upload-batch] memory insert failed:", memErr?.message)
    throw createError({ statusCode: 500, message: "Failed to create memory." })
  }

  // For each item, attach existing media or insert text slide, in order
  const insertedMediaIds: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.type === "draft") {
      const { data: rows, error: updErr } = await supabase
        .from("memorymedia")
        .update({ memory_id: memory.id, display_order: i })
        .eq("memory_id", item.draftMemoryId)
        .select("id")
      if (updErr) {
        console.error("[upload-batch] media reattach failed:", updErr.message)
      }
      for (const r of rows ?? []) insertedMediaIds.push(r.id)

      await supabase.from("memory").delete().eq("id", item.draftMemoryId)
    } else {
      const { data: row, error: insErr } = await supabase
        .from("memorymedia")
        .insert({
          memory_id: memory.id,
          media_type: "text",
          text_content: item.textContent,
          display_order: i,
        })
        .select("id")
        .single()
      if (insErr || !row) {
        console.error("[upload-batch] text slide insert failed:", insErr?.message)
        continue
      }
      insertedMediaIds.push(row.id)
    }
  }

  // Resolve cover
  let coverMediaId: string | null = null
  if (coverIndex !== null && coverIndex !== undefined && coverIndex < insertedMediaIds.length) {
    coverMediaId = insertedMediaIds[coverIndex] ?? null
  }
  if (!coverMediaId) {
    const { data: firstMedia } = await supabase
      .from("memorymedia")
      .select("id")
      .eq("memory_id", memory.id)
      .neq("media_type", "text")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    coverMediaId = firstMedia?.id ?? null
  }
  await supabase.from("memory").update({ cover_media_id: coverMediaId }).eq("id", memory.id)

  // Tag children + members
  if (childIds?.length) {
    await supabase.from("memory_children").insert(
      childIds.map((cid) => ({ memory_id: memory.id, child_id: cid }))
    )
  }
  if (memberIds?.length) {
    await supabase.from("memory_members").insert(
      memberIds.map((uid) => ({ memory_id: memory.id, user_id: uid }))
    )
  }

  return { memoryId: memory.id }
})
