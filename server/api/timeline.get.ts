import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const YEAR_LIMIT = 156 // 13 months × 12 memories/month (safety cap)

const querySchema = z.object({
  circleId: z.string().uuid(),
  cursor: z.string().optional(),
  authorId: z.string().uuid().optional(),
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const MEMORY_SELECT = `
  id, owner_user_id, former_owner_name, former_owner_user_id, visibility, note, memory_date, milestone_label, created_at,
  memory_children(child_id, childprofile(id, name, date_of_birth)),
  memory_members(user_id, user:user_id(id, first_name, last_name, avatar_url)),
  memorymedia(id, storage_path, media_type, file_size),
  user!owner_user_id(first_name, last_name, avatar_url),
  memoryreaction(id, emoji, user_id, guest_name, user!user_id(first_name, last_name)),
  memorycomment(id)
`

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success) throw createError({ statusCode: 400, message: "circleId is required" })
  const { circleId, cursor, authorId, yearMonth, year } = result.data

  // Verify the requesting user belongs to this circle
  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  // Fetch child profiles for baby age stamp display + upload picker
  const { data: childProfiles, error: childError } = await (supabase as any)
    .from("childprofile")
    .select("id, name, date_of_birth")
    .eq("circle_id", circleId)
    .order("date_of_birth", { ascending: true })

  if (childError) console.error("[timeline] childprofile query failed:", childError.message)

  const children: Array<{ id: string; name: string; date_of_birth: string }> =
    childProfiles ?? []

  // Fetch circle members for the people picker in the upload form.
  const { data: memberRows, error: memberError } = await supabase
    .from("circlemember")
    .select("user_id")
    .eq("circle_id", circleId)
    .order("created_at")

  if (memberError) console.error("[timeline] members query failed:", memberError.message)

  const memberUserIds = (memberRows ?? []).map((m: any) => m.user_id as string)

  let members: Array<{ userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }> = []

  if (memberUserIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("user")
      .select("id, first_name, last_name, avatar_url")
      .in("id", memberUserIds)

    if (profileError) console.error("[timeline] member profiles query failed:", profileError.message)

    const profileMap = new Map((profileRows ?? []).map((p: any) => [p.id, p]))
    members = memberUserIds.map((uid) => {
      const p = profileMap.get(uid)
      return {
        userId: uid,
        firstName: p?.first_name ?? null,
        lastName: p?.last_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
      }
    })
  }

  // Base query shared across branches
  const baseQuery = () =>
    (supabase as any)
      .from("memory")
      .select(MEMORY_SELECT)
      .eq("circle_id", circleId)
      .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`)
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })

  // ── Branch 1: Month overflow (cursor-paginated) ────────────
  if (yearMonth) {
    const PAGE_SIZE = 24
    const parts = yearMonth.split('-')
    const yearNum = Number(parts[0])
    const monthNum = Number(parts[1])
    const from = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString()
    const to = new Date(Date.UTC(yearNum, monthNum, 1)).toISOString()
    let q = baseQuery().gte("memory_date", from).lt("memory_date", to).limit(PAGE_SIZE + 1)

    if (cursor) {
      const [cursorDate, cursorCreatedAt, cursorId] = cursor.split(",")
      q = q.or(
        [
          `memory_date.lt.${cursorDate}`,
          `and(memory_date.eq.${cursorDate},created_at.lt.${cursorCreatedAt})`,
          `and(memory_date.eq.${cursorDate},created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        ].join(",")
      )
    }

    const { data: memories, error } = await q
    if (error) {
      console.error("[timeline] month query failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to load timeline." })
    }

    const raw = memories ?? []
    const hasMore = raw.length > PAGE_SIZE
    const page = raw.slice(0, PAGE_SIZE)
    const withUrls = await attachSignedUrls(supabase, page)
    const last = withUrls[withUrls.length - 1]
    const nextCursor = hasMore && last ? `${last.memory_date},${last.created_at},${last.id}` : null
    return { memories: withUrls, nextCursor, children, members }
  }

  // ── Branch 2: Member page (cursor-based, authorId filter) ──
  if (authorId) {
    let q = baseQuery().eq("owner_user_id", authorId).limit(20)

    if (cursor) {
      const [cursorDate, cursorCreatedAt, cursorId] = cursor.split(",")
      q = q.or(
        [
          `memory_date.lt.${cursorDate}`,
          `and(memory_date.eq.${cursorDate},created_at.lt.${cursorCreatedAt})`,
          `and(memory_date.eq.${cursorDate},created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        ].join(",")
      )
    }

    const { data: memories, error } = await q
    if (error) {
      console.error("[timeline] author query failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to load timeline." })
    }

    const withUrls = await attachSignedUrls(supabase, memories ?? [])
    const last = withUrls[withUrls.length - 1]
    const nextCursor = last ? `${last.memory_date},${last.created_at},${last.id}` : null
    return { memories: withUrls, nextCursor, children, members }
  }

  // ── Branch 3: Main timeline (year-at-a-time) ───────────────
  const targetYear = year ?? await getLatestYear(supabase, circleId, user.sub)

  if (!targetYear) {
    return { memories: [], prevYear: null, children, members }
  }

  const from = new Date(Date.UTC(targetYear, 0, 1)).toISOString()
  const to = new Date(Date.UTC(targetYear + 1, 0, 1)).toISOString()

  const { data: memories, error } = await baseQuery()
    .gte("memory_date", from)
    .lt("memory_date", to)
    .limit(YEAR_LIMIT)

  if (error) {
    console.error("[timeline] year query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load timeline." })
  }

  const prevYear = await getPrevYear(supabase, circleId, user.sub, targetYear)
  const withUrls = await attachSignedUrls(supabase, memories ?? [])
  return { memories: withUrls, prevYear, children, members }
})

// ── Helpers ────────────────────────────────────────────────────

async function getLatestYear(supabase: any, circleId: string, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("memory")
    .select("memory_date")
    .eq("circle_id", circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${userId})`)
    .order("memory_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? new Date(data.memory_date).getUTCFullYear() : null
}

async function getPrevYear(supabase: any, circleId: string, userId: string, currentYear: number): Promise<number | null> {
  const before = new Date(Date.UTC(currentYear, 0, 1)).toISOString()
  const { data } = await supabase
    .from("memory")
    .select("memory_date")
    .eq("circle_id", circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${userId})`)
    .lt("memory_date", before)
    .order("memory_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? new Date(data.memory_date).getUTCFullYear() : null
}

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
