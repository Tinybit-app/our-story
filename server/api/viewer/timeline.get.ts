import { serverSupabaseServiceRole } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event) as { token?: string }
  if (!token) throw createError({ statusCode: 400, message: "Missing viewer token." })

  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: "Server misconfiguration." })

  let circleId: string
  let viewerLinkId: string
  let nonce: string
  try {
    const payload = verifyViewerToken(token, secret)
    circleId = payload.circle_id
    viewerLinkId = payload.viewer_link_id
    nonce = payload.nonce
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.toLowerCase().includes("expired")) {
      throw createError({ statusCode: 401, message: "expired" })
    }
    throw createError({ statusCode: 401, message: "Invalid viewer token." })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Verify the viewer_link row exists and nonce matches (revocation check)
  const { data: viewerLink } = await supabase
    .from("viewer_link")
    .select("id, nonce, mode, memory_ids, date_from, date_to, label, expires_at")
    .eq("id", viewerLinkId)
    .maybeSingle()

  if (!viewerLink || viewerLink.nonce !== nonce) {
    throw createError({ statusCode: 401, message: "Invalid viewer token." })
  }

  if (new Date(viewerLink.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 401, message: "expired" })
  }

  // Fetch circle name and owner first name
  const { data: circle } = await supabase
    .from("circle")
    .select("name, created_by")
    .eq("id", circleId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!circle) throw createError({ statusCode: 404, message: "Circle not found." })

  const { data: owner } = await supabase
    .from("user")
    .select("first_name")
    .eq("id", circle.created_by)
    .maybeSingle()

  // Build memory query based on mode
  const mode = viewerLink.mode as "full" | "date_range" | "selection"

  let memoryQuery = supabase
    .from("memory")
    .select("id, memory_date, note, memorymedia(storage_path, media_type)")
    .eq("circle_id", circleId)
    .eq("visibility", "circle")
    .order("memory_date", { ascending: false })
    .limit(50)

  if (mode === "date_range" && viewerLink.date_from && viewerLink.date_to) {
    memoryQuery = memoryQuery
      .gte("memory_date", viewerLink.date_from)
      .lte("memory_date", viewerLink.date_to)
  } else if (mode === "selection" && viewerLink.memory_ids?.length) {
    memoryQuery = memoryQuery.in("id", viewerLink.memory_ids)
  }

  const { data: memories } = await memoryQuery

  // Generate signed URLs
  const memoriesWithUrls = await Promise.all(
    (memories ?? []).map(async (m: any) => {
      const media = m.memorymedia?.[0]
      if (!media?.storage_path) {
        return { id: m.id, memory_date: m.memory_date, note: m.note, signedUrl: null, mediaType: null }
      }
      const isVideo = media.media_type === "video"
      const mediaType: "video" | "image" = isVideo ? "video" : "image"
      const { data } = await supabase.storage
        .from("memories-private")
        .createSignedUrl(media.storage_path, 3600, isVideo ? undefined : {
          transform: { width: 800, format: "webp" as "origin", quality: 85 },
        })
      return { id: m.id, memory_date: m.memory_date, note: m.note, signedUrl: data?.signedUrl ?? null, mediaType }
    })
  )

  // Derive selectionDateRange from returned memories (for viewer UI display)
  let selectionDateRange: { from: string; to: string } | null = null
  if (mode === "selection" && memoriesWithUrls.length > 0) {
    const dates = memoriesWithUrls.map((m) => m.memory_date).sort()
    selectionDateRange = { from: dates[0], to: dates[dates.length - 1] }
  } else if (mode === "date_range" && viewerLink.date_from && viewerLink.date_to) {
    selectionDateRange = { from: viewerLink.date_from, to: viewerLink.date_to }
  }

  return {
    circleName: circle.name,
    ownerFirstName: owner?.first_name ?? null,
    linkLabel: viewerLink.label,
    mode,
    selectionDateRange,
    memories: memoriesWithUrls,
  }
})
