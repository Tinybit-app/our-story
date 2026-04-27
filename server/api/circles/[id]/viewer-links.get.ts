import { serverSupabaseUser, serverSupabaseClient } from "#supabase/server"

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
    .select("id, nonce, mode, memory_ids, date_from, date_to, label, expires_at, created_at")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[viewer-links.get] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load viewer links." })
  }

  return (links ?? []).map((link) => {
    const token = signViewerToken(circleId, secret, undefined, link.id, link.nonce)
    const isExpired = new Date(link.expires_at).getTime() < Date.now()
    const memoryCount = link.mode === "selection" ? (link.memory_ids?.length ?? 0) : null
    const dateRange = (link.mode === "date_range" || link.mode === "selection")
      ? deriveDisplayDateRange(link)
      : null

    return {
      id: link.id,
      mode: link.mode as "full" | "date_range" | "selection",
      label: link.label,
      expiresAt: link.expires_at,
      isExpired,
      memoryCount,
      dateRange,
      token,
      createdAt: link.created_at,
    }
  })
})

function deriveDisplayDateRange(link: {
  mode: string
  date_from: string | null
  date_to: string | null
  memory_ids: string[] | null
}): { from: string; to: string } | null {
  if (link.mode === "date_range" && link.date_from && link.date_to) {
    return { from: link.date_from, to: link.date_to }
  }
  // For selection mode, date range is derived server-side from memories in the viewer API
  return null
}
