import { serverSupabaseServiceRole } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event) as { token?: string }
  if (!token) throw createError({ statusCode: 400, message: "Missing viewer token." })

  const secret = useRuntimeConfig(event).jwtSecret as string
  if (!secret) throw createError({ statusCode: 500, message: "Server misconfiguration." })

  let circleId: string
  try {
    const payload = verifyViewerToken(token, secret)
    circleId = payload.circle_id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.toLowerCase().includes("expired")) {
      throw createError({ statusCode: 401, message: "expired" })
    }
    throw createError({ statusCode: 401, message: "Invalid viewer token." })
  }

  const supabase = serverSupabaseServiceRole(event)

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

  // Fetch recent memories (circle-visibility only, newest first, max 50)
  const { data: memories } = await supabase
    .from("memory")
    .select("id, memory_date, note, memorymedia(storage_path)")
    .eq("circle_id", circleId)
    .eq("visibility", "circle")
    .order("memory_date", { ascending: false })
    .limit(50)

  // Generate signed URLs for media
  const memoriesWithUrls = await Promise.all(
    (memories ?? []).map(async (m: any) => {
      const media = m.memorymedia?.[0]
      if (!media?.storage_path) return { id: m.id, memory_date: m.memory_date, note: m.note, signedUrl: null, mediaType: null }
      const ext = media.storage_path.split('.').pop()?.toLowerCase() ?? ''
      const mediaType: 'video' | 'image' = ['mp4', 'mov', 'webm', 'qt'].includes(ext) ? 'video' : 'image'
      const { data } = await supabase.storage
        .from("memories-private")
        .createSignedUrl(media.storage_path, 60 * 60)
      return { id: m.id, memory_date: m.memory_date, note: m.note, signedUrl: data?.signedUrl ?? null, mediaType }
    })
  )

  return {
    circleName: circle.name,
    ownerFirstName: owner?.first_name ?? null,
    memories: memoriesWithUrls,
  }
})
