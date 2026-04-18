import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const querySchema = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success) throw createError({ statusCode: 400, message: "circleId is required" })
  const { circleId, cursor, authorId, yearMonth } = result.data

  // Verify the requesting user belongs to this circle
  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  let query = supabase
    .from("memory")
    .select(`
      id, owner_user_id, former_owner_name, former_owner_user_id, visibility, note, memory_date, milestone_label, milestone_is_custom, created_at,
      memorymedia(id, storage_path, media_type, file_size),
      user!owner_user_id(first_name, last_name, avatar_url),
      memoryreaction(id, emoji, user_id, user!user_id(first_name, last_name)),
      memorycomment(id)
    `)
    .eq("circle_id", circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`)
    .order("memory_date", { ascending: false })
    .order("id", { ascending: false })

  if (authorId) {
    query = query.eq("owner_user_id", authorId)
  }

  if (yearMonth) {
    // Filter to a specific calendar month — used by the month overflow page
    const parts = yearMonth.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1])
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const to = new Date(Date.UTC(year, month, 1)).toISOString()
    query = query.gte("memory_date", from).lt("memory_date", to).limit(100)

    const { data: memories, error } = await query
    if (error) {
      console.error("[timeline] month query failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to load timeline." })
    }
    return { memories: await attachSignedUrls(supabase, memories ?? []), nextCursor: null }
  }

  // Cursor-based pagination for the main timeline
  query = query.limit(20)

  if (cursor) {
    const [cursorDate, cursorId] = cursor.split(",")
    query = (query as any).or(
      `memory_date.lt.${cursorDate},and(memory_date.eq.${cursorDate},id.lt.${cursorId})`
    )
  }

  const { data: memories, error } = await query

  if (error) {
    console.error("[timeline] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load timeline." })
  }

  const memoriesWithUrls = await attachSignedUrls(supabase, memories ?? [])
  const last = memoriesWithUrls[memoriesWithUrls.length - 1]
  const nextCursor = last ? `${last.memory_date},${last.id}` : null

  return { memories: memoriesWithUrls, nextCursor }
})

async function attachSignedUrls(supabase: any, memories: any[]) {
  return Promise.all(
    memories.map(async (memory) => {
      const mediaWithUrls = await Promise.all(
        ((memory.memorymedia as any[]) ?? []).map(async (media) => {
          const { storage_path, ...safeMedia } = media
          if (!storage_path) return { ...safeMedia, url: null, thumbnailUrl: null }

          const isVideo = media.media_type === "video"

          const [fullResult, thumbResult] = await Promise.allSettled([
            supabase.storage.from("memories-private").createSignedUrl(storage_path, 3600),
            isVideo
              ? Promise.resolve({ data: null })
              : supabase.storage.from("memories-private").createSignedUrl(storage_path, 86400, {
                  transform: { width: 800, format: "webp" as "origin", quality: 85 },
                }),
          ])

          const url = fullResult.status === "fulfilled" ? (fullResult.value.data?.signedUrl ?? null) : null
          const thumbnailUrl = isVideo ? url : (thumbResult.status === "fulfilled" ? (thumbResult.value.data?.signedUrl ?? url) : url)

          return { ...safeMedia, url, thumbnailUrl }
        })
      )
      return { ...memory, memorymedia: mediaWithUrls }
    })
  )
}
