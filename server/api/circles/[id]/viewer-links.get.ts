import { serverSupabaseUser, serverSupabaseClient, serverSupabaseServiceRole } from "#supabase/server"

const PREVIEW_LIMIT = 5

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized." })

  const circleId = getRouterParam(event, "id")!
  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: "Server misconfiguration." })

  const supabase = await serverSupabaseClient(event)

  // Verify requester is owner of this circle
  const { data: membership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.sub)
    .maybeSingle()

  if (membership?.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can manage viewer links." })
  }

  const { data: links, error } = await supabase
    .from("viewer_link")
    .select("id, nonce, mode, memory_ids, label, expires_at, created_at")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[viewer-links.get] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load viewer links." })
  }

  // Service role client for signed URL generation (needs storage access)
  const serviceSupabase = serverSupabaseServiceRole(event)

  // Build preview thumbnails for selection links
  const results = await Promise.all(
    (links ?? []).map(async (link) => {
      const token = signViewerToken(circleId, secret, undefined, link.id, link.nonce)
      const isExpired = new Date(link.expires_at).getTime() < Date.now()
      const memoryCount = link.mode === "selection" ? (link.memory_ids?.length ?? 0) : null

      // Fetch preview thumbnails for selection links (first N memories)
      let previewUrls: string[] = []
      if (link.mode === "selection" && link.memory_ids?.length) {
        const previewIds = link.memory_ids.slice(0, PREVIEW_LIMIT)
        const { data: memories } = await serviceSupabase
          .from("memory")
          .select("id, memorymedia(storage_path, media_type)")
          .in("id", previewIds)
          .limit(PREVIEW_LIMIT)

        if (memories?.length) {
          const urls = await Promise.all(
            memories.map(async (m: any) => {
              const media = m.memorymedia?.[0]
              if (!media?.storage_path) return null
              // Use allSettled: try thumbnail transform first, fall back to full URL
              const [fullResult, thumbResult] = await Promise.allSettled([
                serviceSupabase.storage.from("memories-private").createSignedUrl(media.storage_path, 3600),
                media.media_type !== "video"
                  ? serviceSupabase.storage.from("memories-private").createSignedUrl(media.storage_path, 3600, {
                      transform: { width: 100, format: "webp" as "origin", quality: 60 },
                    })
                  : Promise.resolve({ data: null }),
              ])
              const fullUrl = fullResult.status === "fulfilled" ? (fullResult.value.data?.signedUrl ?? null) : null
              const thumbUrl = thumbResult.status === "fulfilled" ? (thumbResult.value.data?.signedUrl ?? null) : null
              return thumbUrl ?? fullUrl
            })
          )
          previewUrls = urls.filter((u): u is string => u !== null)
        }
      }

      return {
        id: link.id,
        mode: link.mode as "full" | "selection",
        label: link.label,
        expiresAt: link.expires_at,
        isExpired,
        memoryCount,
        memoryIds: link.mode === "selection" ? link.memory_ids : null,
        previewUrls,
        token,
        createdAt: link.created_at,
      }
    })
  )

  return results
})
